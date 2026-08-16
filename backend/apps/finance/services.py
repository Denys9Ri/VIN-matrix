from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import connection, transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.core.models import Employee, OrderPart, OrderService, StoExpense, Supplier, Visit
from apps.core.safe_crm_views import safe_ensure_company

from .models import (
    FinanceAccount,
    FinanceChangeLog,
    FinanceSourceAllocation,
    FinanceTransaction,
    LegalEntity,
    VisitFinanceAssignment,
)


ZERO = Decimal('0.00')
CENT = Decimal('0.01')

PAYMENT_METHOD_LABELS = {
    'cash': 'Готівка',
    'card': 'Картка',
    'transfer': 'Переказ',
    'terminal': 'Термінал',
    'bank': 'Рахунок / банк',
    'other': 'Інше',
}

FINANCE_CATEGORIES = [
    {'key': 'revenue', 'label': 'Надходження від клієнтів'},
    {'key': 'salary', 'label': 'Виплата зарплати'},
    {'key': 'supplier', 'label': 'Оплата постачальнику'},
    {'key': 'rent', 'label': 'Оренда'},
    {'key': 'utilities', 'label': 'Комунальні'},
    {'key': 'taxes', 'label': 'Податки'},
    {'key': 'equipment', 'label': 'Обладнання / інструмент'},
    {'key': 'consumables', 'label': 'Витратні матеріали'},
    {'key': 'marketing', 'label': 'Маркетинг'},
    {'key': 'delivery', 'label': 'Доставка / логістика'},
    {'key': 'fuel', 'label': 'Пальне'},
    {'key': 'software', 'label': 'Програми / підписки'},
    {'key': 'bank_fees', 'label': 'Банківські комісії'},
    {'key': 'owner', 'label': 'Власник / внесення коштів'},
    {'key': 'refund', 'label': 'Повернення'},
    {'key': 'adjustment', 'label': 'Коригування'},
    {'key': 'other', 'label': 'Інше'},
]


def dec(value):
    try:
        return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        return ZERO


def number(value):
    return float(dec(value))


def iso_datetime(value):
    if not value:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except Exception:
            return value
    try:
        if timezone.is_naive(value):
            value = timezone.make_aware(value, timezone.get_current_timezone())
        return value.isoformat()
    except Exception:
        return str(value)


def local_dt(value):
    if not value:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except Exception:
            return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return value


def ensure_finance_company(user):
    company = safe_ensure_company(user)
    if not company:
        raise PermissionDenied('Компанію не знайдено.')

    try:
        employee = user.employee_profile
    except Exception:
        employee = None

    if employee and employee.company_id == company.id and not employee.can_view_finances:
        raise PermissionDenied('Немає доступу до фінансів.')
    return company


def record_change(company, user, object_type, object_id, action, before=None, after=None, reason=''):
    try:
        FinanceChangeLog.objects.create(
            company=company,
            object_type=object_type,
            object_id=str(object_id),
            action=action,
            before=before or {},
            after=after or {},
            reason=(reason or '').strip(),
            changed_by=user if getattr(user, 'is_authenticated', False) else None,
        )
    except Exception:
        pass


def legal_entity_payload(entity):
    if not entity:
        return None
    return {
        'id': entity.id,
        'entity_type': entity.entity_type,
        'entity_type_label': entity.get_entity_type_display(),
        'name': entity.name,
        'tax_id': entity.tax_id,
        'registration_code': entity.registration_code,
        'iban': entity.iban,
        'bank_name': entity.bank_name,
        'requisites': entity.requisites,
        'is_primary': entity.is_primary,
        'is_default_for_parts': entity.is_default_for_parts,
        'is_default_for_services': entity.is_default_for_services,
        'is_active': entity.is_active,
        'sort_order': entity.sort_order,
    }


