from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    InventoryItem,
    OrderPart,
    Visit,
    VehicleRecommendation,
)
from .notification_views import (
    build_low_stock,
    build_np_cod_waiting,
    build_np_received,
    build_np_returns,
    build_parts_in_transit,
)
from .safe_crm_views import safe_ensure_company


CLOSED_STATUSES = ['COMPLETED', 'CANCELLED']
DEBT_PAYMENT_STATUSES = ['unpaid', 'prepaid', 'cod', 'debt']
ACTIVE_ORDER_STATUSES = ['SELECTION', 'PENDING', 'DRAFT', 'ORDERED', 'IN_PROGRESS', 'DONE', 'SHIPPED']


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


def round_money(value):
    return round(float(value or 0), 2)


def local_start_of_day(date_value):
    naive = timezone.datetime.combine(date_value, timezone.datetime.min.time())
    return timezone.make_aware(naive, timezone.get_current_timezone())


def visit_parts_total(visit):
    total = 0
    for part in getattr(visit, 'parts', []).all():
        total += money(part.sell_price) * (money(part.quantity) or 1)
    return total


def visit_services_total(visit):
    total = 0
    for service in getattr(visit, 'services', []).all():
        total += money(service.price) * (money(service.quantity) or 1)
    return total


def visit_total(visit):
    return visit_parts_total(visit) + visit_services_total(visit)


def visit_parts_profit(visit):
    profit = 0
    for part in getattr(visit, 'parts', []).all():
        qty = money(part.quantity) or 1
        profit += (money(part.sell_price) - money(part.buy_price)) * qty
    return profit


def visit_services_profit(visit):
    """
    У першій версії вважаємо роботи/послуги як прибуток,
    бо собівартість роботи майстрів окремо ще не ведеться.
    """
    return visit_services_total(visit)


def visit_profit(visit):
    return visit_parts_profit(visit) + visit_services_profit(visit)


def serialize_visit_task(visit):
    return {
        'id': visit.id,
        'visit_id': visit.id,
        'plate': visit.plate or '',
        'client': visit.client or '',
        'phone': visit.phone or '',
        'status': visit.status or '',
        'scheduled_datetime': visit.scheduled_datetime.isoformat() if visit.scheduled_datetime else None,
        'created_at': visit.created_at.isoformat() if visit.created_at else None,
        'url': f'/visits?visit_id={visit.id}',
    }


def period_stats(visits, start_at):
    selected = [visit for visit in visits if visit.created_at and visit.created_at >= start_at]

    revenue = 0
    profit = 0
    orders_with_total = 0

    for visit in selected:
        total = visit_total(visit)
        revenue += total
        profit += visit_profit(visit)

        if total > 0:
            orders_with_total += 1

    average_check = revenue / orders_with_total if orders_with_total else 0

    return {
        'revenue': round_money(revenue),
        'profit': round_money(profit),
        'orders_count': len(selected),
        'average_check': round_money(average_check),
    }


def get_order_summary(visits, is_store):
    now = timezone.now()
    active = 0
    completed = 0
    cancelled = 0
    overdue = 0
    overdue_items = []

    for visit in visits:
        status = str(visit.status or '')

        if status == 'CANCELLED':
            cancelled += 1
            continue

        if status == 'COMPLETED':
            completed += 1
            continue

        if status not in CLOSED_STATUSES:
            active += 1

        age_days = (now - (visit.created_at or now)).days
        is_overdue = False
        reason = ''

        if is_store:
            if status in ['ORDERED', 'IN_PROGRESS'] and age_days >= 2:
                is_overdue = True
                reason = f'В роботі {age_days} дн.'
            if status == 'DONE' and age_days >= 1:
                is_overdue = True
                reason = f'Готове {age_days} дн.'
        else:
            scheduled = visit.scheduled_datetime
            if scheduled and scheduled < now and status not in ['DONE', 'COMPLETED', 'CANCELLED']:
                is_overdue = True
                reason = 'Прострочений запис'

        if is_overdue:
            overdue += 1
            overdue_items.append({
                'id': visit.id,
                'visit_id': visit.id,
                'title': f'№{visit.id} • {visit.client or "Клієнт"}',
                'subtitle': reason,
                'status': status,
                'url': f'/visits?visit_id={visit.id}',
            })

    return {
        'active': active,
        'completed': completed,
        'cancelled': cancelled,
        'overdue': overdue,
        'overdue_items': overdue_items[:8],
    }


