import re

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from apps.core.models import SupplierAccount

from .models import LegalEntity, SupplierAccountBinding, VisitFinanceAssignment


_PARTY_PREFIX_RE = re.compile(r'^\s*(?:фоп|тов|тзов|пп)\s*[·:—\-]?\s*', re.IGNORECASE)
_CONNECTION_FIELDS = (
    'api_key',
    'api_login',
    'api_password',
    'api_token',
    'api_refresh_token',
    'browser_fingerprint',
)


def normalize_party_name(value):
    """Normalize a FOP/TOV name so legacy account names can be matched safely."""

    text = _PARTY_PREFIX_RE.sub('', str(value or '').strip().lower())
    text = re.sub(r'[^0-9a-zа-яіїєґ]+', ' ', text, flags=re.IGNORECASE)
    return ' '.join(text.split())


def _active_entities_for_account(account):
    return LegalEntity.objects.filter(
        company=account.supplier.company,
        is_active=True,
    ).order_by('sort_order', '-is_primary', 'id')


def ensure_supplier_account_binding(account):
    """Return binding, auto-matching old account names to Finance entities once.

    Older VIN-matrix supplier accounts were often named directly after a FOP or
    TOV.  When the matching legal entity now exists in Finance, bind that old
    account automatically so clients do not have to recreate their API access.
    """

    try:
        return SupplierAccountBinding.objects.select_related('legal_entity').get(
            supplier_account=account,
        )
    except SupplierAccountBinding.DoesNotExist:
        pass

    normalized_account = normalize_party_name(account.name)
    if not normalized_account:
        return None

    matches = [
        entity
        for entity in _active_entities_for_account(account)
        if normalize_party_name(entity.name) == normalized_account
    ]
    if len(matches) != 1:
        return None

    entity = matches[0]
    conflict = SupplierAccountBinding.objects.filter(
        company=account.supplier.company,
        supplier=account.supplier,
        legal_entity=entity,
    ).exclude(supplier_account=account).first()
    if conflict:
        return None

    try:
        with transaction.atomic():
            return SupplierAccountBinding.objects.create(
                company=account.supplier.company,
                supplier=account.supplier,
                supplier_account=account,
                legal_entity=entity,
            )
    except IntegrityError:
        return SupplierAccountBinding.objects.select_related('legal_entity').filter(
            supplier_account=account,
        ).first()


def set_supplier_account_binding(account, legal_entity_id):
    """Explicitly bind a technical supplier account to a Finance FOP/TOV."""

    if legal_entity_id in [None, '', 'null']:
        SupplierAccountBinding.objects.filter(supplier_account=account).delete()
        return None

    try:
        entity_id = int(legal_entity_id)
    except (TypeError, ValueError):
        raise ValidationError({'legal_entity_id': 'Некоректний ФОП / ТОВ.'})

    entity = LegalEntity.objects.filter(
        id=entity_id,
        company=account.supplier.company,
        is_active=True,
    ).first()
    if not entity:
        raise ValidationError({'legal_entity_id': 'ФОП / ТОВ не знайдено у Фінансах.'})

    conflict = SupplierAccountBinding.objects.filter(
        company=account.supplier.company,
        supplier=account.supplier,
        legal_entity=entity,
    ).exclude(supplier_account=account).first()
    if conflict:
        raise ValidationError({
            'legal_entity_id': (
                f'Для {entity.get_entity_type_display()} «{entity.name}» у цього '
                f'постачальника вже привʼязано акаунт «{conflict.supplier_account.name}».'
            ),
        })

    binding, _ = SupplierAccountBinding.objects.update_or_create(
        supplier_account=account,
        defaults={
            'company': account.supplier.company,
            'supplier': account.supplier,
            'legal_entity': entity,
        },
    )
    return binding