def account_payload(account, balance=None):
    if not account:
        return None
    payload = {
        'id': account.id,
        'legal_entity_id': account.legal_entity_id,
        'legal_entity_name': account.legal_entity.name if account.legal_entity_id else '',
        'name': account.name,
        'account_type': account.account_type,
        'account_type_label': account.get_account_type_display(),
        'currency': account.currency,
        'iban': account.iban,
        'bank_name': account.bank_name,
        'opening_balance': number(account.opening_balance),
        'is_primary': account.is_primary,
        'is_active': account.is_active,
        'sort_order': account.sort_order,
    }
    if balance is not None:
        payload['balance'] = number(balance)
    return payload


def transaction_snapshot(item):
    return {
        'id': item.id,
        'kind': item.kind,
        'source_type': item.source_type,
        'occurred_at': iso_datetime(item.occurred_at),
        'amount': number(item.amount),
        'legal_entity_id': item.legal_entity_id,
        'account_id': item.account_id,
        'target_account_id': item.target_account_id,
        'category': item.category,
        'title': item.title,
        'counterparty': item.counterparty,
        'employee_id': item.employee_id,
        'supplier_id': item.supplier_id,
        'payment_method': item.payment_method,
        'comment': item.comment,
    }


@transaction.atomic
def bootstrap_company_finance(company, user=None):
    active = list(LegalEntity.objects.filter(company=company, is_active=True).order_by('sort_order', 'id'))
    if not active:
        entity = LegalEntity.objects.create(
            company=company,
            entity_type=LegalEntity.TYPE_FOP,
            name=company.name or 'Основний ФОП / ТОВ',
            is_primary=True,
            is_default_for_parts=True,
            is_default_for_services=True,
            sort_order=10,
        )
        active = [entity]
        record_change(company, user, 'legal_entity', entity.id, FinanceChangeLog.ACTION_CREATE, after=legal_entity_payload(entity), reason='Автоматичне початкове налаштування')

    primary = next((item for item in active if item.is_primary), None) or active[0]
    if not primary.is_primary:
        primary.is_primary = True
        primary.save(update_fields=['is_primary', 'updated_at'])

    if not any(item.is_default_for_parts for item in active):
        primary.is_default_for_parts = True
        primary.save(update_fields=['is_default_for_parts', 'updated_at'])
    if not any(item.is_default_for_services for item in active):
        primary.is_default_for_services = True
        primary.save(update_fields=['is_default_for_services', 'updated_at'])

    for entity in active:
        accounts = list(FinanceAccount.objects.filter(company=company, legal_entity=entity, is_active=True))
        if not accounts:
            FinanceAccount.objects.create(
                company=company,
                legal_entity=entity,
                name='Каса',
                account_type=FinanceAccount.TYPE_CASH,
                is_primary=True,
                sort_order=10,
            )
            FinanceAccount.objects.create(
                company=company,
                legal_entity=entity,
                name='Основний рахунок',
                account_type=FinanceAccount.TYPE_BANK,
                iban=entity.iban,
                bank_name=entity.bank_name,
                sort_order=20,
            )
        elif not any(item.is_primary for item in accounts):
            account = accounts[0]
            account.is_primary = True
            account.save(update_fields=['is_primary', 'updated_at'])

    return list(LegalEntity.objects.filter(company=company, is_active=True).order_by('sort_order', '-is_primary', 'id'))


def primary_entity(company):
    bootstrap_company_finance(company)
    return (
        LegalEntity.objects.filter(company=company, is_active=True, is_primary=True).order_by('sort_order', 'id').first()
        or LegalEntity.objects.filter(company=company, is_active=True).order_by('sort_order', 'id').first()
    )


def default_entity(company, purpose):
    bootstrap_company_finance(company)
    field = 'is_default_for_parts' if purpose == 'parts' else 'is_default_for_services'
    return (
        LegalEntity.objects.filter(company=company, is_active=True, **{field: True}).order_by('sort_order', 'id').first()
        or primary_entity(company)
    )


