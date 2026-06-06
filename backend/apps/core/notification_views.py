import json
from datetime import timedelta
from decimal import Decimal

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    InventoryItem,
    OrderPart,
    Visit,
    CRMTask,
    VehicleRecommendation,
    CRMServiceReminder,
)
from .safe_crm_views import safe_ensure_company


ACTIVE_ORDER_STATUSES = ['SELECTION', 'PENDING', 'DRAFT', 'ORDERED', 'IN_PROGRESS', 'DONE', 'SHIPPED']
CLOSED_STATUSES = ['COMPLETED', 'CANCELLED']
PAYMENT_DUE_STATUSES = ['unpaid', 'prepaid', 'cod', 'debt']
PART_WAITING_STATUSES = ['WAITING', 'ORDERED', 'IN_TRANSIT', 'ROAD', 'DELIVERY']


def money(value):
    try:
        return float(Decimal(str(value or 0)))
    except Exception:
        return 0.0


def safe_int(value, default=0):
    try:
        return int(value or default)
    except Exception:
        return default


def normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    return digits or 'no-phone'


def client_debt_url(visit):
    key = normalize_phone(getattr(visit, 'phone', ''))
    return f'/clients?key={key}&tab=debts&order_id={visit.id}'


def order_url(visit, tab=''):
    base = f'/visits?visit_id={visit.id}'
    return f'{base}&tab={tab}' if tab else base


def delivery_json(visit):
    raw = getattr(visit, 'delivery_data', None)
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return {}


def visit_total(visit):
    parts_total = sum(money(p.sell_price) * money(p.quantity or 1) for p in getattr(visit, 'parts', []).all())
    services_total = sum(money(s.price) * money(s.quantity or 1) for s in getattr(visit, 'services', []).all())
    return round(parts_total + services_total, 2)


def section(key, title, count=0, severity='info', url='/', items=None, amount=None, subtitle=''):
    return {
        'key': key,
        'title': title,
        'count': int(count or 0),
        'severity': severity,
        'url': url,
        'amount': round(float(amount or 0), 2),
        'subtitle': subtitle,
        'items': items or [],
    }