def account_binding_payload(account, *, auto_match=True):
    binding = ensure_supplier_account_binding(account) if auto_match else (
        SupplierAccountBinding.objects.select_related('legal_entity').filter(
            supplier_account=account,
        ).first()
    )
    entity = binding.legal_entity if binding else None
    return {
        'legal_entity_id': entity.id if entity else None,
        'legal_entity_name': entity.name if entity else '',
        'legal_entity_type': entity.entity_type if entity else '',
        'legal_entity_type_label': entity.get_entity_type_display() if entity else '',
    }


def binding_payload_map(company, account_ids, *, auto_match=True):
    ids = {int(value) for value in account_ids if str(value or '').isdigit()}
    if not ids:
        return {}

    accounts = SupplierAccount.objects.filter(
        id__in=ids,
        supplier__company=company,
    ).select_related('supplier', 'supplier__company')
    return {
        account.id: account_binding_payload(account, auto_match=auto_match)
        for account in accounts
    }


def parts_legal_entity_for_visit(company, visit):
    assignment = VisitFinanceAssignment.objects.filter(
        company=company,
        visit=visit,
    ).select_related('parts_legal_entity').first()
    if assignment and assignment.parts_legal_entity_id:
        return assignment.parts_legal_entity

    return (
        LegalEntity.objects.filter(
            company=company,
            is_active=True,
            is_default_for_parts=True,
        ).order_by('sort_order', 'id').first()
        or LegalEntity.objects.filter(
            company=company,
            is_active=True,
            is_primary=True,
        ).order_by('sort_order', 'id').first()
        or LegalEntity.objects.filter(
            company=company,
            is_active=True,
        ).order_by('sort_order', 'id').first()
    )


def mapped_supplier_account_for_visit(company, visit, supplier):
    """Resolve the supplier credentials belonging to the visit's parts entity."""

    entity = parts_legal_entity_for_visit(company, visit)
    if not entity:
        return None

    binding = SupplierAccountBinding.objects.filter(
        company=company,
        supplier=supplier,
        legal_entity=entity,
        supplier_account__is_active=True,
    ).select_related('supplier_account').first()
    if binding:
        return binding.supplier_account

    # One-time compatibility for accounts that used to be named after FOP/TOV.
    for account in supplier.accounts.filter(is_active=True).order_by('-is_default', 'id'):
        auto_binding = ensure_supplier_account_binding(account)
        if auto_binding and auto_binding.legal_entity_id == entity.id:
            return account
    return None


def _connection_signature(account):
    return tuple(str(getattr(account, field, '') or '').strip() for field in _CONNECTION_FIELDS)


def cleanup_runtime_legacy_supplier_account_duplicates():
    """Remove only repair-generated duplicate «Основний акаунт» rows.

    Historical runtime repair scripts can recreate an account named
    «Основний акаунт» from the supplier's mirrored credentials after the user
    has renamed that account.  We remove it only when another account of the
    same supplier has the exact same connection credentials.  A sole legacy
    account, or an account with different credentials, is never touched.
    """

    from apps.core.serializers import sync_supplier_default_account

    removed = 0
    ghosts = list(
        SupplierAccount.objects.filter(name='Основний акаунт')
        .select_related('supplier')
        .order_by('supplier_id', 'id')
    )
    for ghost in ghosts:
        signature = _connection_signature(ghost)
        if not any(signature):
            continue
        duplicate = None
        for candidate in SupplierAccount.objects.filter(supplier=ghost.supplier).exclude(id=ghost.id):
            if _connection_signature(candidate) == signature:
                duplicate = candidate
                break
        if not duplicate:
            continue

        supplier = ghost.supplier
        was_default = ghost.is_default
        ghost.delete()
        removed += 1
        if was_default:
            sync_supplier_default_account(supplier, duplicate if duplicate.is_active else None)

    if removed:
        print(
            f'✅ Прибрано дубльованих legacy-акаунтів постачальників: {removed}',
            flush=True,
        )
    return removed