def pick_account(company, entity, payment_method='cash'):
    bootstrap_company_finance(company)
    qs = FinanceAccount.objects.filter(company=company, is_active=True)
    if entity:
        qs = qs.filter(legal_entity=entity)
    preferred = {
        'cash': [FinanceAccount.TYPE_CASH],
        'card': [FinanceAccount.TYPE_CARD, FinanceAccount.TYPE_BANK, FinanceAccount.TYPE_TERMINAL],
        'terminal': [FinanceAccount.TYPE_TERMINAL, FinanceAccount.TYPE_BANK, FinanceAccount.TYPE_CARD],
        'transfer': [FinanceAccount.TYPE_BANK, FinanceAccount.TYPE_CARD],
        'bank': [FinanceAccount.TYPE_BANK, FinanceAccount.TYPE_CARD],
    }.get(payment_method or '', [])
    for account_type in preferred:
        item = qs.filter(account_type=account_type).order_by('-is_primary', 'sort_order', 'id').first()
        if item:
            return item
    return qs.order_by('-is_primary', 'sort_order', 'id').first()


def period_bounds(period='30d', date_from=None, date_to=None):
    today = timezone.localdate()
    if period == 'today':
        start_date = end_date = today
        label = 'Сьогодні'
    elif period == '7d':
        start_date, end_date, label = today - timedelta(days=6), today, '7 днів'
    elif period == 'this_month':
        start_date, end_date, label = today.replace(day=1), today, 'Цей місяць'
    elif period == 'last_month':
        current = today.replace(day=1)
        end_date = current - timedelta(days=1)
        start_date = end_date.replace(day=1)
        label = 'Минулий місяць'
    elif period == 'all':
        return {'key': 'all', 'label': 'Весь час', 'start_at': None, 'end_at': None, 'date_from': None, 'date_to': None}
    elif period == 'custom':
        def parse_date(value, fallback):
            try:
                return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
            except Exception:
                return fallback
        start_date = parse_date(date_from, today - timedelta(days=29))
        end_date = parse_date(date_to, today)
        if end_date < start_date:
            start_date, end_date = end_date, start_date
        label = 'Свій період'
    else:
        period = '30d'
        start_date, end_date, label = today - timedelta(days=29), today, '30 днів'

    start_naive = datetime.combine(start_date, datetime.min.time())
    end_naive = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    tz = timezone.get_current_timezone()
    return {
        'key': period,
        'label': label,
        'start_at': timezone.make_aware(start_naive, tz),
        'end_at': timezone.make_aware(end_naive, tz),
        'date_from': start_date.isoformat(),
        'date_to': end_date.isoformat(),
    }


def in_bounds(value, bounds):
    value = local_dt(value)
    if not value:
        return False
    if bounds.get('start_at') and value < bounds['start_at']:
        return False
    if bounds.get('end_at') and value >= bounds['end_at']:
        return False
    return True


def raw_payments(company):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT id, visit_id, amount, payment_type, payment_purpose, comment, created_at, created_by_id '
                'FROM core_visitpayment WHERE company_id=%s ORDER BY created_at DESC, id DESC',
                [company.id],
            )
            rows = cursor.fetchall()
    except Exception:
        return []
    return [
        {
            'id': row[0],
            'visit_id': row[1],
            'amount': dec(row[2]),
            'payment_type': row[3] or 'cash',
            'payment_purpose': row[4] or 'partial',
            'comment': row[5] or '',
            'created_at': row[6],
            'created_by_id': row[7],
        }
        for row in rows
    ]


def visit_totals(visit):
    parts_total = sum((dec(item.sell_price) * dec(item.quantity or 1) for item in visit.parts.all()), ZERO)
    services_total = sum((dec(item.price) * dec(item.quantity or 1) for item in visit.services.all()), ZERO)
    return parts_total.quantize(CENT), services_total.quantize(CENT)


def resolve_visit_assignment(company, visit):
    assignment = VisitFinanceAssignment.objects.filter(company=company, visit=visit).select_related('parts_legal_entity', 'services_legal_entity').first()
    parts_entity = assignment.parts_legal_entity if assignment and assignment.parts_legal_entity_id else default_entity(company, 'parts')
    services_entity = assignment.services_legal_entity if assignment and assignment.services_legal_entity_id else default_entity(company, 'services')
    return assignment, parts_entity, services_entity