def get_inventory_extra(item_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT reserved_quantity, min_quantity FROM core_inventoryitem WHERE id=%s', [item_id])
            row = cursor.fetchone()
        return row or (0, 0)
    except Exception:
        return (0, 0)


def build_low_stock(company):
    items = []
    queryset = InventoryItem.objects.filter(company=company).select_related('supplier', 'category').order_by('quantity', 'brand')[:300]
    for item in queryset:
        reserved, min_quantity = get_inventory_extra(item.id)
        available = max(safe_int(item.quantity) - safe_int(reserved), 0)
        min_q = safe_int(min_quantity)
        if available <= min_q:
            items.append({
                'id': item.id,
                'type': 'inventory',
                'title': f'{item.brand} {item.article}',
                'subtitle': f'Доступно {available}, резерв {safe_int(reserved)}, мінімум {min_q}',
                'meta': item.name,
                'url': f'/inventory?item={item.id}',
            })
    return section('low_stock', 'Закінчується товар', len(items), 'warning' if items else 'info', '/inventory?filter=restock', items[:8], subtitle='Товари, де доступно менше або дорівнює мінімуму')


def build_debts(company):
    items = []
    total_debt = 0
    visits = Visit.objects.filter(company=company).exclude(status='CANCELLED').prefetch_related('parts', 'services').order_by('-created_at')[:500]
    for visit in visits:
        payment_status = str(visit.payment_status or '').lower()
        if payment_status not in ['unpaid', 'debt', 'cod', 'prepaid']:
            continue
        total = visit_total(visit)
        prepay = money(getattr(visit, 'prepayment_amount', 0))
        debt = max(total - prepay, 0)
        if debt <= 0:
            continue
        total_debt += debt
        key = normalize_phone(visit.phone)
        items.append({
            'id': visit.id,
            'type': 'client_debt',
            'client_key': key,
            'visit_id': visit.id,
            'title': f'№{visit.id} • {visit.client}',
            'subtitle': f'{visit.phone or "—"} • борг {debt:,.2f} ₴'.replace(',', ' '),
            'meta': getattr(visit, 'plate', '') or '',
            'url': client_debt_url(visit),
            'order_url': order_url(visit),
            'amount': round(debt, 2),
        })
    return section('debts', 'Є борги', len(items), 'critical' if total_debt > 0 else 'info', '/clients?filter=debt', items[:8], total_debt, 'Клієнти або замовлення з незакритою сумою')


def build_payment_due(company):
    items = []
    total_due = 0
    visits = Visit.objects.filter(company=company, status__in=ACTIVE_ORDER_STATUSES).prefetch_related('parts', 'services').order_by('-created_at')[:500]
    for visit in visits:
        payment_status = str(visit.payment_status or '').lower()
        if payment_status not in PAYMENT_DUE_STATUSES:
            continue
        total = visit_total(visit)
        prepay = money(getattr(visit, 'prepayment_amount', 0))
        due = max(total - prepay, 0)
        if due <= 0 and payment_status != 'cod':
            continue
        total_due += due
        items.append({
            'id': visit.id,
            'type': 'order_payment',
            'visit_id': visit.id,
            'client_key': normalize_phone(visit.phone),
            'title': f'№{visit.id} • {visit.client}',
            'subtitle': f'{payment_status or "оплата"} • залишок {due:,.2f} ₴'.replace(',', ' '),
            'meta': getattr(visit, 'phone', '') or '',
            'url': order_url(visit),
            'client_url': client_debt_url(visit),
            'amount': round(due, 2),
        })
    return section('payment_due', 'Очікує оплати', len(items), 'warning' if items else 'info', '/visits?filter=payment_due', items[:8], total_due, 'Активні замовлення, де оплата ще не закрита')


def build_overdue_orders(company, is_store):
    now = timezone.now()
    items = []
    visits = Visit.objects.filter(company=company).exclude(status__in=CLOSED_STATUSES).prefetch_related('parts').order_by('-created_at')[:500]
    for visit in visits:
        status = str(visit.status or '')
        age_days = (now - (visit.created_at or now)).days
        scheduled = visit.scheduled_datetime
        overdue = False
        reason = ''
        if is_store:
            if status in ['ORDERED', 'IN_PROGRESS'] and age_days >= 2:
                overdue = True
                reason = f'В роботі {age_days} дн.'
            if status == 'DONE' and age_days >= 1:
                overdue = True
                reason = f'Готове {age_days} дн.'
        else:
            if scheduled and scheduled < now and status not in ['DONE', 'COMPLETED', 'CANCELLED']:
                overdue = True
                reason = 'Прострочений запис'
        if overdue:
            first_part = visit.parts.all()[0] if visit.parts.exists() else None
            title = f'№{visit.id} • {visit.client}'
            if first_part:
                title = f'№{visit.id} • {first_part.brand} {first_part.article}'
            items.append({
                'id': visit.id,
                'type': 'order',
                'visit_id': visit.id,
                'client_key': normalize_phone(visit.phone),
                'title': title,
                'subtitle': f'{reason} • {visit.client}',
                'meta': getattr(visit, 'phone', '') or '',
                'url': order_url(visit),
            })
    title = 'Прострочені замовлення' if is_store else 'Прострочені візити'
    return section('overdue_orders', title, len(items), 'critical' if items else 'info', '/visits?filter=overdue', items[:8], subtitle='Активні записи, які зависли довше норми')


def build_np_returns(company):
    items = []
    visits = Visit.objects.filter(company=company).exclude(status__in=CLOSED_STATUSES).order_by('-updated_at')[:500]
    for visit in visits:
        data = delivery_json(visit)
        delivery_status = str(data.get('delivery_status') or data.get('status') or '').lower()
        ttn = data.get('ttn') or data.get('tracking_number') or ''
        delivery_type = str(visit.delivery_type or data.get('delivery_type') or '').lower()
        is_np = 'nova' in delivery_type or 'нова' in delivery_type or 'np' in delivery_type or ttn
        is_return = 'return' in delivery_status or 'повер' in delivery_status or 'returned' in delivery_status
        if is_np and is_return:
            items.append({
                'id': visit.id,
                'type': 'order_delivery',
                'visit_id': visit.id,
                'client_key': normalize_phone(visit.phone),
                'title': f'№{visit.id} • {visit.client}',
                'subtitle': f'ТТН {ttn or "—"}',
                'meta': getattr(visit, 'phone', '') or '',
                'url': order_url(visit, 'delivery'),
            })
    return section('np_returns', 'Повернення Новою поштою', len(items), 'critical' if items else 'info', '/visits?filter=np_return', items[:8], subtitle='Відправлення, які повертаються або повернуті')


def build_parts_in_transit(company):
    threshold = timezone.now() - timedelta(days=3)
    items = []
    visits = Visit.objects.filter(company=company, created_at__lte=threshold).exclude(status__in=CLOSED_STATUSES).prefetch_related('parts').order_by('-created_at')[:500]
    for visit in visits:
        waiting_parts = [p for p in visit.parts.all() if str(p.status or '').upper() in PART_WAITING_STATUSES]
        if not waiting_parts:
            continue
        first = waiting_parts[0]
        days = (timezone.now() - visit.created_at).days
        items.append({
            'id': visit.id,
            'type': 'order_part_delay',
            'visit_id': visit.id,
            'part_id': first.id,
            'client_key': normalize_phone(visit.phone),
            'title': f'№{visit.id} • {first.brand} {first.article}',
            'subtitle': f'Очікує {days} дн. • {visit.client}',
            'meta': first.name,
            'url': order_url(visit, 'parts'),
        })
    return section('parts_in_transit', 'Товар у дорозі більше 3 днів', len(items), 'warning' if items else 'info', '/visits?filter=parts_delay', items[:8], subtitle='Замовлення з деталями, які довго не отримані')


def build_sto_tasks(company):
    today = timezone.localdate()
    overdue_tasks = CRMTask.objects.filter(company=company, due_date__lt=today).exclude(status__in=['done', 'DONE']).order_by('due_date')[:8]
    items = [{
        'id': task.id,
        'type': 'crm_task',
        'title': task.title,
        'subtitle': f'{task.client or task.phone or "Клієнт"} • до {task.due_date}',
        'meta': task.plate or '',
        'url': '/crm/tasks',
    } for task in overdue_tasks]
    return section('crm_tasks', 'Прострочені задачі CRM', len(items), 'warning' if items else 'info', '/crm/tasks', items, subtitle='Задачі, які треба закрити')


def build_sto_reminders(company):
    today = timezone.localdate()
    soon = today + timedelta(days=7)
    reminders = CRMServiceReminder.objects.filter(company=company, status='active', due_date__lte=soon).order_by('due_date')[:8]
    items = [{
        'id': r.id,
        'type': 'service_reminder',
        'title': r.title or r.get_reminder_type_display(),
        'subtitle': f'{r.client or r.phone or "Клієнт"} • {r.due_date or "без дати"}',
        'meta': r.plate or '',
        'url': '/crm/follow-ups',
    } for r in reminders]
    return section('service_reminders', 'Сервісні нагадування', len(items), 'warning' if items else 'info', '/crm/follow-ups', items, subtitle='Клієнти, яких скоро треба повернути')


def build_sto_recommendations(company):
    today = timezone.localdate()
    soon = today + timedelta(days=7)
    recs = VehicleRecommendation.objects.filter(company=company, status='active', due_date__lte=soon).order_by('due_date')[:8]
    items = [{
        'id': rec.id,
        'type': 'recommendation',
        'title': rec.title,
        'subtitle': f'{rec.client or rec.phone or "Клієнт"} • {rec.due_date or "без дати"}',
        'meta': rec.plate or '',
        'url': '/crm/recommendations',
    } for rec in recs]
    return section('recommendations', 'Рекомендації скоро', len(items), 'warning' if items else 'info', '/crm/recommendations', items, subtitle='Рекомендації, які пора пропонувати клієнтам')


class NotificationsSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'total': 0, 'critical': 0, 'warning': 0, 'info': 0, 'sections': []})

        is_store = getattr(company, 'business_type', 'sto') == 'store'
        sections = [build_low_stock(company), build_debts(company), build_payment_due(company), build_overdue_orders(company, is_store)]
        if is_store:
            sections.extend([build_np_returns(company), build_parts_in_transit(company)])
        else:
            sections.extend([build_sto_tasks(company), build_sto_reminders(company), build_sto_recommendations(company)])

        active_sections = [s for s in sections if s.get('count', 0) > 0]
        total = sum(s.get('count', 0) for s in active_sections)
        payload = {
            'business_type': getattr(company, 'business_type', 'sto'),
            'total': total,
            'critical': sum(s.get('count', 0) for s in active_sections if s.get('severity') == 'critical'),
            'warning': sum(s.get('count', 0) for s in active_sections if s.get('severity') == 'warning'),
            'info': sum(s.get('count', 0) for s in active_sections if s.get('severity') == 'info'),
            'sections': sections,
            'active_sections': active_sections,
            'generated_at': timezone.now().isoformat(),
        }
        return Response(payload)