def get_debt_summary(visits):
    total_debt = 0
    debt_orders_count = 0
    items = []

    for visit in visits:
        if str(visit.status or '') == 'CANCELLED':
            continue

        payment_status = str(visit.payment_status or '').lower()

        if payment_status not in DEBT_PAYMENT_STATUSES:
            continue

        total = visit_total(visit)
        prepayment = money(getattr(visit, 'prepayment_amount', 0))
        debt = max(total - prepayment, 0)

        if debt <= 0:
            continue

        total_debt += debt
        debt_orders_count += 1

        items.append({
            'id': visit.id,
            'visit_id': visit.id,
            'client': visit.client or '',
            'phone': visit.phone or '',
            'plate': visit.plate or '',
            'amount': round_money(debt),
            'url': f'/clients?key={visit.phone or ""}&tab=debts&order_id={visit.id}',
        })

    return {
        'debt_total': round_money(total_debt),
        'debt_orders_count': debt_orders_count,
        'items': items[:8],
    }


def get_low_stock_summary(company):
    section = build_low_stock(company)
    items = section.get('items') or []

    normalized_items = []
    for item in items:
        normalized_items.append({
            'id': item.get('id'),
            'title': item.get('title') or '',
            'subtitle': item.get('subtitle') or '',
            'meta': item.get('meta') or '',
            'url': item.get('url') or '/inventory',
        })

    return {
        'low_stock_count': section.get('count', 0),
        'items': normalized_items[:8],
        'section': section,
    }


def get_inventory_value(company):
    try:
        qs = InventoryItem.objects.filter(company=company)
        buy_total = 0
        sell_total = 0

        for item in qs:
            qty = safe_int(item.quantity)
            buy_total += qty * money(item.buy_price)
            sell_total += qty * money(item.sell_price)

        return {
            'buy_value': round_money(buy_total),
            'sell_value': round_money(sell_total),
            'potential_profit': round_money(sell_total - buy_total),
        }
    except Exception:
        return {
            'buy_value': 0,
            'sell_value': 0,
            'potential_profit': 0,
        }


def get_novapost_summary(company, is_store):
    if not is_store:
        return {
            'problem_count': 0,
            'returns_count': 0,
            'in_transit_over_3_days_count': 0,
            'received_count': 0,
            'cod_waiting_count': 0,
            'cod_waiting_total': 0,
            'sections': [],
        }

    returns_section = build_np_returns(company)
    transit_section = build_parts_in_transit(company)
    received_section = build_np_received(company)
    cod_section = build_np_cod_waiting(company)

    returns_count = int(returns_section.get('count') or 0)
    transit_count = int(transit_section.get('count') or 0)
    received_count = int(received_section.get('count') or 0)
    cod_count = int(cod_section.get('count') or 0)
    cod_total = money(cod_section.get('amount'))

    return {
        'problem_count': returns_count + transit_count + cod_count,
        'returns_count': returns_count,
        'in_transit_over_3_days_count': transit_count,
        'received_count': received_count,
        'cod_waiting_count': cod_count,
        'cod_waiting_total': round_money(cod_total),
        'sections': [
            returns_section,
            transit_section,
            received_section,
            cod_section,
        ],
    }


def get_top_products(company, month_start):
    grouped = defaultdict(lambda: {
        'brand': '',
        'article': '',
        'name': '',
        'quantity': 0,
        'revenue': 0,
        'profit': 0,
    })

    parts = (
        OrderPart.objects
        .filter(visit__company=company, visit__created_at__gte=month_start)
        .select_related('visit')
        .order_by('-id')[:2000]
    )

    for part in parts:
        brand = str(part.brand or '').strip()
        article = str(part.article or '').strip()
        name = str(part.name or '').strip()
        key = f'{brand}|{article}|{name}'.lower()

        qty = money(part.quantity) or 1
        revenue = money(part.sell_price) * qty
        profit = (money(part.sell_price) - money(part.buy_price)) * qty

        grouped[key]['brand'] = brand
        grouped[key]['article'] = article
        grouped[key]['name'] = name
        grouped[key]['quantity'] += qty
        grouped[key]['revenue'] += revenue
        grouped[key]['profit'] += profit

    result = sorted(grouped.values(), key=lambda item: item['revenue'], reverse=True)[:8]

    return [
        {
            **item,
            'quantity': round_money(item['quantity']),
            'revenue': round_money(item['revenue']),
            'profit': round_money(item['profit']),
        }
        for item in result
    ]


