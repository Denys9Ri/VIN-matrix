import csv
from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Employee, Supplier, Visit

from .models import (
    FinanceAccount,
    FinanceChangeLog,
    FinanceSourceAllocation,
    FinanceTransaction,
    LegalEntity,
    VisitFinanceAssignment,
)
from .services import (
    account_payload,
    bootstrap_company_finance,
    dec,
    ensure_finance_company,
    finance_summary,
    legal_entity_payload,
    period_bounds,
    record_change,
    source_allocations_payload,
    source_descriptor,
    transaction_snapshot,
    visit_assignment_payload,
    build_ledger,
)


def bool_value(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def int_value(value):
    try:
        return int(value)
    except Exception:
        return None


def parse_occurred_at(value):
    if not value:
        return timezone.now()
    if isinstance(value, datetime):
        result = value
    else:
        try:
            result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except Exception:
            try:
                result = datetime.strptime(str(value)[:16], '%Y-%m-%dT%H:%M')
            except Exception:
                raise ValidationError({'occurred_at': 'Некоректна дата операції.'})
    if timezone.is_naive(result):
        result = timezone.make_aware(result, timezone.get_current_timezone())
    return result


def entity_for_company(company, entity_id, required=False):
    entity_id = int_value(entity_id)
    if not entity_id:
        if required:
            raise ValidationError({'legal_entity_id': 'Оберіть ФОП / ТОВ.'})
        return None
    entity = LegalEntity.objects.filter(company=company, id=entity_id).first()
    if not entity:
        raise ValidationError({'legal_entity_id': 'ФОП / ТОВ не знайдено.'})
    return entity


def account_for_company(company, account_id, required=False):
    account_id = int_value(account_id)
    if not account_id:
        if required:
            raise ValidationError({'account_id': 'Оберіть касу або рахунок.'})
        return None
    account = FinanceAccount.objects.filter(company=company, id=account_id).select_related('legal_entity').first()
    if not account:
        raise ValidationError({'account_id': 'Касу або рахунок не знайдено.'})
    return account


def employee_for_company(company, employee_id):
    employee_id = int_value(employee_id)
    if not employee_id:
        return None
    employee = Employee.objects.filter(company=company, id=employee_id).first()
    if not employee:
        raise ValidationError({'employee_id': 'Працівника не знайдено.'})
    return employee


def supplier_for_company(company, supplier_id):
    supplier_id = int_value(supplier_id)
    if not supplier_id:
        return None
    supplier = Supplier.objects.filter(company=company, id=supplier_id).first()
    if not supplier:
        raise ValidationError({'supplier_id': 'Постачальника не знайдено.'})
    return supplier


def serialize_manual_transaction(item):
    return {
        **transaction_snapshot(item),
        'kind_label': item.get_kind_display(),
        'source_type_label': item.get_source_type_display(),
        'legal_entity_name': item.legal_entity.name if item.legal_entity_id else '',
        'account_name': item.account.name if item.account_id else '',
        'target_account_name': item.target_account.name if item.target_account_id else '',
        'employee_name': (
            f'{item.employee.user.first_name} {item.employee.user.last_name}'.strip() or item.employee.user.username
        ) if item.employee_id and item.employee and item.employee.user else '',
        'supplier_name': item.supplier.name if item.supplier_id else '',
    }


class FinanceSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        bounds = period_bounds(
            request.query_params.get('period') or '30d',
            request.query_params.get('date_from'),
            request.query_params.get('date_to'),
        )
        entity_id = int_value(request.query_params.get('legal_entity'))
        return Response(finance_summary(company, bounds, legal_entity_id=entity_id))


class LegalEntityListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        rows = LegalEntity.objects.filter(company=company).order_by('sort_order', '-is_primary', 'id')
        return Response({'results': [legal_entity_payload(item) for item in rows]})

    @transaction.atomic
    def post(self, request):
        company = ensure_finance_company(request.user)
        name = str(request.data.get('name') or '').strip()
        if not name:
            raise ValidationError({'name': 'Вкажіть назву ФОП / ТОВ.'})
        entity_type = request.data.get('entity_type') or LegalEntity.TYPE_FOP
        if entity_type not in dict(LegalEntity.TYPE_CHOICES):
            raise ValidationError({'entity_type': 'Некоректний тип юрособи.'})

        is_primary = bool_value(request.data.get('is_primary'), not LegalEntity.objects.filter(company=company, is_active=True).exists())
        default_parts = bool_value(request.data.get('is_default_for_parts'), False)
        default_services = bool_value(request.data.get('is_default_for_services'), False)
        if is_primary:
            LegalEntity.objects.filter(company=company).update(is_primary=False)
        if default_parts:
            LegalEntity.objects.filter(company=company).update(is_default_for_parts=False)
        if default_services:
            LegalEntity.objects.filter(company=company).update(is_default_for_services=False)

        entity = LegalEntity.objects.create(
            company=company,
            entity_type=entity_type,
            name=name,
            tax_id=str(request.data.get('tax_id') or '').strip(),
            registration_code=str(request.data.get('registration_code') or '').strip(),
            iban=str(request.data.get('iban') or '').strip(),
            bank_name=str(request.data.get('bank_name') or '').strip(),
            requisites=str(request.data.get('requisites') or '').strip(),
            is_primary=is_primary,
            is_default_for_parts=default_parts,
            is_default_for_services=default_services,
            is_active=bool_value(request.data.get('is_active'), True),
            sort_order=int_value(request.data.get('sort_order')) or 100,
        )
        bootstrap_company_finance(company, request.user)
        record_change(company, request.user, 'legal_entity', entity.id, FinanceChangeLog.ACTION_CREATE, after=legal_entity_payload(entity), reason=request.data.get('reason') or '')
        return Response(legal_entity_payload(entity), status=status.HTTP_201_CREATED)


class LegalEntityDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        company = ensure_finance_company(request.user)
        entity = LegalEntity.objects.filter(company=company, id=pk).first()
        if not entity:
            return Response({'error': 'ФОП / ТОВ не знайдено.'}, status=404)
        before = legal_entity_payload(entity)

        with transaction.atomic():
            if 'name' in request.data:
                name = str(request.data.get('name') or '').strip()
                if not name:
                    raise ValidationError({'name': 'Назва не може бути порожньою.'})
                entity.name = name
            if 'entity_type' in request.data:
                entity_type = request.data.get('entity_type')
                if entity_type not in dict(LegalEntity.TYPE_CHOICES):
                    raise ValidationError({'entity_type': 'Некоректний тип юрособи.'})
                entity.entity_type = entity_type
            for field in ['tax_id', 'registration_code', 'iban', 'bank_name', 'requisites']:
                if field in request.data:
                    setattr(entity, field, str(request.data.get(field) or '').strip())
            if 'sort_order' in request.data:
                entity.sort_order = int_value(request.data.get('sort_order')) or 100
            if 'is_active' in request.data:
                active = bool_value(request.data.get('is_active'))
                if not active and LegalEntity.objects.filter(company=company, is_active=True).exclude(id=entity.id).count() == 0:
                    raise ValidationError({'is_active': 'Має залишитися хоча б одна активна юрособа.'})
                entity.is_active = active
            if bool_value(request.data.get('is_primary'), entity.is_primary) and not entity.is_primary:
                LegalEntity.objects.filter(company=company).exclude(id=entity.id).update(is_primary=False)
                entity.is_primary = True
            elif 'is_primary' in request.data:
                entity.is_primary = bool_value(request.data.get('is_primary'))
            if bool_value(request.data.get('is_default_for_parts'), entity.is_default_for_parts) and not entity.is_default_for_parts:
                LegalEntity.objects.filter(company=company).exclude(id=entity.id).update(is_default_for_parts=False)
                entity.is_default_for_parts = True
            elif 'is_default_for_parts' in request.data:
                entity.is_default_for_parts = bool_value(request.data.get('is_default_for_parts'))
            if bool_value(request.data.get('is_default_for_services'), entity.is_default_for_services) and not entity.is_default_for_services:
                LegalEntity.objects.filter(company=company).exclude(id=entity.id).update(is_default_for_services=False)
                entity.is_default_for_services = True
            elif 'is_default_for_services' in request.data:
                entity.is_default_for_services = bool_value(request.data.get('is_default_for_services'))
            entity.save()
            bootstrap_company_finance(company, request.user)

        entity.refresh_from_db()
        after = legal_entity_payload(entity)
        record_change(company, request.user, 'legal_entity', entity.id, FinanceChangeLog.ACTION_UPDATE, before=before, after=after, reason=request.data.get('reason') or '')
        return Response(after)

    def delete(self, request, pk):
        company = ensure_finance_company(request.user)
        entity = LegalEntity.objects.filter(company=company, id=pk).first()
        if not entity:
            return Response({'error': 'ФОП / ТОВ не знайдено.'}, status=404)
        if LegalEntity.objects.filter(company=company, is_active=True).exclude(id=entity.id).count() == 0:
            raise ValidationError({'error': 'Не можна деактивувати останню юрособу.'})
        before = legal_entity_payload(entity)
        entity.is_active = False
        entity.is_primary = False
        entity.is_default_for_parts = False
        entity.is_default_for_services = False
        entity.save(update_fields=['is_active', 'is_primary', 'is_default_for_parts', 'is_default_for_services', 'updated_at'])
        bootstrap_company_finance(company, request.user)
        record_change(company, request.user, 'legal_entity', entity.id, FinanceChangeLog.ACTION_DELETE, before=before, after=legal_entity_payload(entity), reason=request.data.get('reason') or 'Деактивація')
        return Response({'ok': True})


class FinanceAccountListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        rows = FinanceAccount.objects.filter(company=company).select_related('legal_entity').order_by('sort_order', '-is_primary', 'id')
        return Response({'results': [account_payload(item) for item in rows]})

    @transaction.atomic
    def post(self, request):
        company = ensure_finance_company(request.user)
        entity = entity_for_company(company, request.data.get('legal_entity_id'), required=True)
        name = str(request.data.get('name') or '').strip()
        if not name:
            raise ValidationError({'name': 'Вкажіть назву каси / рахунку.'})
        account_type = request.data.get('account_type') or FinanceAccount.TYPE_CASH
        if account_type not in dict(FinanceAccount.TYPE_CHOICES):
            raise ValidationError({'account_type': 'Некоректний тип рахунку.'})
        is_primary = bool_value(request.data.get('is_primary'), False)
        if is_primary:
            FinanceAccount.objects.filter(company=company, legal_entity=entity).update(is_primary=False)
        account = FinanceAccount.objects.create(
            company=company,
            legal_entity=entity,
            name=name,
            account_type=account_type,
            currency=str(request.data.get('currency') or 'UAH').strip().upper(),
            iban=str(request.data.get('iban') or '').strip(),
            bank_name=str(request.data.get('bank_name') or '').strip(),
            opening_balance=dec(request.data.get('opening_balance')),
            is_primary=is_primary,
            is_active=bool_value(request.data.get('is_active'), True),
            sort_order=int_value(request.data.get('sort_order')) or 100,
        )
        record_change(company, request.user, 'finance_account', account.id, FinanceChangeLog.ACTION_CREATE, after=account_payload(account), reason=request.data.get('reason') or '')
        return Response(account_payload(account), status=201)


class FinanceAccountDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        company = ensure_finance_company(request.user)
        account = FinanceAccount.objects.filter(company=company, id=pk).select_related('legal_entity').first()
        if not account:
            return Response({'error': 'Рахунок не знайдено.'}, status=404)
        before = account_payload(account)
        with transaction.atomic():
            if 'legal_entity_id' in request.data:
                account.legal_entity = entity_for_company(company, request.data.get('legal_entity_id'), required=True)
            if 'name' in request.data:
                name = str(request.data.get('name') or '').strip()
                if not name:
                    raise ValidationError({'name': 'Назва не може бути порожньою.'})
                account.name = name
            if 'account_type' in request.data:
                account_type = request.data.get('account_type')
                if account_type not in dict(FinanceAccount.TYPE_CHOICES):
                    raise ValidationError({'account_type': 'Некоректний тип рахунку.'})
                account.account_type = account_type
            for field in ['currency', 'iban', 'bank_name']:
                if field in request.data:
                    setattr(account, field, str(request.data.get(field) or '').strip())
            if 'opening_balance' in request.data:
                account.opening_balance = dec(request.data.get('opening_balance'))
            if 'sort_order' in request.data:
                account.sort_order = int_value(request.data.get('sort_order')) or 100
            if 'is_active' in request.data:
                account.is_active = bool_value(request.data.get('is_active'))
            if bool_value(request.data.get('is_primary'), account.is_primary) and not account.is_primary:
                FinanceAccount.objects.filter(company=company, legal_entity=account.legal_entity).exclude(id=account.id).update(is_primary=False)
                account.is_primary = True
            elif 'is_primary' in request.data:
                account.is_primary = bool_value(request.data.get('is_primary'))
            account.save()
        account.refresh_from_db()
        after = account_payload(account)
        record_change(company, request.user, 'finance_account', account.id, FinanceChangeLog.ACTION_UPDATE, before=before, after=after, reason=request.data.get('reason') or '')
        return Response(after)

    def delete(self, request, pk):
        company = ensure_finance_company(request.user)
        account = FinanceAccount.objects.filter(company=company, id=pk).select_related('legal_entity').first()
        if not account:
            return Response({'error': 'Рахунок не знайдено.'}, status=404)
        before = account_payload(account)
        account.is_active = False
        account.is_primary = False
        account.save(update_fields=['is_active', 'is_primary', 'updated_at'])
        record_change(company, request.user, 'finance_account', account.id, FinanceChangeLog.ACTION_DELETE, before=before, after=account_payload(account), reason=request.data.get('reason') or 'Деактивація')
        return Response({'ok': True})


class ManualTransactionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        rows = FinanceTransaction.objects.filter(company=company).select_related('legal_entity', 'account', 'target_account', 'employee__user', 'supplier').order_by('-occurred_at', '-id')[:500]
        return Response({'results': [serialize_manual_transaction(item) for item in rows]})

    def _validated_fields(self, company, data, current=None):
        kind = data.get('kind', current.kind if current else FinanceTransaction.KIND_EXPENSE)
        if kind not in dict(FinanceTransaction.KIND_CHOICES):
            raise ValidationError({'kind': 'Некоректний тип операції.'})
        source_type = data.get('source_type', current.source_type if current else FinanceTransaction.SOURCE_MANUAL)
        if source_type not in dict(FinanceTransaction.SOURCE_CHOICES):
            raise ValidationError({'source_type': 'Некоректне призначення операції.'})
        amount = dec(data.get('amount', current.amount if current else 0))
        if amount <= 0:
            raise ValidationError({'amount': 'Сума має бути більше 0.'})

        account = account_for_company(company, data.get('account_id', current.account_id if current else None), required=True)
        target_account = account_for_company(company, data.get('target_account_id', current.target_account_id if current else None), required=False)
        entity = entity_for_company(company, data.get('legal_entity_id', current.legal_entity_id if current else account.legal_entity_id), required=False)
        if account.legal_entity_id and entity and account.legal_entity_id != entity.id:
            raise ValidationError({'account_id': 'Рахунок належить іншому ФОП / ТОВ.'})
        if not entity and account.legal_entity_id:
            entity = account.legal_entity
        if kind == FinanceTransaction.KIND_TRANSFER:
            if not target_account:
                raise ValidationError({'target_account_id': 'Для переказу вкажіть рахунок отримувача.'})
            if target_account.id == account.id:
                raise ValidationError({'target_account_id': 'Рахунки відправника й отримувача мають відрізнятися.'})
        else:
            target_account = None

        title = str(data.get('title', current.title if current else '') or '').strip()
        if not title:
            default_title = dict(FinanceTransaction.SOURCE_CHOICES).get(source_type, 'Фінансова операція')
            title = default_title
        return {
            'kind': kind,
            'source_type': source_type,
            'occurred_at': parse_occurred_at(data.get('occurred_at', current.occurred_at if current else None)),
            'amount': amount,
            'legal_entity': entity,
            'account': account,
            'target_account': target_account,
            'category': str(data.get('category', current.category if current else 'other') or 'other').strip(),
            'title': title,
            'counterparty': str(data.get('counterparty', current.counterparty if current else '') or '').strip(),
            'employee': employee_for_company(company, data.get('employee_id', current.employee_id if current else None)),
            'supplier': supplier_for_company(company, data.get('supplier_id', current.supplier_id if current else None)),
            'payment_method': str(data.get('payment_method', current.payment_method if current else '') or '').strip(),
            'comment': str(data.get('comment', current.comment if current else '') or '').strip(),
        }

    @transaction.atomic
    def post(self, request):
        company = ensure_finance_company(request.user)
        fields = self._validated_fields(company, request.data)
        item = FinanceTransaction.objects.create(company=company, created_by=request.user, updated_by=request.user, **fields)
        after = transaction_snapshot(item)
        record_change(company, request.user, 'manual_transaction', item.id, FinanceChangeLog.ACTION_CREATE, after=after, reason=request.data.get('reason') or '')
        item = FinanceTransaction.objects.select_related('legal_entity', 'account', 'target_account', 'employee__user', 'supplier').get(id=item.id)
        return Response(serialize_manual_transaction(item), status=201)


class ManualTransactionDetailView(ManualTransactionListCreateView):
    @transaction.atomic
    def patch(self, request, pk):
        company = ensure_finance_company(request.user)
        item = FinanceTransaction.objects.filter(company=company, id=pk).first()
        if not item:
            return Response({'error': 'Операцію не знайдено.'}, status=404)
        before = transaction_snapshot(item)
        fields = self._validated_fields(company, request.data, current=item)
        for key, value in fields.items():
            setattr(item, key, value)
        item.updated_by = request.user
        item.save()
        after = transaction_snapshot(item)
        record_change(company, request.user, 'manual_transaction', item.id, FinanceChangeLog.ACTION_UPDATE, before=before, after=after, reason=request.data.get('reason') or '')
        item = FinanceTransaction.objects.select_related('legal_entity', 'account', 'target_account', 'employee__user', 'supplier').get(id=item.id)
        return Response(serialize_manual_transaction(item))

    def delete(self, request, pk):
        company = ensure_finance_company(request.user)
        item = FinanceTransaction.objects.filter(company=company, id=pk).first()
        if not item:
            return Response({'error': 'Операцію не знайдено.'}, status=404)
        before = transaction_snapshot(item)
        item_id = item.id
        item.delete()
        record_change(company, request.user, 'manual_transaction', item_id, FinanceChangeLog.ACTION_DELETE, before=before, after={}, reason=request.data.get('reason') or 'Видалення операції')
        return Response({'ok': True})


class VisitAssignmentView(APIView):
    permission_classes = [IsAuthenticated]

    def _visit(self, company, visit_id):
        return Visit.objects.filter(company=company, id=visit_id).prefetch_related('parts', 'services').first()

    def get(self, request, visit_id):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        visit = self._visit(company, visit_id)
        if not visit:
            return Response({'error': 'Замовлення не знайдено.'}, status=404)
        return Response(visit_assignment_payload(company, visit))

    @transaction.atomic
    def patch(self, request, visit_id):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        visit = self._visit(company, visit_id)
        if not visit:
            return Response({'error': 'Замовлення не знайдено.'}, status=404)
        current = VisitFinanceAssignment.objects.filter(company=company, visit=visit).first()
        before = visit_assignment_payload(company, visit)
        parts_entity = entity_for_company(company, request.data.get('parts_legal_entity_id'), required=True)
        services_entity = entity_for_company(company, request.data.get('services_legal_entity_id'), required=True)
        assignment, _ = VisitFinanceAssignment.objects.update_or_create(
            company=company,
            visit=visit,
            defaults={
                'parts_legal_entity': parts_entity,
                'services_legal_entity': services_entity,
                'note': str(request.data.get('note') or (current.note if current else '') or '').strip(),
                'updated_by': request.user,
            },
        )
        after = visit_assignment_payload(company, visit)
        record_change(company, request.user, 'visit_assignment', assignment.id, FinanceChangeLog.ACTION_UPDATE if current else FinanceChangeLog.ACTION_CREATE, before=before if current else {}, after=after, reason=request.data.get('reason') or '')
        return Response(after)


class SourceAllocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        source_type = request.query_params.get('source_type')
        source_id = int_value(request.query_params.get('source_id'))
        payload = source_allocations_payload(company, source_type, source_id) if source_type and source_id else None
        if not payload:
            return Response({'error': 'Фінансове джерело не знайдено.'}, status=404)
        return Response(payload)

    @transaction.atomic
    def put(self, request):
        company = ensure_finance_company(request.user)
        bootstrap_company_finance(company, request.user)
        source_type = request.data.get('source_type')
        source_id = int_value(request.data.get('source_id'))
        if source_type not in dict(FinanceSourceAllocation.SOURCE_CHOICES) or not source_id:
            raise ValidationError({'source': 'Некоректне джерело операції.'})
        descriptor = source_descriptor(company, source_type, source_id)
        if not descriptor:
            return Response({'error': 'Фінансове джерело не знайдено.'}, status=404)
        allocations = request.data.get('allocations')
        if not isinstance(allocations, list) or not allocations:
            raise ValidationError({'allocations': 'Додайте хоча б один рядок розподілу.'})

        prepared = []
        total = Decimal('0.00')
        for index, row in enumerate(allocations):
            entity = entity_for_company(company, row.get('legal_entity_id'), required=True)
            account = account_for_company(company, row.get('account_id'), required=True)
            if account.legal_entity_id and account.legal_entity_id != entity.id:
                raise ValidationError({'allocations': f'Рядок {index + 1}: рахунок належить іншій юрособі.'})
            amount = dec(row.get('amount'))
            if amount <= 0:
                raise ValidationError({'allocations': f'Рядок {index + 1}: сума має бути більше 0.'})
            total += amount
            prepared.append((entity, account, amount, str(row.get('note') or '').strip()))
        if total != dec(descriptor['amount']):
            raise ValidationError({'allocations': f"Сума розподілу має дорівнювати {dec(descriptor['amount'])} грн. Зараз: {total} грн."})

        before_payload = source_allocations_payload(company, source_type, source_id) or {}
        FinanceSourceAllocation.objects.filter(company=company, source_type=source_type, source_id=source_id).delete()
        for entity, account, amount, note in prepared:
            FinanceSourceAllocation.objects.create(
                company=company,
                source_type=source_type,
                source_id=source_id,
                legal_entity=entity,
                account=account,
                amount=amount,
                note=note,
                created_by=request.user,
                updated_by=request.user,
            )
        after_payload = source_allocations_payload(company, source_type, source_id) or {}
        record_change(
            company,
            request.user,
            'source_allocation',
            f'{source_type}:{source_id}',
            FinanceChangeLog.ACTION_UPDATE,
            before=before_payload,
            after=after_payload,
            reason=request.data.get('reason') or 'Коригування ФОП / ТОВ або рахунку',
        )
        return Response(after_payload)


class FinanceExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = ensure_finance_company(request.user)
        bounds = period_bounds(
            request.query_params.get('period') or '30d',
            request.query_params.get('date_from'),
            request.query_params.get('date_to'),
        )
        entity_id = int_value(request.query_params.get('legal_entity'))
        direction = request.query_params.get('direction') or 'all'
        rows = build_ledger(company, bounds=bounds, legal_entity_id=entity_id)
        if direction in {'income', 'expense'}:
            rows = [item for item in rows if item['direction'] == direction]

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        suffix = direction if direction in {'income', 'expense'} else 'all'
        response['Content-Disposition'] = f'attachment; filename="vin-matrix-finance-{suffix}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            'Дата', 'Тип', 'Сума, грн', 'ФОП / ТОВ', 'Каса / рахунок', 'Категорія',
            'Опис', 'Контрагент', 'Спосіб оплати', 'Джерело', 'Замовлення', 'Коментар',
        ])
        direction_labels = {'income': 'Надходження', 'expense': 'Витрата', 'transfer': 'Переказ'}
        for item in rows:
            occurred = item.get('occurred_at') or ''
            writer.writerow([
                str(occurred)[:19].replace('T', ' '),
                direction_labels.get(item.get('direction'), item.get('direction')),
                f"{dec(item.get('amount')):.2f}",
                item.get('legal_entity_name') or '',
                item.get('account_name') or '',
                item.get('category_label') or '',
                item.get('title') or '',
                item.get('counterparty') or '',
                item.get('payment_method_label') or '',
                item.get('source_ref') or '',
                item.get('visit_id') or '',
                item.get('comment') or '',
            ])
        return response
