from collections import defaultdict
from decimal import Decimal

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit
from .safe_crm_views import safe_ensure_company


def money(value):
    try:
        return float(Decimal(str(value or 0)))
    except Exception:
        return 0.0


def normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    return digits or 'no-phone'


def search_order_id(value):
    value = str(value or '').strip().replace('№', '').replace('#', '')
    return int(value) if value.isdigit() else None


def parse_stock_statuses(part_ids):
    if not part_ids:
        return {}
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT id, stock_status FROM core_orderpart WHERE id = ANY(%s)',
                [list(part_ids)]
            )
            return {row[0]: row[1] or 'none' for row in cursor.fetchall()}
    except Exception:
        return {}


def part_totals(parts):
    revenue = cost = profit = 0.0
    for part in parts:
        qty = money(part.quantity or 1) or 1
        sell = money(part.sell_price)
        buy = money(part.buy_price)
        revenue += sell * qty
        cost += buy * qty
        profit += (sell - buy) * qty
    margin = (profit / revenue * 100) if revenue else 0
    return {'revenue': round(revenue, 2), 'cost': round(cost, 2), 'profit': round(profit, 2), 'margin': round(margin, 1)}


def payment_debt_amount(visit, revenue):
    if visit.payment_status in ['unpaid', 'debt']:
        return revenue
    return 0.0


def client_status(summary):
    if summary['debt_amount'] > 0:
        return 'Борг'
    if summary['returns_count'] >= 3:
        return 'Проблемний'
    if summary['total_revenue'] >= 10000 or summary['total_profit'] >= 2000:
        return 'VIP'
    if summary['orders_count'] >= 2:
        return 'Постійний'
    return 'Новий'


def serialize_order(visit, stock_statuses=None):
    parts = list(visit.parts.all())
    stock_statuses = stock_statuses or {}
    totals = part_totals(parts)
    return {
        'id': visit.id,
        'client': visit.client,
        'phone': visit.phone,
        'plate': visit.plate,
        'vin_code': visit.vin_code,
        'status': visit.status,
        'payment_status': visit.payment_status,
        'delivery_type': visit.delivery_type,
        'created_at': visit.created_at,
        'scheduled_datetime': visit.scheduled_datetime,
        'revenue': totals['revenue'],
        'cost': totals['cost'],
        'profit': totals['profit'],
        'margin': totals['margin'],
        'debt_amount': payment_debt_amount(visit, totals['revenue']),
        'parts_count': len(parts),
        'parts': [
            {
                'id': p.id,
                'brand': p.brand,
                'article': p.article,
                'name': p.name,
                'quantity': float(p.quantity or 1),
                'buy_price': money(p.buy_price),
                'sell_price': money(p.sell_price),
                'revenue': round(money(p.sell_price) * (money(p.quantity or 1) or 1), 2),
                'profit': round((money(p.sell_price) - money(p.buy_price)) * (money(p.quantity or 1) or 1), 2),
                'status': p.status,
                'supplier': p.supplier,
                'stock_status': stock_statuses.get(p.id, 'none'),
            }
            for p in parts
        ],
    }


def build_clients(company, search=''):
    qs = Visit.objects.filter(company=company).prefetch_related('parts').order_by('-created_at')
    if search:
        order_id = search_order_id(search)
        if order_id:
            exact_order_qs = qs.filter(id=order_id)
            if exact_order_qs.exists():
                qs = exact_order_qs
            else:
                qs = qs.filter(
                    Q(client__icontains=search) |
                    Q(phone__icontains=search) |
                    Q(plate__icontains=search) |
                    Q(vin_code__icontains=search) |
                    Q(parts__brand__icontains=search) |
                    Q(parts__article__icontains=search) |
                    Q(parts__name__icontains=search)
                ).distinct()
        else:
            qs = qs.filter(
                Q(client__icontains=search) |
                Q(phone__icontains=search) |
                Q(plate__icontains=search) |
                Q(vin_code__icontains=search) |
                Q(parts__brand__icontains=search) |
                Q(parts__article__icontains=search) |
                Q(parts__name__icontains=search)
            ).distinct()
    visits = list(qs)
    all_part_ids = [p.id for v in visits for p in v.parts.all()]
    stock_statuses = parse_stock_statuses(all_part_ids)
    groups = defaultdict(lambda: {
        'key': '', 'client': '', 'phone': '', 'orders': [], 'cars': {}, 'parts': [],
        'orders_count': 0, 'total_revenue': 0.0, 'total_cost': 0.0, 'total_profit': 0.0,
        'debt_amount': 0.0, 'returns_count': 0, 'last_order_date': None,
    })
    for visit in visits:
        key = normalize_phone(visit.phone) if normalize_phone(visit.phone) != 'no-phone' else f'name:{visit.client or visit.id}'
        g = groups[key]
        g['key'] = key
        if not g['client'] and visit.client:
            g['client'] = visit.client
        if not g['phone'] and visit.phone:
            g['phone'] = visit.phone
        order = serialize_order(visit, stock_statuses)
        g['orders'].append(order)
        g['orders_count'] += 1
        g['total_revenue'] += order['revenue']
        g['total_cost'] += order['cost']
        g['total_profit'] += order['profit']
        g['debt_amount'] += order['debt_amount']
        order_date = visit.scheduled_datetime or visit.created_at
        if order_date and (not g['last_order_date'] or order_date > g['last_order_date']):
            g['last_order_date'] = order_date
        car_key = f'{visit.plate or ""} {visit.vin_code or ""}'.strip()
        if car_key:
            g['cars'][car_key] = {'plate': visit.plate, 'vin_code': visit.vin_code}
        for p in order['parts']:
            g['parts'].append({**p, 'order_id': visit.id, 'date': order_date})
            if p['stock_status'] in ['returned', 'defective']:
                g['returns_count'] += 1
    clients = []
    for g in groups.values():
        g['total_revenue'] = round(g['total_revenue'], 2)
        g['total_cost'] = round(g['total_cost'], 2)
        g['total_profit'] = round(g['total_profit'], 2)
        g['margin'] = round((g['total_profit'] / g['total_revenue'] * 100) if g['total_revenue'] else 0, 1)
        g['debt_amount'] = round(g['debt_amount'], 2)
        g['cars'] = list(g['cars'].values())
        g['status'] = client_status(g)
        clients.append(g)
    return sorted(clients, key=lambda x: x['last_order_date'] or timezone.datetime.min.replace(tzinfo=timezone.utc), reverse=True)


class StoreClientListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'results': []})
        search = request.query_params.get('search', '').strip()
        clients = build_clients(company, search=search)
        compact = []
        for c in clients:
            compact.append({
                'key': c['key'],
                'client': c['client'] or 'Без імені',
                'phone': c['phone'],
                'orders_count': c['orders_count'],
                'total_revenue': c['total_revenue'],
                'total_profit': c['total_profit'],
                'margin': c['margin'],
                'debt_amount': c['debt_amount'],
                'returns_count': c['returns_count'],
                'last_order_date': c['last_order_date'],
                'cars': c['cars'][:3],
                'status': c['status'],
                'last_parts': c['parts'][:5],
            })
        return Response({'results': compact})


class StoreClientDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії'}, status=400)
        key = request.query_params.get('key', '').strip()
        phone = request.query_params.get('phone', '').strip()
        clients = build_clients(company)
        wanted = key or normalize_phone(phone)
        for c in clients:
            if c['key'] == wanted or normalize_phone(c['phone']) == wanted:
                return Response(c)
        return Response({'error': 'Клієнта не знайдено'}, status=404)