def get_top_clients(visits, month_start):
    grouped = {}

    for visit in visits:
        if not visit.created_at or visit.created_at < month_start:
            continue

        phone = ''.join(ch for ch in str(visit.phone or '') if ch.isdigit()) or f'visit-{visit.id}'
        total = visit_total(visit)
        prepayment = money(getattr(visit, 'prepayment_amount', 0))
        payment_status = str(visit.payment_status or '').lower()
        debt = max(total - prepayment, 0) if payment_status in DEBT_PAYMENT_STATUSES else 0

        if phone not in grouped:
            grouped[phone] = {
                'client': visit.client or 'Клієнт',
                'phone': visit.phone or '',
                'orders_count': 0,
                'revenue': 0,
                'debt': 0,
                'last_visit': None,
                'url': f'/clients?key={phone}',
            }

        grouped[phone]['orders_count'] += 1
        grouped[phone]['revenue'] += total
        grouped[phone]['debt'] += debt

        if not grouped[phone]['last_visit'] or visit.created_at > grouped[phone]['last_visit']:
            grouped[phone]['last_visit'] = visit.created_at
            grouped[phone]['client'] = visit.client or grouped[phone]['client']

    result = sorted(grouped.values(), key=lambda item: item['revenue'], reverse=True)[:8]

    return [
        {
            **item,
            'revenue': round_money(item['revenue']),
            'debt': round_money(item['debt']),
            'last_visit': item['last_visit'].isoformat() if item.get('last_visit') else None,
        }
        for item in result
    ]


def get_today_tasks(visits):
    today = timezone.localdate()
    items = []

    for visit in visits:
        status = str(visit.status or '')

        if status in ['DONE', 'COMPLETED', 'CANCELLED']:
            continue

        created_today = visit.created_at and timezone.localtime(visit.created_at).date() == today
        scheduled_today = visit.scheduled_datetime and timezone.localtime(visit.scheduled_datetime).date() == today

        if created_today or scheduled_today:
            items.append(serialize_visit_task(visit))

    return items[:12]


def get_recommendation_summary(company):
    today = timezone.localdate()
    soon = today + timedelta(days=7)

    qs = VehicleRecommendation.objects.filter(company=company, status='active').order_by('due_date', '-created_at')[:300]

    active = 0
    soon_count = 0
    overdue = 0
    priority = []

    for rec in qs:
        active += 1
        state = 'active'
        state_label = 'Активна'

        if rec.due_date and rec.due_date < today:
            overdue += 1
            state = 'overdue'
            state_label = 'Прострочено'
        elif rec.due_date and rec.due_date <= soon:
            soon_count += 1
            state = 'soon'
            state_label = 'Скоро'

        if state in ['soon', 'overdue']:
            priority.append({
                'id': rec.id,
                'title': rec.title or '',
                'plate': rec.plate or '',
                'client': rec.client or '',
                'phone': rec.phone or '',
                'due_date': rec.due_date.isoformat() if rec.due_date else None,
                'state': state,
                'state_label': state_label,
                'url': '/crm/recommendations',
            })

    priority = sorted(priority, key=lambda item: 0 if item['state'] == 'overdue' else 1)[:5]

    return {
        'active': active,
        'soon': soon_count,
        'overdue': overdue,
        'priority': priority,
    }