def visit_assignment_payload(company, visit):
    assignment, parts_entity, services_entity = resolve_visit_assignment(company, visit)
    parts_total, services_total = visit_totals(visit)
    return {
        'id': assignment.id if assignment else None,
        'visit_id': visit.id,
        'client': visit.client or '',
        'phone': visit.phone or '',
        'plate': visit.plate or '',
        'status': visit.status or '',
        'updated_at': iso_datetime(visit.updated_at),
        'parts_total': number(parts_total),
        'services_total': number(services_total),
        'total': number(parts_total + services_total),
        'parts_legal_entity_id': parts_entity.id if parts_entity else None,
        'parts_legal_entity_name': parts_entity.name if parts_entity else '',
        'services_legal_entity_id': services_entity.id if services_entity else None,
        'services_legal_entity_name': services_entity.name if services_entity else '',
        'note': assignment.note if assignment else '',
        'is_custom': bool(assignment),
    }


def split_amount(total, weights):
    total = dec(total)
    clean = [(key, dec(value)) for key, value in weights if key and dec(value) > 0]
    weight_total = sum((value for _, value in clean), ZERO)
    if total <= 0 or not clean or weight_total <= 0:
        return []
    allocated = []
    used = ZERO
    for idx, (key, weight) in enumerate(clean):
        if idx == len(clean) - 1:
            amount = total - used
        else:
            amount = (total * weight / weight_total).quantize(CENT, rounding=ROUND_HALF_UP)
            used += amount
        allocated.append((key, amount))
    return allocated


def auto_payment_allocations(company, payment, visit):
    total = dec(payment['amount'])
    if total <= 0:
        return []
    if not visit:
        entity = primary_entity(company)
        return [{
            'id': None,
            'legal_entity': entity,
            'account': pick_account(company, entity, payment.get('payment_type')),
            'amount': total,
            'note': 'Автоматичний розподіл',
            'virtual': True,
        }]

    _, parts_entity, services_entity = resolve_visit_assignment(company, visit)
    parts_total, services_total = visit_totals(visit)
    weights = defaultdict(lambda: ZERO)
    entity_map = {}
    if parts_entity and parts_total > 0:
        weights[parts_entity.id] += parts_total
        entity_map[parts_entity.id] = parts_entity
    if services_entity and services_total > 0:
        weights[services_entity.id] += services_total
        entity_map[services_entity.id] = services_entity
    if not weights:
        entity = primary_entity(company)
        weights[entity.id] = Decimal('1.00')
        entity_map[entity.id] = entity

    return [
        {
            'id': None,
            'legal_entity': entity_map[entity_id],
            'account': pick_account(company, entity_map[entity_id], payment.get('payment_type')),
            'amount': amount,
            'note': 'Автоматично за розподілом запчастини / роботи',
            'virtual': True,
        }
        for entity_id, amount in split_amount(total, weights.items())
    ]


def auto_expense_allocations(company, expense):
    entity = primary_entity(company)
    return [{
        'id': None,
        'legal_entity': entity,
        'account': pick_account(company, entity, expense.payment_method),
        'amount': dec(expense.amount),
        'note': 'Автоматичний розподіл витрати',
        'virtual': True,
    }]


def stored_or_auto_allocations(company, source_type, source_id, source_amount, auto_rows):
    stored = list(
        FinanceSourceAllocation.objects.filter(company=company, source_type=source_type, source_id=source_id)
        .select_related('legal_entity', 'account')
        .order_by('id')
    )
    if not stored:
        return auto_rows

    total = sum((dec(item.amount) for item in stored), ZERO)
    expected = dec(source_amount)
    if total != expected:
        # Старі або частково відредаговані дані не повинні губити гроші.
        # До збереження коректного розподілу показуємо надійний автоматичний варіант.
        return auto_rows

    return [
        {
            'id': item.id,
            'legal_entity': item.legal_entity,
            'account': item.account or pick_account(company, item.legal_entity),
            'amount': dec(item.amount),
            'note': item.note,
            'virtual': False,
        }
        for item in stored
    ]


