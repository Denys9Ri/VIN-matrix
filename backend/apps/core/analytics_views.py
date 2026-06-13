from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee, InventoryItem, OrderPart, Visit, WorkPost
from .safe_crm_views import safe_ensure_company


COMPLETED_STATUSES = {'DONE', 'COMPLETED', 'ISSUED'}
CANCELLED_STATUSES = {'CANCELLED'}
DEBT_PAYMENT_STATUSES = {'unpaid', 'prepaid', 'cod', 'debt'}
SLEEPING_CLIENT_DAYS = 60
DEAD_STOCK_DAYS = 60
LOW_MARGIN_PERCENT = Decimal('15')


def money(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal('0')


def round_money(value):
    try:
        return float(money(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
    except Exception:
        return 0.0


def round_number(value, digits=2):
    try:
        return round(float(value or 0), digits)
    except Exception:
        return 0


def safe_int(value, default=0):
    try:
        return int(value or default)
    except Exception:
        return default


def percent(part, whole):
    part = money(part)
    whole = money(whole)
    if not whole:
        return 0.0
    return round_number((part / whole) * Decimal('100'), 1)


def local_start_of_day(date_value):
    naive = timezone.datetime.combine(date_value, timezone.datetime.min.time())
    return timezone.make_aware(naive, timezone.get_current_timezone())


def parse_iso_date(value):
    if not value:
        return None
    try:
        return timezone.datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except Exception:
        return None


def add_month(date_value, months):
    month = date_value.month - 1 + months
    year = date_value.year + month // 12
    month = month % 12 + 1
    day = min(date_value.day, 28)
    return date_value.replace(year=year, month=month, day=day)


def period_bounds(request):
    today = timezone.localdate()
    tomorrow_start = local_start_of_day(today + timedelta(days=1))
    period = (request.query_params.get('period') or '30d').strip()

    if period == 'today':
        start_date = today
        end_date = today
        label = 'Сьогодні'
    elif period == '7d':
        start_date = today - timedelta(days=6)
        end_date = today
        label = '7 днів'
    elif period == '30d':
        start_date = today - timedelta(days=29)
        end_date = today
        label = '30 днів'
    elif period == 'this_month':
        start_date = today.replace(day=1)
        end_date = today
        label = 'Поточний місяць'
    elif period == 'last_month':
        this_month_start = today.replace(day=1)
        last_month_start = add_month(this_month_start, -1)
        last_month_end = this_month_start - timedelta(days=1)
        start_date = last_month_start
        end_date = last_month_end
        label = 'Минулий місяць'
    elif period == 'custom':
        start_date = parse_iso_date(request.query_params.get('date_from')) or (today - timedelta(days=29))
        end_date = parse_iso_date(request.query_params.get('date_to')) or today
        if end_date < start_date:
            start_date, end_date = end_date, start_date
        label = 'Свій період'
    elif period == 'all':
        return {
            'period': period,
            'label': 'Весь час',
            'start_date': None,
            'end_date': None,
            'start_at': None,
            'end_at': None,
            'days': None,
            'group_by': 'month',
        }
    else:
        period = '30d'
        start_date = today - timedelta(days=29)
        end_date = today
        label = '30 днів'

    start_at = local_start_of_day(start_date)
    end_at = local_start_of_day(end_date + timedelta(days=1))
    days = max((end_date - start_date).days + 1, 1)
    group_by = 'month' if days > 90 else 'day'

    return {
        'period': period,
        'label': label,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'start_at': start_at,
        'end_at': end_at,
        'days': days,
        'group_by': group_by,
    }


def visit_metric_date(visit):
    status = str(getattr(visit, 'status', '') or '').upper()
    if status in COMPLETED_STATUSES and getattr(visit, 'updated_at', None):
        return visit.updated_at
    return getattr(visit, 'scheduled_datetime', None) or getattr(visit, 'created_at', None)


def in_period(dt, bounds):
    if not dt:
        return False
    start_at = bounds.get('start_at')
    end_at = bounds.get('end_at')
    if start_at and dt < start_at:
        return False
    if end_at and dt >= end_at:
        return False
    return True


def chart_key(dt, group_by):
    local_dt = timezone.localtime(dt)
    if group_by == 'month':
        return local_dt.strftime('%Y-%m'), local_dt.strftime('%b %Y')
    return local_dt.strftime('%Y-%m-%d'), local_dt.strftime('%d %b')


def service_total(service):
    return money(getattr(service, 'price', 0)) * (money(getattr(service, 'quantity', 1)) or Decimal('1'))


def part_totals(part):
    qty = money(getattr(part, 'quantity', 1)) or Decimal('1')
    revenue = money(getattr(part, 'sell_price', 0)) * qty
    cost = money(getattr(part, 'buy_price', 0)) * qty
    profit = revenue - cost
    return qty, revenue, cost, profit


def visit_totals(visit):
    parts_revenue = Decimal('0')
    parts_cost = Decimal('0')
    parts_profit = Decimal('0')
    services_revenue = Decimal('0')
    service_commission = Decimal('0')

    for part in getattr(visit, 'parts', []).all():
        _, revenue, cost, profit = part_totals(part)
        parts_revenue += revenue
        parts_cost += cost
        parts_profit += profit

    for service in getattr(visit, 'services', []).all():
        services_revenue += service_total(service)
        service_commission += money(getattr(service, 'commission_amount', 0))

    revenue = parts_revenue + services_revenue
    gross_profit = parts_profit + services_revenue

    return {
        'parts_revenue': parts_revenue,
        'parts_cost': parts_cost,
        'parts_profit': parts_profit,
        'services_revenue': services_revenue,
        'revenue': revenue,
        'gross_profit': gross_profit,
        'service_commission': service_commission,
    }


def get_payments_map(visit_ids):
    if not visit_ids:
        return {}
    placeholders = ','.join(['%s'] * len(visit_ids))
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                f'SELECT visit_id, COALESCE(SUM(amount), 0) FROM core_visitpayment WHERE visit_id IN ({placeholders}) GROUP BY visit_id',
                visit_ids,
            )
            return {row[0]: money(row[1]) for row in cursor.fetchall()}
    except Exception:
        return {}


def user_label(user):
    if not user:
        return 'Без майстра'
    full = f'{getattr(user, "first_name", "") or ""} {getattr(user, "last_name", "") or ""}'.strip()
    return full or getattr(user, 'username', '') or f'Працівник #{getattr(user, "id", "")}'


def employee_payload(employee):
    user = getattr(employee, 'user', None)
    return {
        'id': getattr(user, 'id', None),
        'employee_id': getattr(employee, 'id', None),
        'name': user_label(user),
        'username': getattr(user, 'username', '') if user else '',
        'commission_percent': round_money(getattr(employee, 'commission_percent', 0)),
        'parts_commission_percent': round_money(getattr(employee, 'parts_commission_percent', 0)),
        'salary_scheme': getattr(employee, 'salary_scheme', 'services_only'),
        'payout_period': getattr(employee, 'payout_period', 'monthly'),
        'is_salary_active': bool(getattr(employee, 'is_salary_active', True)),
    }


def build_empty_mechanic_row(employee=None, user=None):
    if employee:
        base = employee_payload(employee)
        user_id = base['id']
        name = base['name']
    else:
        user_id = getattr(user, 'id', None)
        name = user_label(user)
        base = {
            'id': user_id,
            'employee_id': None,
            'name': name,
            'username': getattr(user, 'username', '') if user else '',
            'commission_percent': 0,
            'parts_commission_percent': 0,
            'salary_scheme': 'services_only',
            'payout_period': 'monthly',
            'is_salary_active': True,
        }

    base.update({
        'services_count': 0,
        'visits_count': 0,
        'services_revenue': Decimal('0'),
        'parts_profit': Decimal('0'),
        'service_commission': Decimal('0'),
        'parts_commission': Decimal('0'),
        'commission_total': Decimal('0'),
        'average_commission_percent': 0,
        '_visit_ids': set(),
        '_details': [],
    })
    return base


def mechanic_is_parts_commission_eligible(employee):
    if not employee:
        return False
    if not getattr(employee, 'is_salary_active', True):
        return False
    if getattr(employee, 'salary_scheme', '') != 'services_and_parts_profit':
        return False
    return money(getattr(employee, 'parts_commission_percent', 0)) > 0


def ensure_mechanic_row(mechanics, user, employee=None):
    if not user:
        return None
    if user.id not in mechanics:
        mechanics[user.id] = build_empty_mechanic_row(employee=employee, user=user)
    return mechanics[user.id]


def count_mechanic_visit(row, visit_id):
    if row is None or not visit_id:
        return
    if '_visit_ids' not in row:
        row['_visit_ids'] = set()
    if visit_id not in row['_visit_ids']:
        row['_visit_ids'].add(visit_id)
        row['visits_count'] += 1


def add_parts_commission_to_row(row, parts_profit, parts_commission):
    if row is None or parts_commission <= 0:
        return
    row['parts_profit'] += parts_profit
    row['parts_commission'] += parts_commission
    row['commission_total'] += parts_commission


def add_detail_to_row(row, detail):
    if row is None or not detail:
        return
    if '_details' not in row:
        row['_details'] = []
    row['_details'].append(detail)


def detail_date_label(dt):
    if not dt:
        return ''
    try:
        return timezone.localtime(dt).strftime('%d.%m.%Y')
    except Exception:
        return str(dt)[:10]


def build_visit_detail(visit, metric_dt, post, services=None, parts=None):
    return {
        'date': timezone.localtime(metric_dt).date().isoformat() if metric_dt else '',
        'date_label': detail_date_label(metric_dt),
        'created_at': metric_dt.isoformat() if metric_dt else None,
        'visit_id': getattr(visit, 'id', None),
        'client': getattr(visit, 'client', '') or '',
        'phone': getattr(visit, 'phone', '') or '',
        'plate': getattr(visit, 'plate', '') or '',
        'status': getattr(visit, 'status', '') or '',
        'work_post': getattr(post, 'name', None) or 'Без поста',
        'services': services or [],
        'parts': parts or [],
        'services_revenue': Decimal('0'),
        'service_commission': Decimal('0'),
        'parts_profit': Decimal('0'),
        'parts_commission': Decimal('0'),
        'commission_total': Decimal('0'),
    }


def normalize_part_detail(part_item, ratio, employee_percent):
    ratio = money(ratio)
    allocated_profit = money(part_item.get('profit')) * ratio
    commission = allocated_profit * money(employee_percent) / Decimal('100')
    return {
        'brand': part_item.get('brand') or '',
        'article': part_item.get('article') or '',
        'name': part_item.get('name') or 'Запчастина',
        'quantity': round_number(part_item.get('quantity'), 2),
        'revenue': round_money(part_item.get('revenue')),
        'cost': round_money(part_item.get('cost')),
        'profit': round_money(part_item.get('profit')),
        'allocated_profit': round_money(allocated_profit),
        'commission_percent': round_money(employee_percent),
        'commission_amount': round_money(commission),
    }


def normalize_service_detail(service_item):
    return {
        'name': service_item.get('name') or 'Робота',
        'quantity': round_number(service_item.get('quantity'), 2),
        'revenue': round_money(service_item.get('revenue')),
        'commission_percent': round_money(service_item.get('commission_percent')),
        'commission_amount': round_money(service_item.get('commission_amount')),
    }


def normalize_visit_detail(detail):
    services_revenue = money(detail.get('services_revenue'))
    service_commission = money(detail.get('service_commission'))
    parts_profit = money(detail.get('parts_profit'))
    parts_commission = money(detail.get('parts_commission'))
    total = service_commission + parts_commission
    return {
        'date': detail.get('date'),
        'date_label': detail.get('date_label'),
        'created_at': detail.get('created_at'),
        'visit_id': detail.get('visit_id'),
        'client': detail.get('client') or '',
        'phone': detail.get('phone') or '',
        'plate': detail.get('plate') or '',
        'status': detail.get('status') or '',
        'work_post': detail.get('work_post') or 'Без поста',
        'services_revenue': round_money(services_revenue),
        'service_commission': round_money(service_commission),
        'parts_profit': round_money(parts_profit),
        'parts_commission': round_money(parts_commission),
        'commission_total': round_money(total),
        'services': [normalize_service_detail(item) for item in detail.get('services', [])],
        'parts': detail.get('parts', []),
        'url': f'/visits?visit_id={detail.get("visit_id")}',
    }


def normalize_mechanic_history(details):
    groups = {}
    for raw in details or []:
        detail = normalize_visit_detail(raw)
        key = detail.get('date') or 'unknown'
        if key not in groups:
            groups[key] = {
                'date': key,
                'label': detail.get('date_label') or key,
                'visits_count': 0,
                'services_revenue': Decimal('0'),
                'service_commission': Decimal('0'),
                'parts_profit': Decimal('0'),
                'parts_commission': Decimal('0'),
                'commission_total': Decimal('0'),
                'items': [],
            }
        g = groups[key]
        g['visits_count'] += 1
        g['services_revenue'] += money(detail.get('services_revenue'))
        g['service_commission'] += money(detail.get('service_commission'))
        g['parts_profit'] += money(detail.get('parts_profit'))
        g['parts_commission'] += money(detail.get('parts_commission'))
        g['commission_total'] += money(detail.get('commission_total'))
        g['items'].append(detail)

    normalized = []
    for item in groups.values():
        item['items'] = sorted(item['items'], key=lambda d: d.get('created_at') or '', reverse=True)
        normalized.append({
            'date': item['date'],
            'label': item['label'],
            'visits_count': item['visits_count'],
            'services_revenue': round_money(item['services_revenue']),
            'service_commission': round_money(item['service_commission']),
            'parts_profit': round_money(item['parts_profit']),
            'parts_commission': round_money(item['parts_commission']),
            'commission_total': round_money(item['commission_total']),
            'items': item['items'],
        })
    return sorted(normalized, key=lambda item: item.get('date') or '', reverse=True)


def normalize_mechanic_row(row):
    service_revenue = row.get('services_revenue', Decimal('0'))
    commission_total = row.get('commission_total', Decimal('0'))
    details = row.get('_details') or []
    history = normalize_mechanic_history(details)
    clean_row = {key: value for key, value in row.items() if not str(key).startswith('_')}
    return {
        **clean_row,
        'services_revenue': round_money(service_revenue),
        'parts_profit': round_money(row.get('parts_profit', 0)),
        'service_commission': round_money(row.get('service_commission', 0)),
        'parts_commission': round_money(row.get('parts_commission', 0)),
        'commission_total': round_money(commission_total),
        'average_commission_percent': percent(commission_total, service_revenue) if service_revenue else round_number(row.get('commission_percent', 0), 1),
        'history_count': len(details),
        'history_by_date': history,
    }


def normalize_work_post_row(row):
    revenue = row.get('revenue', Decimal('0'))
    gross_profit = row.get('gross_profit', Decimal('0'))
    commission = row.get('mechanic_commission', Decimal('0'))
    return {
        'id': row.get('id'),
        'name': row.get('name') or 'Без поста',
        'number': row.get('number'),
        'is_active': row.get('is_active', True),
        'visits_count': row.get('visits_count', 0),
        'completed_count': row.get('completed_count', 0),
        'active_count': row.get('active_count', 0),
        'revenue': round_money(revenue),
        'gross_profit': round_money(gross_profit),
        'mechanic_commission': round_money(commission),
        'net_profit': round_money(gross_profit - commission),
    }


class AnalyticsSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        bounds = period_bounds(request)
        is_store = getattr(company, 'business_type', 'sto') == 'store'

        queryset = Visit.objects.filter(company=company)
        if bounds.get('start_at') and bounds.get('end_at'):
            queryset = queryset.filter(
                Q(created_at__gte=bounds['start_at'], created_at__lt=bounds['end_at']) |
                Q(updated_at__gte=bounds['start_at'], updated_at__lt=bounds['end_at']) |
                Q(scheduled_datetime__gte=bounds['start_at'], scheduled_datetime__lt=bounds['end_at'])
            )

        visits = list(
            queryset
            .select_related('work_post', 'responsible_mechanic')
            .prefetch_related('parts', 'services', 'services__mechanic')
            .order_by('-created_at')[:5000]
        )
        visits = [visit for visit in visits if in_period(visit_metric_date(visit), bounds) or bounds.get('period') == 'all']

        visit_ids = [visit.id for visit in visits]
        payments_map = get_payments_map(visit_ids)

        employees = list(Employee.objects.filter(company=company, role='mechanic').select_related('user'))
        employees_by_user_id = {employee.user_id: employee for employee in employees}
        mechanics = {employee.user_id: build_empty_mechanic_row(employee=employee) for employee in employees}

        chart = {}
        products = defaultdict(lambda: {
            'brand': '', 'article': '', 'name': '', 'quantity': Decimal('0'),
            'revenue': Decimal('0'), 'cost': Decimal('0'), 'profit': Decimal('0'),
        })
        services = defaultdict(lambda: {
            'name': '', 'quantity': Decimal('0'), 'revenue': Decimal('0'),
            'commission_total': Decimal('0'), 'profit_after_commission': Decimal('0'),
        })
        clients = {}
        work_posts = {}
        debt_items = []

        summary = {
            'orders_count': 0,
            'completed_orders_count': 0,
            'active_orders_count': 0,
            'cancelled_orders_count': 0,
            'revenue': Decimal('0'),
            'parts_revenue': Decimal('0'),
            'services_revenue': Decimal('0'),
            'cost': Decimal('0'),
            'parts_profit': Decimal('0'),
            'services_profit': Decimal('0'),
            'gross_profit': Decimal('0'),
            'mechanic_commission': Decimal('0'),
            'net_profit': Decimal('0'),
            'paid_total': Decimal('0'),
            'debt_total': Decimal('0'),
            'debt_orders_count': 0,
            'average_check': Decimal('0'),
            'pipeline_revenue': Decimal('0'),
        }

        for visit in visits:
            status = str(getattr(visit, 'status', '') or '').upper()
            is_cancelled = status in CANCELLED_STATUSES
            is_completed = status in COMPLETED_STATUSES
            totals = visit_totals(visit)
            total = totals['revenue']
            paid = payments_map.get(visit.id)
            if paid is None or paid <= 0:
                paid = money(getattr(visit, 'prepayment_amount', 0))
            debt = max(total - paid, Decimal('0')) if not is_cancelled else Decimal('0')

            summary['orders_count'] += 1
            if is_cancelled:
                summary['cancelled_orders_count'] += 1
            elif is_completed:
                summary['completed_orders_count'] += 1
            else:
                summary['active_orders_count'] += 1
                summary['pipeline_revenue'] += total

            if not is_cancelled:
                summary['paid_total'] += paid
                if debt > 0 and str(getattr(visit, 'payment_status', '') or '').lower() in DEBT_PAYMENT_STATUSES:
                    summary['debt_total'] += debt
                    summary['debt_orders_count'] += 1
                    debt_items.append({
                        'visit_id': visit.id,
                        'client': getattr(visit, 'client', '') or '',
                        'phone': getattr(visit, 'phone', '') or '',
                        'plate': getattr(visit, 'plate', '') or '',
                        'status': status,
                        'amount': round_money(debt),
                        'url': f'/clients?key={getattr(visit, "phone", "") or ""}&tab=debts&order_id={visit.id}',
                    })

            if is_completed and not is_cancelled:
                summary['revenue'] += totals['revenue']
                summary['parts_revenue'] += totals['parts_revenue']
                summary['services_revenue'] += totals['services_revenue']
                summary['cost'] += totals['parts_cost']
                summary['parts_profit'] += totals['parts_profit']
                summary['services_profit'] += totals['services_revenue']
                summary['gross_profit'] += totals['gross_profit']
                summary['mechanic_commission'] += totals['service_commission']

            metric_dt = visit_metric_date(visit) or getattr(visit, 'created_at', timezone.now())
            key, label = chart_key(metric_dt, bounds.get('group_by'))
            if key not in chart:
                chart[key] = {
                    'date': key,
                    'label': label,
                    'revenue': Decimal('0'),
                    'profit': Decimal('0'),
                    'net_profit': Decimal('0'),
                    'mechanic_commission': Decimal('0'),
                    'orders_count': 0,
                    'average_check': Decimal('0'),
                    'debt': Decimal('0'),
                }
            chart[key]['orders_count'] += 1
            if is_completed and not is_cancelled:
                chart[key]['revenue'] += totals['revenue']
                chart[key]['profit'] += totals['gross_profit']
                chart[key]['mechanic_commission'] += totals['service_commission']
            if not is_cancelled:
                chart[key]['debt'] += debt

            phone_key = ''.join(ch for ch in str(getattr(visit, 'phone', '') or '') if ch.isdigit()) or f'visit-{visit.id}'
            if phone_key not in clients:
                clients[phone_key] = {
                    'client': getattr(visit, 'client', '') or 'Клієнт',
                    'phone': getattr(visit, 'phone', '') or '',
                    'orders_count': 0,
                    'completed_orders_count': 0,
                    'revenue': Decimal('0'),
                    'gross_profit': Decimal('0'),
                    'debt': Decimal('0'),
                    'last_visit': None,
                    'url': f'/clients?key={phone_key}',
                }
            clients[phone_key]['orders_count'] += 1
            if is_completed and not is_cancelled:
                clients[phone_key]['completed_orders_count'] += 1
                clients[phone_key]['revenue'] += totals['revenue']
                clients[phone_key]['gross_profit'] += totals['gross_profit']
            clients[phone_key]['debt'] += debt
            if not clients[phone_key]['last_visit'] or metric_dt > clients[phone_key]['last_visit']:
                clients[phone_key]['last_visit'] = metric_dt
                clients[phone_key]['client'] = getattr(visit, 'client', '') or clients[phone_key]['client']

            post = getattr(visit, 'work_post', None)
            post_key = getattr(post, 'id', None) or 'none'
            if post_key not in work_posts:
                work_posts[post_key] = {
                    'id': getattr(post, 'id', None),
                    'name': getattr(post, 'name', None) or 'Без поста',
                    'number': getattr(post, 'number', None),
                    'is_active': getattr(post, 'is_active', True) if post else True,
                    'visits_count': 0,
                    'completed_count': 0,
                    'active_count': 0,
                    'revenue': Decimal('0'),
                    'gross_profit': Decimal('0'),
                    'mechanic_commission': Decimal('0'),
                }
            work_posts[post_key]['visits_count'] += 1
            if is_completed and not is_cancelled:
                work_posts[post_key]['completed_count'] += 1
                work_posts[post_key]['revenue'] += totals['revenue']
                work_posts[post_key]['gross_profit'] += totals['gross_profit']
                work_posts[post_key]['mechanic_commission'] += totals['service_commission']
            elif not is_cancelled:
                work_posts[post_key]['active_count'] += 1

            if is_completed and not is_cancelled:
                service_revenue_by_mechanic = defaultdict(lambda: Decimal('0'))
                visit_parts_items = []
                mechanic_visit_details = {}

                for part in getattr(visit, 'parts', []).all():
                    qty, revenue, cost, profit = part_totals(part)
                    brand = str(getattr(part, 'brand', '') or '').strip()
                    article = str(getattr(part, 'article', '') or '').strip()
                    name = str(getattr(part, 'name', '') or '').strip()
                    product_key = f'{brand}|{article}|{name}'.lower()
                    products[product_key]['brand'] = brand
                    products[product_key]['article'] = article
                    products[product_key]['name'] = name or article or brand or 'Товар'
                    products[product_key]['quantity'] += qty
                    products[product_key]['revenue'] += revenue
                    products[product_key]['cost'] += cost
                    products[product_key]['profit'] += profit
                    visit_parts_items.append({
                        'brand': brand,
                        'article': article,
                        'name': name or article or brand or 'Запчастина',
                        'quantity': qty,
                        'revenue': revenue,
                        'cost': cost,
                        'profit': profit,
                    })

                for service in getattr(visit, 'services', []).all():
                    service_name = str(getattr(service, 'name', '') or 'Робота').strip()
                    svc_key = service_name.lower()
                    svc_total = service_total(service)
                    svc_commission = money(getattr(service, 'commission_amount', 0))
                    services[svc_key]['name'] = service_name
                    services[svc_key]['quantity'] += money(getattr(service, 'quantity', 1)) or Decimal('1')
                    services[svc_key]['revenue'] += svc_total
                    services[svc_key]['commission_total'] += svc_commission
                    services[svc_key]['profit_after_commission'] += svc_total - svc_commission

                    mechanic_user = getattr(service, 'mechanic', None)
                    if mechanic_user:
                        employee = employees_by_user_id.get(mechanic_user.id)
                        row = ensure_mechanic_row(mechanics, mechanic_user, employee=employee)
                        row['services_count'] += 1
                        row['services_revenue'] += svc_total
                        row['service_commission'] += svc_commission
                        row['commission_total'] += svc_commission
                        count_mechanic_visit(row, visit.id)
                        service_revenue_by_mechanic[mechanic_user.id] += svc_total

                        if mechanic_user.id not in mechanic_visit_details:
                            mechanic_visit_details[mechanic_user.id] = build_visit_detail(visit, metric_dt, post)
                        detail = mechanic_visit_details[mechanic_user.id]
                        detail['services_revenue'] += svc_total
                        detail['service_commission'] += svc_commission
                        detail['commission_total'] += svc_commission
                        detail['services'].append({
                            'name': service_name,
                            'quantity': money(getattr(service, 'quantity', 1)) or Decimal('1'),
                            'revenue': svc_total,
                            'commission_percent': money(getattr(service, 'commission_percent', 0)),
                            'commission_amount': svc_commission,
                        })

                responsible = getattr(visit, 'responsible_mechanic', None)
                responsible_employee = employees_by_user_id.get(responsible.id) if responsible else None
                responsible_row = ensure_mechanic_row(mechanics, responsible, employee=responsible_employee) if responsible else None
                if responsible_row:
                    count_mechanic_visit(responsible_row, visit.id)

                parts_commission_total = Decimal('0')

                # Пріоритет 1: якщо у візиті обраний відповідальний майстер і в нього ввімкнено
                # схему "роботи + маржа запчастин", увесь відсоток від маржі запчастин іде йому.
                if mechanic_is_parts_commission_eligible(responsible_employee):
                    employee_percent = money(getattr(responsible_employee, 'parts_commission_percent', 0))
                    parts_commission = totals['parts_profit'] * employee_percent / Decimal('100')
                    add_parts_commission_to_row(responsible_row, totals['parts_profit'], parts_commission)
                    parts_commission_total += parts_commission

                    if responsible.id not in mechanic_visit_details:
                        mechanic_visit_details[responsible.id] = build_visit_detail(visit, metric_dt, post)
                    detail = mechanic_visit_details[responsible.id]
                    detail['parts_profit'] += totals['parts_profit']
                    detail['parts_commission'] += parts_commission
                    detail['commission_total'] += parts_commission
                    detail['parts'].extend([normalize_part_detail(part_item, Decimal('1'), employee_percent) for part_item in visit_parts_items])

                # Пріоритет 2: якщо відповідальний майстер не заданий або в нього немає такої схеми,
                # відсоток від запчастин отримують майстри, які фактично виконували роботи у цьому візиті.
                # Якщо робіт кілька — маржу запчастин ділимо пропорційно сумі робіт кожного майстра.
                elif totals['parts_profit'] > 0 and service_revenue_by_mechanic:
                    eligible_ids = [
                        user_id for user_id in service_revenue_by_mechanic.keys()
                        if mechanic_is_parts_commission_eligible(employees_by_user_id.get(user_id))
                    ]
                    eligible_revenue_total = sum((service_revenue_by_mechanic[user_id] for user_id in eligible_ids), Decimal('0'))
                    split_count = Decimal(len(eligible_ids) or 1)

                    for user_id in eligible_ids:
                        employee = employees_by_user_id.get(user_id)
                        row = mechanics.get(user_id)
                        if eligible_revenue_total > 0:
                            allocated_parts_profit = totals['parts_profit'] * service_revenue_by_mechanic[user_id] / eligible_revenue_total
                        else:
                            allocated_parts_profit = totals['parts_profit'] / split_count

                        employee_percent = money(getattr(employee, 'parts_commission_percent', 0))
                        parts_commission = allocated_parts_profit * employee_percent / Decimal('100')
                        add_parts_commission_to_row(row, allocated_parts_profit, parts_commission)
                        parts_commission_total += parts_commission

                        if user_id not in mechanic_visit_details:
                            mechanic_visit_details[user_id] = build_visit_detail(visit, metric_dt, post)
                        detail = mechanic_visit_details[user_id]
                        detail['parts_profit'] += allocated_parts_profit
                        detail['parts_commission'] += parts_commission
                        detail['commission_total'] += parts_commission
                        ratio = (allocated_parts_profit / totals['parts_profit']) if totals['parts_profit'] else Decimal('0')
                        detail['parts'].extend([normalize_part_detail(part_item, ratio, employee_percent) for part_item in visit_parts_items])

                for user_id, detail in mechanic_visit_details.items():
                    if money(detail.get('commission_total')) > 0:
                        add_detail_to_row(mechanics.get(user_id), detail)

                if parts_commission_total > 0:
                    summary['mechanic_commission'] += parts_commission_total
                    chart[key]['mechanic_commission'] += parts_commission_total
                    work_posts[post_key]['mechanic_commission'] += parts_commission_total

        summary['net_profit'] = summary['gross_profit'] - summary['mechanic_commission']
        summary['average_check'] = summary['revenue'] / summary['completed_orders_count'] if summary['completed_orders_count'] else Decimal('0')

        normalized_chart = []
        for key in sorted(chart.keys()):
            item = chart[key]
            item['net_profit'] = item['profit'] - item['mechanic_commission']
            item['average_check'] = item['revenue'] / item['orders_count'] if item['orders_count'] else Decimal('0')
            normalized_chart.append({
                'date': item['date'],
                'label': item['label'],
                'revenue': round_money(item['revenue']),
                'profit': round_money(item['profit']),
                'net_profit': round_money(item['net_profit']),
                'mechanic_commission': round_money(item['mechanic_commission']),
                'orders_count': item['orders_count'],
                'average_check': round_money(item['average_check']),
                'debt': round_money(item['debt']),
            })

        product_rows = []
        for item in products.values():
            item['margin_percent'] = percent(item['profit'], item['revenue'])
            product_rows.append({
                'brand': item['brand'],
                'article': item['article'],
                'name': item['name'],
                'quantity': round_number(item['quantity'], 2),
                'revenue': round_money(item['revenue']),
                'cost': round_money(item['cost']),
                'profit': round_money(item['profit']),
                'margin_percent': item['margin_percent'],
            })

        service_rows = [{
            'name': item['name'],
            'quantity': round_number(item['quantity'], 2),
            'revenue': round_money(item['revenue']),
            'commission_total': round_money(item['commission_total']),
            'profit_after_commission': round_money(item['profit_after_commission']),
        } for item in services.values()]

        client_rows = []
        for item in clients.values():
            client_rows.append({
                **item,
                'revenue': round_money(item['revenue']),
                'gross_profit': round_money(item['gross_profit']),
                'debt': round_money(item['debt']),
                'last_visit': item['last_visit'].isoformat() if item.get('last_visit') else None,
            })

        sleeping_border = timezone.now() - timedelta(days=SLEEPING_CLIENT_DAYS)
        sleeping_clients = [item for item in client_rows if item.get('last_visit') and timezone.datetime.fromisoformat(item['last_visit']) < sleeping_border]

        recent_sold_keys = set()
        dead_since = timezone.now() - timedelta(days=DEAD_STOCK_DAYS)
        recent_parts = OrderPart.objects.filter(visit__company=company, visit__created_at__gte=dead_since).only('brand', 'article')[:5000]
        for part in recent_parts:
            recent_sold_keys.add(f'{str(part.brand or "").strip().lower()}|{str(part.article or "").strip().lower()}')

        dead_stock = []
        for item in InventoryItem.objects.filter(company=company, quantity__gt=0).order_by('-updated_at')[:1000]:
            key = f'{str(item.brand or "").strip().lower()}|{str(item.article or "").strip().lower()}'
            if key not in recent_sold_keys:
                qty = safe_int(getattr(item, 'quantity', 0))
                dead_stock.append({
                    'id': item.id,
                    'brand': item.brand or '',
                    'article': item.article or '',
                    'name': item.name or '',
                    'quantity': qty,
                    'buy_value': round_money(money(getattr(item, 'buy_price', 0)) * qty),
                    'sell_value': round_money(money(getattr(item, 'sell_price', 0)) * qty),
                    'days_without_sales': DEAD_STOCK_DAYS,
                })

        payload = {
            'business_type': getattr(company, 'business_type', 'sto'),
            'generated_at': timezone.now().isoformat(),
            'period': {
                'key': bounds['period'],
                'label': bounds['label'],
                'date_from': bounds.get('start_date'),
                'date_to': bounds.get('end_date'),
                'group_by': bounds.get('group_by'),
            },
            'company': {
                'id': company.id,
                'name': company.name,
                'business_type': getattr(company, 'business_type', 'sto'),
            },
            'summary': {
                'orders_count': summary['orders_count'],
                'completed_orders_count': summary['completed_orders_count'],
                'active_orders_count': summary['active_orders_count'],
                'cancelled_orders_count': summary['cancelled_orders_count'],
                'revenue': round_money(summary['revenue']),
                'parts_revenue': round_money(summary['parts_revenue']),
                'services_revenue': round_money(summary['services_revenue']),
                'cost': round_money(summary['cost']),
                'parts_profit': round_money(summary['parts_profit']),
                'services_profit': round_money(summary['services_profit']),
                'gross_profit': round_money(summary['gross_profit']),
                'mechanic_commission': round_money(summary['mechanic_commission']),
                'net_profit': round_money(summary['net_profit']),
                'paid_total': round_money(summary['paid_total']),
                'debt_total': round_money(summary['debt_total']),
                'debt_orders_count': summary['debt_orders_count'],
                'average_check': round_money(summary['average_check']),
                'pipeline_revenue': round_money(summary['pipeline_revenue']),
                'margin_percent': percent(summary['gross_profit'], summary['revenue']),
                'net_margin_percent': percent(summary['net_profit'], summary['revenue']),
            },
            'chart': normalized_chart,
            'products': {
                'top_by_revenue': sorted(product_rows, key=lambda item: item['revenue'], reverse=True)[:12],
                'top_by_profit': sorted(product_rows, key=lambda item: item['profit'], reverse=True)[:12],
                'low_margin': sorted([item for item in product_rows if item['revenue'] > 0 and item['margin_percent'] <= float(LOW_MARGIN_PERCENT)], key=lambda item: item['margin_percent'])[:12],
                'dead_stock': dead_stock[:12],
            },
            'services': {
                'top_by_revenue': sorted(service_rows, key=lambda item: item['revenue'], reverse=True)[:12],
                'top_by_profit_after_commission': sorted(service_rows, key=lambda item: item['profit_after_commission'], reverse=True)[:12],
            },
            'clients': {
                'top_by_revenue': sorted(client_rows, key=lambda item: item['revenue'], reverse=True)[:12],
                'with_debts': sorted([item for item in client_rows if item.get('debt', 0) > 0], key=lambda item: item['debt'], reverse=True)[:12],
                'sleeping': sorted(sleeping_clients, key=lambda item: item['last_visit'] or '')[:12],
            },
            'debts': {
                'total': round_money(summary['debt_total']),
                'orders_count': summary['debt_orders_count'],
                'items': sorted(debt_items, key=lambda item: item['amount'], reverse=True)[:12],
            },
            'mechanics': {
                'summary': {
                    'count': len(mechanics),
                    'commission_total': round_money(summary['mechanic_commission']),
                },
                'items': sorted([normalize_mechanic_row(row) for row in mechanics.values()], key=lambda item: item['commission_total'], reverse=True),
            },
            'work_posts': {
                'summary': {
                    'count': WorkPost.objects.filter(company=company).count(),
                    'active_count': WorkPost.objects.filter(company=company, is_active=True).count(),
                },
                'items': sorted([normalize_work_post_row(row) for row in work_posts.values()], key=lambda item: item['revenue'], reverse=True),
            },
        }

        return Response(payload)