def build_attention_sections(debt_summary, stock_summary, novapost_summary, order_summary):
    sections = []

    if debt_summary.get('debt_orders_count'):
        sections.append({
            'key': 'debts',
            'title': 'Є борги',
            'count': debt_summary.get('debt_orders_count'),
            'severity': 'critical',
            'url': '/clients?filter=debt',
            'amount': debt_summary.get('debt_total', 0),
            'subtitle': 'Клієнти або замовлення з незакритою сумою',
        })

    if order_summary.get('overdue'):
        sections.append({
            'key': 'overdue_orders',
            'title': 'Прострочені замовлення',
            'count': order_summary.get('overdue'),
            'severity': 'critical',
            'url': '/visits?filter=overdue',
            'amount': 0,
            'subtitle': 'Активні записи, які зависли довше норми',
        })

    if stock_summary.get('low_stock_count'):
        sections.append({
            'key': 'low_stock',
            'title': 'Закінчується товар',
            'count': stock_summary.get('low_stock_count'),
            'severity': 'warning',
            'url': '/inventory?filter=restock',
            'amount': 0,
            'subtitle': 'Товари, де доступно менше або дорівнює мінімуму',
        })

    if novapost_summary.get('returns_count'):
        sections.append({
            'key': 'np_returns',
            'title': 'Повернення Новою поштою',
            'count': novapost_summary.get('returns_count'),
            'severity': 'critical',
            'url': '/visits?filter=np_return',
            'amount': 0,
            'subtitle': 'Відправлення, які повертаються або повернуті',
        })

    if novapost_summary.get('in_transit_over_3_days_count'):
        sections.append({
            'key': 'np_in_transit',
            'title': 'Товар у дорозі більше 3 днів',
            'count': novapost_summary.get('in_transit_over_3_days_count'),
            'severity': 'warning',
            'url': '/visits?filter=parts_delay',
            'amount': 0,
            'subtitle': 'Замовлення або ТТН, які довго не отримані',
        })

    if novapost_summary.get('cod_waiting_count'):
        sections.append({
            'key': 'np_cod_waiting',
            'title': 'Післяплата очікується',
            'count': novapost_summary.get('cod_waiting_count'),
            'severity': 'warning',
            'url': '/visits?filter=np_cod',
            'amount': novapost_summary.get('cod_waiting_total', 0),
            'subtitle': 'Посилки з післяплатою, де гроші ще не закриті',
        })

    if novapost_summary.get('received_count'):
        sections.append({
            'key': 'np_received',
            'title': 'Посилка отримана',
            'count': novapost_summary.get('received_count'),
            'severity': 'info',
            'url': '/visits?filter=np_received',
            'amount': 0,
            'subtitle': 'Посилки отримані клієнтом, але замовлення ще не закрите',
        })

    return sections


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        today = timezone.localdate()
        today_start = local_start_of_day(today)
        seven_days_start = today_start - timedelta(days=6)
        month_start = local_start_of_day(today.replace(day=1))

        is_store = getattr(company, 'business_type', 'sto') == 'store'

        visits = list(
            Visit.objects
            .filter(company=company)
            .prefetch_related('parts', 'services')
            .order_by('-created_at')[:2000]
        )

        today_stats = period_stats(visits, today_start)
        week_stats = period_stats(visits, seven_days_start)
        month_stats = period_stats(visits, month_start)

        order_summary = get_order_summary(visits, is_store)
        debt_summary = get_debt_summary(visits)
        stock_summary = get_low_stock_summary(company)
        inventory_value = get_inventory_value(company)
        novapost_summary = get_novapost_summary(company, is_store)
        recommendation_summary = get_recommendation_summary(company)

        top_products = get_top_products(company, month_start)
        top_clients = get_top_clients(visits, month_start)
        today_tasks = get_today_tasks(visits)

        attention = build_attention_sections(
            debt_summary=debt_summary,
            stock_summary=stock_summary,
            novapost_summary=novapost_summary,
            order_summary=order_summary,
        )

        payload = {
            'business_type': getattr(company, 'business_type', 'sto'),
            'generated_at': timezone.now().isoformat(),
            'company': {
                'id': company.id,
                'name': company.name,
                'business_type': getattr(company, 'business_type', 'sto'),
            },
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'periods': {
                'today': {
                    'label': 'Сьогодні',
                    **today_stats,
                },
                'last_7_days': {
                    'label': '7 днів',
                    **week_stats,
                },
                'month': {
                    'label': 'Місяць',
                    **month_stats,
                },
            },
            'money': {
                'debt_total': debt_summary.get('debt_total', 0),
                'debt_orders_count': debt_summary.get('debt_orders_count', 0),
                'payment_due_total': debt_summary.get('debt_total', 0),
                'cod_waiting_total': novapost_summary.get('cod_waiting_total', 0),
            },
            'orders': order_summary,
            'stock': {
                **stock_summary,
                **inventory_value,
            },
            'novapost': novapost_summary,
            'top_products': top_products,
            'top_clients': top_clients,
            'tasks': {
                'today': today_tasks,
                'today_count': len(today_tasks),
            },
            'crm': {
                'recommendations': recommendation_summary,
            },
            'attention': attention,
        }

        return Response(payload)