def ledger_row(
    *,
    row_id,
    direction,
    amount,
    occurred_at,
    legal_entity=None,
    account=None,
    target_account=None,
    title='',
    category='',
    category_label='',
    source_type='',
    source_id=None,
    source_ref='',
    visit=None,
    payment_method='',
    counterparty='',
    employee_id=None,
    supplier_id=None,
    comment='',
    editable=False,
    virtual=False,
    payload=None,
):
    return {
        'id': row_id,
        'direction': direction,
        'amount': number(amount),
        'occurred_at': iso_datetime(occurred_at),
        'legal_entity_id': legal_entity.id if legal_entity else None,
        'legal_entity_name': legal_entity.name if legal_entity else 'Без юрособи',
        'account_id': account.id if account else None,
        'account_name': account.name if account else 'Без рахунку',
        'target_account_id': target_account.id if target_account else None,
        'target_account_name': target_account.name if target_account else '',
        'title': title,
        'category': category,
        'category_label': category_label or category or 'Інше',
        'source_type': source_type,
        'source_id': source_id,
        'source_ref': source_ref,
        'visit_id': visit.id if visit else None,
        'client': visit.client if visit else '',
        'plate': visit.plate if visit else '',
        'payment_method': payment_method,
        'payment_method_label': PAYMENT_METHOD_LABELS.get(payment_method, payment_method or ''),
        'counterparty': counterparty,
        'employee_id': employee_id,
        'supplier_id': supplier_id,
        'comment': comment or '',
        'editable': editable,
        'virtual_allocation': virtual,
        'source_payload': payload or {},
    }


