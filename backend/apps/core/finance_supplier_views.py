from django.db import transaction

from .models import Supplier, SupplierAccount, Visit
from .paid_views import (
    SupplierAccountViewSet as BaseSupplierAccountViewSet,
    SupplierViewSet as BaseSupplierViewSet,
)
from .safe_crm_views import (
    OrderPartViewSet as BaseOrderPartViewSet,
    safe_ensure_company,
)
from apps.finance.supplier_bindings import (
    account_binding_payload,
    binding_payload_map,
    ensure_supplier_account_binding,
    mapped_supplier_account_for_visit,
    set_supplier_account_binding,
)


LEGACY_PLACEHOLDER_TYPES = {
    'vesna-auto': Supplier.API_VESNA,
    'omega': Supplier.API_OMEGA,
    'technomir': Supplier.API_TEHNOMIR,
}


def _account_payload_rows(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get('results'), list):
        return data['results']
    if isinstance(data, dict) and data.get('id'):
        return [data]
    return []


def _enrich_account_response(data, company):
    rows = _account_payload_rows(data)
    ids = [row.get('id') for row in rows if isinstance(row, dict)]
    mapping = binding_payload_map(company, ids)
    for row in rows:
        if isinstance(row, dict) and row.get('id') in mapping:
            row.update(mapping[row['id']])
        elif isinstance(row, dict):
            row.update({
                'legal_entity_id': None,
                'legal_entity_name': '',
                'legal_entity_type': '',
                'legal_entity_type_label': '',
            })
    return data


def _supplier_payload_rows(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get('results'), list):
        return data['results']
    if isinstance(data, dict) and data.get('id'):
        return [data]
    return []


def _legacy_placeholder_type(row):
    if not isinstance(row, dict):
        return None
    if str(row.get('api_type') or Supplier.API_CUSTOM) != Supplier.API_CUSTOM:
        return None
    return LEGACY_PLACEHOLDER_TYPES.get(str(row.get('name') or '').strip().lower())


def _is_empty_legacy_placeholder(row):
    legacy_type = _legacy_placeholder_type(row)
    if not legacy_type:
        return False

    accounts = row.get('accounts') or []
    accounts_count = int(row.get('accounts_count') or len(accounts) or 0)
    return (
        not bool(row.get('api_key_set'))
        and not str(row.get('api_login') or '').strip()
        and not bool(row.get('api_password_set'))
        and not bool(row.get('api_token_set'))
        and accounts_count == 0
        and not row.get('price_file')
    )


def _hide_legacy_placeholders(data):
    """Hide old auto-created provider cards that were never configured.

    Older VIN-matrix registrations created Vesna-auto, Omega and Technomir rows
    automatically.  They are technical placeholders, not real connections, so
    the Suppliers screen should stay empty until the user explicitly adds a
    supplier.  Configured legacy rows are preserved and still shown.
    """
    if isinstance(data, list):
        data[:] = [row for row in data if not _is_empty_legacy_placeholder(row)]
        return data

    if isinstance(data, dict) and isinstance(data.get('results'), list):
        before = len(data['results'])
        data['results'] = [row for row in data['results'] if not _is_empty_legacy_placeholder(row)]
        removed = before - len(data['results'])
        if removed and isinstance(data.get('count'), int):
            data['count'] = max(0, data['count'] - removed)
    return data


def _normalize_legacy_supplier_type(row):
    """Expose the real provider type for an old configured placeholder."""
    legacy_type = _legacy_placeholder_type(row)
    if legacy_type and not _is_empty_legacy_placeholder(row):
        row['api_type'] = legacy_type
    return row


def _enrich_supplier_response(data, company):
    supplier_rows = _supplier_payload_rows(data)
    account_ids = []
    for supplier in supplier_rows:
        if not isinstance(supplier, dict):
            continue
        _normalize_legacy_supplier_type(supplier)
        for account in supplier.get('accounts') or []:
            if isinstance(account, dict) and account.get('id'):
                account_ids.append(account['id'])

    mapping = binding_payload_map(company, account_ids)
    for supplier in supplier_rows:
        if not isinstance(supplier, dict):
            continue
        for account in supplier.get('accounts') or []:
            if not isinstance(account, dict):
                continue
            account.update(mapping.get(account.get('id'), {
                'legal_entity_id': None,
                'legal_entity_name': '',
                'legal_entity_type': '',
                'legal_entity_type_label': '',
            }))
    return data


class SupplierViewSet(BaseSupplierViewSet):
    """Supplier API enriched with Finance ownership of technical accounts."""

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        company = safe_ensure_company(request.user)
        if company and hasattr(response, 'data'):
            _hide_legacy_placeholders(response.data)
            _enrich_supplier_response(response.data, company)
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        company = safe_ensure_company(request.user)
        if company and hasattr(response, 'data'):
            _enrich_supplier_response(response.data, company)
        return response


class SupplierAccountViewSet(BaseSupplierAccountViewSet):
    """Keep credentials in core, but store FOP/TOV ownership in Finance."""

    def _account(self, account_id):
        company = safe_ensure_company(self.request.user)
        return SupplierAccount.objects.select_related('supplier', 'supplier__company').filter(
            id=account_id,
            supplier__company=company,
        ).first()

    def _sync_binding(self, account):
        if 'legal_entity_id' in self.request.data:
            set_supplier_account_binding(account, self.request.data.get('legal_entity_id'))
        else:
            ensure_supplier_account_binding(account)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        company = safe_ensure_company(request.user)
        if company and hasattr(response, 'data'):
            _enrich_account_response(response.data, company)
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        company = safe_ensure_company(request.user)
        if company and hasattr(response, 'data'):
            _enrich_account_response(response.data, company)
        return response

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        account = self._account(response.data.get('id')) if hasattr(response, 'data') else None
        if account:
            self._sync_binding(account)
            response.data.update(account_binding_payload(account))
        return response

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        account = self._account(response.data.get('id')) if hasattr(response, 'data') else None
        if account:
            self._sync_binding(account)
            response.data.update(account_binding_payload(account))
        return response


class OrderPartViewSet(BaseOrderPartViewSet):
    """Automatically use the supplier account owned by the visit's parts FOP/TOV."""

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        visit = Visit.objects.filter(
            id=self.request.data.get('visit'),
            company=company,
        ).first() if company else None
        supplier = Supplier.objects.filter(
            id=self.request.data.get('supplier_ref'),
            company=company,
        ).first() if company and self.request.data.get('supplier_ref') else None

        mapped_account = (
            mapped_supplier_account_for_visit(company, visit, supplier)
            if company and visit and supplier
            else None
        )
        if not mapped_account:
            return super().perform_create(serializer)

        # BaseOrderPartViewSet validates and snapshots supplier_account from
        # request.data. Replace only this one field for the duration of create;
        # all remaining validation, stock sync and activity logging stay in the
        # proven existing implementation.
        original_data = self.request.data
        patched_data = original_data.copy()
        patched_data['supplier_account'] = mapped_account.id
        self.request._full_data = patched_data
        try:
            return super().perform_create(serializer)
        finally:
            self.request._full_data = original_data