def build_ledger(company, bounds=None, legal_entity_id=None, all_time=False):
    bootstrap_company_finance(company)
    if all_time:
        bounds = {'start_at': None, 'end_at': None}
    bounds = bounds or period_bounds('30d')
    rows = []

    payments = [item for item in raw_payments(company) if in_bounds(item['created_at'], bounds)]
    visit_ids = {item['visit_id'] for item in payments if item.get('visit_id')}
    visits = {
        item.id: item
        for item in Visit.objects.filter(company=company, id__in=visit_ids)
        .prefetch_related(
            Prefetch('parts', queryset=OrderPart.objects.order_by('id')),
            Prefetch('services', queryset=OrderService.objects.order_by('id')),
        )
    }

    for payment in payments:
        visit = visits.get(payment.get('visit_id'))
        auto = auto_payment_allocations(company, payment, visit)
        allocations = stored_or_auto_allocations(
            company,
            FinanceSourceAllocation.SOURCE_VISIT_PAYMENT,
            payment['id'],
            payment['amount'],
            auto,
        )
        for allocation in allocations:
            entity = allocation['legal_entity']
            if legal_entity_id and entity and entity.id != legal_entity_id:
                continue
            account = allocation['account'] or pick_account(company, entity, payment.get('payment_type'))
            rows.append(ledger_row(
                row_id=f"payment-{payment['id']}-{allocation['id'] or entity.id if entity else 'x'}",
                direction='income',
                amount=allocation['amount'],
                occurred_at=payment['created_at'],
                legal_entity=entity,
                account=account,
                title=f"Оплата замовлення №{visit.id}" if visit else f"Оплата №{payment['id']}",
                category='revenue',
                category_label='Оплата клієнта',
                source_type='visit_payment',
                source_id=payment['id'],
                source_ref=f"visit_payment:{payment['id']}",
                visit=visit,
                payment_method=payment.get('payment_type') or 'cash',
                counterparty=visit.client if visit else '',
                comment=payment.get('comment') or '',
                editable=True,
                virtual=allocation['virtual'],
                payload={
                    'payment_purpose': payment.get('payment_purpose'),
                    'payment_total': number(payment['amount']),
                    'allocation_note': allocation.get('note') or '',
                },
            ))

    expenses_qs = StoExpense.objects.filter(company=company).select_related('created_by').order_by('-date', '-id')
    for expense in expenses_qs:
        occurred_at = timezone.make_aware(datetime.combine(expense.date, datetime.min.time()), timezone.get_current_timezone())
        if not in_bounds(occurred_at, bounds):
            continue
        auto = auto_expense_allocations(company, expense)
        allocations = stored_or_auto_allocations(
            company,
            FinanceSourceAllocation.SOURCE_EXPENSE,
            expense.id,
            expense.amount,
            auto,
        )
        for allocation in allocations:
            entity = allocation['legal_entity']
            if legal_entity_id and entity and entity.id != legal_entity_id:
                continue
            account = allocation['account'] or pick_account(company, entity, expense.payment_method)
            rows.append(ledger_row(
                row_id=f"expense-{expense.id}-{allocation['id'] or entity.id if entity else 'x'}",
                direction='expense',
                amount=allocation['amount'],
                occurred_at=occurred_at,
                legal_entity=entity,
                account=account,
                title=expense.title,
                category=expense.category,
                category_label=expense.get_category_display(),
                source_type='expense',
                source_id=expense.id,
                source_ref=f"expense:{expense.id}",
                payment_method=expense.payment_method,
                counterparty='',
                comment=expense.comment or '',
                editable=True,
                virtual=allocation['virtual'],
                payload={
                    'date': expense.date.isoformat(),
                    'amount': number(expense.amount),
                    'title': expense.title,
                    'category': expense.category,
                    'payment_method': expense.payment_method,
                    'comment': expense.comment or '',
                    'is_recurring': expense.is_recurring,
                    'recurring_period': expense.recurring_period,
                    'allocation_note': allocation.get('note') or '',
                },
            ))

    manual_qs = (
        FinanceTransaction.objects.filter(company=company)
        .select_related('legal_entity', 'account', 'target_account', 'employee__user', 'supplier')
        .order_by('-occurred_at', '-id')
    )
    for item in manual_qs:
        if not in_bounds(item.occurred_at, bounds):
            continue
        if legal_entity_id:
            source_match = item.legal_entity_id == legal_entity_id
            target_match = item.target_account_id and item.target_account and item.target_account.legal_entity_id == legal_entity_id
            if not source_match and not target_match:
                continue
        employee_name = ''
        if item.employee_id and item.employee and item.employee.user:
            employee_name = f'{item.employee.user.first_name} {item.employee.user.last_name}'.strip() or item.employee.user.username
        supplier_name = item.supplier.name if item.supplier_id and item.supplier else ''
        category_label = dict(FinanceTransaction.SOURCE_CHOICES).get(item.source_type, item.source_type)
        rows.append(ledger_row(
            row_id=f'manual-{item.id}',
            direction=item.kind,
            amount=item.amount,
            occurred_at=item.occurred_at,
            legal_entity=item.legal_entity,
            account=item.account,
            target_account=item.target_account,
            title=item.title,
            category=item.category,
            category_label=category_label,
            source_type='manual_transaction',
            source_id=item.id,
            source_ref=f'manual_transaction:{item.id}',
            payment_method=item.payment_method,
            counterparty=item.counterparty or employee_name or supplier_name,
            employee_id=item.employee_id,
            supplier_id=item.supplier_id,
            comment=item.comment,
            editable=True,
            virtual=False,
            payload=transaction_snapshot(item),
        ))

    def sort_key(item):
        value = local_dt(item.get('occurred_at'))
        return value or timezone.make_aware(datetime.min.replace(year=1970), timezone.get_current_timezone())

    rows.sort(key=sort_key, reverse=True)
    return rows


def account_balances(company):
    bootstrap_company_finance(company)
    accounts = list(
        FinanceAccount.objects.filter(company=company, is_active=True)
        .select_related('legal_entity')
        .order_by('sort_order', '-is_primary', 'id')
    )
    balances = {item.id: dec(item.opening_balance) for item in accounts}
    rows = build_ledger(company, all_time=True)
    for row in rows:
        amount = dec(row['amount'])
        account_id = row.get('account_id')
        if row['direction'] == 'income' and account_id in balances:
            balances[account_id] += amount
        elif row['direction'] == 'expense' and account_id in balances:
            balances[account_id] -= amount
        elif row['direction'] == 'transfer':
            if account_id in balances:
                balances[account_id] -= amount
            target_id = row.get('target_account_id')
            if target_id in balances:
                balances[target_id] += amount
    return accounts, balances


def recent_visit_assignments(company, limit=40):
    visits = (
        Visit.objects.filter(company=company)
        .prefetch_related(
            Prefetch('parts', queryset=OrderPart.objects.order_by('id')),
            Prefetch('services', queryset=OrderService.objects.order_by('id')),
        )
        .order_by('-updated_at', '-id')[:limit]
    )
    return [visit_assignment_payload(company, visit) for visit in visits]


def finance_summary(company, bounds, legal_entity_id=None):
    bootstrap_company_finance(company)
    rows = build_ledger(company, bounds=bounds, legal_entity_id=legal_entity_id)
    income = sum((dec(item['amount']) for item in rows if item['direction'] == 'income'), ZERO)
    expense = sum((dec(item['amount']) for item in rows if item['direction'] == 'expense'), ZERO)
    cash_flow = income - expense

    accounts, balances = account_balances(company)
    if legal_entity_id:
        accounts = [item for item in accounts if item.legal_entity_id == legal_entity_id]
    total_balance = sum((balances.get(item.id, ZERO) for item in accounts), ZERO)
    cash_balance = sum((balances.get(item.id, ZERO) for item in accounts if item.account_type == FinanceAccount.TYPE_CASH), ZERO)
    non_cash_balance = total_balance - cash_balance

    entities = list(LegalEntity.objects.filter(company=company).order_by('sort_order', '-is_primary', 'id'))
    salary_by_employee = defaultdict(lambda: ZERO)
    supplier_by_id = defaultdict(lambda: ZERO)
    payment_channels = defaultdict(lambda: ZERO)
    for item in rows:
        if item['direction'] == 'income':
            payment_channels[item.get('payment_method') or 'other'] += dec(item['amount'])
        if item['direction'] == 'expense' and item.get('source_type') == 'manual_transaction':
            source_payload = item.get('source_payload') or {}
            if source_payload.get('source_type') == FinanceTransaction.SOURCE_SALARY and item.get('employee_id'):
                salary_by_employee[item['employee_id']] += dec(item['amount'])
            if source_payload.get('source_type') == FinanceTransaction.SOURCE_SUPPLIER and item.get('supplier_id'):
                supplier_by_id[item['supplier_id']] += dec(item['amount'])

    employee_items = []
    for employee in Employee.objects.filter(company=company).select_related('user').order_by('user__first_name', 'user__username'):
        name = f'{employee.user.first_name} {employee.user.last_name}'.strip() or employee.user.username
        employee_items.append({'id': employee.id, 'user_id': employee.user_id, 'name': name})

    supplier_items = [
        {'id': item.id, 'name': item.name}
        for item in Supplier.objects.filter(company=company, is_active=True).order_by('name', 'id')
    ]

    changes = [
        {
            'id': item.id,
            'object_type': item.object_type,
            'object_id': item.object_id,
            'action': item.action,
            'action_label': item.get_action_display(),
            'reason': item.reason,
            'changed_by': (item.changed_by.first_name or item.changed_by.username) if item.changed_by_id else '',
            'created_at': iso_datetime(item.created_at),
        }
        for item in FinanceChangeLog.objects.filter(company=company).select_related('changed_by').order_by('-created_at', '-id')[:40]
    ]

    return {
        'period': {
            'key': bounds.get('key'),
            'label': bounds.get('label'),
            'date_from': bounds.get('date_from'),
            'date_to': bounds.get('date_to'),
        },
        'summary': {
            'income': number(income),
            'expense': number(expense),
            'cash_flow': number(cash_flow),
            'total_balance': number(total_balance),
            'cash_balance': number(cash_balance),
            'non_cash_balance': number(non_cash_balance),
            'transactions_count': len(rows),
            'virtual_allocations_count': sum(1 for item in rows if item.get('virtual_allocation')),
        },
        'entities': [legal_entity_payload(item) for item in entities],
        'accounts': [account_payload(item, balances.get(item.id, ZERO)) for item in accounts],
        'transactions': rows[:700],
        'recent_visits': recent_visit_assignments(company),
        'salary_payouts_by_employee': {str(key): number(value) for key, value in salary_by_employee.items()},
        'supplier_payouts_by_supplier': {str(key): number(value) for key, value in supplier_by_id.items()},
        'payment_channels': [
            {'key': key, 'label': PAYMENT_METHOD_LABELS.get(key, key), 'amount': number(value)}
            for key, value in sorted(payment_channels.items(), key=lambda pair: pair[1], reverse=True)
        ],
        'changes': changes,
        'meta': {
            'entity_types': [{'key': key, 'label': label} for key, label in LegalEntity.TYPE_CHOICES],
            'account_types': [{'key': key, 'label': label} for key, label in FinanceAccount.TYPE_CHOICES],
            'transaction_kinds': [{'key': key, 'label': label} for key, label in FinanceTransaction.KIND_CHOICES],
            'transaction_sources': [{'key': key, 'label': label} for key, label in FinanceTransaction.SOURCE_CHOICES],
            'payment_methods': [{'key': key, 'label': label} for key, label in PAYMENT_METHOD_LABELS.items()],
            'categories': FINANCE_CATEGORIES,
            'employees': employee_items,
            'suppliers': supplier_items,
        },
    }


def source_descriptor(company, source_type, source_id):
    if source_type == FinanceSourceAllocation.SOURCE_VISIT_PAYMENT:
        payment = next((item for item in raw_payments(company) if int(item['id']) == int(source_id)), None)
        if not payment:
            return None
        visit = (
            Visit.objects.filter(company=company, id=payment.get('visit_id'))
            .prefetch_related('parts', 'services')
            .first()
        )
        return {
            'source_type': source_type,
            'source_id': int(source_id),
            'amount': dec(payment['amount']),
            'payment_method': payment.get('payment_type') or 'cash',
            'title': f"Оплата замовлення №{visit.id}" if visit else f"Оплата №{source_id}",
            'visit': visit,
            'auto': auto_payment_allocations(company, payment, visit),
        }
    if source_type == FinanceSourceAllocation.SOURCE_EXPENSE:
        expense = StoExpense.objects.filter(company=company, id=source_id).first()
        if not expense:
            return None
        return {
            'source_type': source_type,
            'source_id': int(source_id),
            'amount': dec(expense.amount),
            'payment_method': expense.payment_method,
            'title': expense.title,
            'visit': None,
            'expense': expense,
            'auto': auto_expense_allocations(company, expense),
        }
    return None


def source_allocations_payload(company, source_type, source_id):
    descriptor = source_descriptor(company, source_type, source_id)
    if not descriptor:
        return None
    stored = list(
        FinanceSourceAllocation.objects.filter(company=company, source_type=source_type, source_id=source_id)
        .select_related('legal_entity', 'account')
        .order_by('id')
    )
    rows = stored if stored else descriptor['auto']
    payload_rows = []
    for item in rows:
        if isinstance(item, FinanceSourceAllocation):
            entity, account, amount, note, row_id, virtual = item.legal_entity, item.account, item.amount, item.note, item.id, False
        else:
            entity, account, amount, note, row_id, virtual = item['legal_entity'], item['account'], item['amount'], item.get('note') or '', None, True
        payload_rows.append({
            'id': row_id,
            'legal_entity_id': entity.id if entity else None,
            'legal_entity_name': entity.name if entity else '',
            'account_id': account.id if account else None,
            'account_name': account.name if account else '',
            'amount': number(amount),
            'note': note,
            'virtual': virtual,
        })
    return {
        'source_type': source_type,
        'source_id': int(source_id),
        'title': descriptor['title'],
        'amount': number(descriptor['amount']),
        'payment_method': descriptor['payment_method'],
        'visit_id': descriptor['visit'].id if descriptor.get('visit') else None,
        'allocations': payload_rows,
    }
