from collections import defaultdict
from datetime import timedelta
from math import ceil

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, StockMovement
from .safe_crm_views import safe_ensure_company


LOW_MARGIN_PERCENT = 10
HIGH_MARGIN_PERCENT = 40
SLOW_DAYS = 90
SALES_WINDOW_DAYS = 90


def money(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def margin_percent(buy_price, sell_price):
    buy = money(buy_price)
    sell = money(sell_price)
    if sell <= 0:
        return 0.0
    return round(((sell - buy) / sell) * 100, 1)


def margin_value(buy_price, sell_price):
    return round(money(sell_price) - money(buy_price), 2)


def days_since(value):
    if not value:
        return None
    try:
        local_date = timezone.localtime(value).date() if hasattr(value, 'tzinfo') else value
        return (timezone.localdate() - local_date).days
    except Exception:
        return None


def stock_extra(item_ids):
    if not item_ids:
        return {}
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT id, COALESCE(reserved_quantity,0), COALESCE(min_quantity,0) FROM core_inventoryitem WHERE id = ANY(%s)',
                [list(item_ids)],
            )
            return {row[0]: {'reserved_quantity': int(row[1] or 0), 'min_quantity': int(row[2] or 0)} for row in cursor.fetchall()}
    except Exception:
        return {}


def movement_stats(company, item_ids):
    if not item_ids:
        return {}

    since = timezone.now() - timedelta(days=SALES_WINDOW_DAYS)
    stats = defaultdict(lambda: {
        'last_movement_at': None,
        'last_sale_at': None,
        'sold_qty_90d': 0,
        'receipts_qty_90d': 0,
    })

    qs = StockMovement.objects.filter(company=company, inventory_item_id__in=item_ids).only(
        'inventory_item_id', 'quantity', 'movement_type', 'note', 'created_at'
    )
    for movement in qs.iterator():
        item_stat = stats[movement.inventory_item_id]
        created_at = movement.created_at
        qty = int(movement.quantity or 0)
        note = str(movement.note or '').lower()
        is_sale = qty < 0 or 'списано' in note or 'продаж' in note or movement.movement_type in ['write_off', 'sale']
        is_receipt = qty > 0 and (movement.movement_type == 'receipt' or 'прихід' in note)

        if not item_stat['last_movement_at'] or created_at > item_stat['last_movement_at']:
            item_stat['last_movement_at'] = created_at
        if is_sale and (not item_stat['last_sale_at'] or created_at > item_stat['last_sale_at']):
            item_stat['last_sale_at'] = created_at
        if created_at >= since:
            if is_sale:
                item_stat['sold_qty_90d'] += abs(qty)
            if is_receipt:
                item_stat['receipts_qty_90d'] += qty
    return stats


def serialize_item(item, extra=None, stat=None):
    extra = extra or {}
    stat = stat or {}
    qty = int(item.quantity or 0)
    reserved = int(extra.get('reserved_quantity') or 0)
    min_qty = int(extra.get('min_quantity') or 0)
    available = max(qty - reserved, 0)
    buy = money(item.buy_price)
    sell = money(item.sell_price)
    margin = margin_value(buy, sell)
    margin_pct = margin_percent(buy, sell)
    last_sale_at = stat.get('last_sale_at')
    last_movement_at = stat.get('last_movement_at') or item.updated_at
    sold_90d = int(stat.get('sold_qty_90d') or 0)
    avg_monthly_sales = round(sold_90d / 3, 1) if sold_90d else 0
    target_qty = max(min_qty, ceil(avg_monthly_sales * 1.5))
    reorder_qty = max(target_qty - available, 0)
    if min_qty and available <= min_qty:
        reorder_qty = max(reorder_qty, min_qty - available, 1)
    elif not min_qty and available <= 0 and sold_90d > 0:
        reorder_qty = max(ceil(avg_monthly_sales), 1)

    return {
        'id': item.id,
        'brand': item.brand,
        'article': item.article,
        'name': item.name,
        'category': item.category_id,
        'category_name': item.category.name if item.category_id and item.category else '',
        'supplier_id': item.supplier_id,
        'supplier_name': item.supplier.name if item.supplier_id and item.supplier else 'Постачальник не вказаний',
        'quantity': qty,
        'reserved_quantity': reserved,
        'available_quantity': available,
        'min_quantity': min_qty,
        'buy_price': buy,
        'sell_price': sell,
        'stock_buy_value': round(qty * buy, 2),
        'stock_sell_value': round(qty * sell, 2),
        'potential_profit': round(qty * margin, 2),
        'margin_value': margin,
        'margin_percent': margin_pct,
        'below_cost': sell > 0 and sell < buy,
        'low_margin': sell > 0 and sell >= buy and margin_pct < LOW_MARGIN_PERCENT,
        'high_margin': sell > 0 and margin_pct >= HIGH_MARGIN_PERCENT,
        'needs_restock': reorder_qty > 0,
        'reorder_qty': reorder_qty,
        'reorder_purchase_value': round(reorder_qty * buy, 2),
        'reorder_expected_profit': round(reorder_qty * margin, 2),
        'sold_qty_90d': sold_90d,
        'avg_monthly_sales': avg_monthly_sales,
        'last_sale_at': last_sale_at,
        'last_movement_at': last_movement_at,
        'days_without_sale': days_since(last_sale_at),
        'days_without_movement': days_since(last_movement_at),
        'frozen_money': round(qty * buy, 2),
    }


class InventoryInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'summary': {}, 'purchase_list': [], 'slow_moving': [], 'margin': {}})

        items = list(
            InventoryItem.objects.filter(company=company)
            .select_related('supplier', 'category')
            .order_by('brand', 'article')
        )
        ids = [item.id for item in items]
        extra_map = stock_extra(ids)
        movement_map = movement_stats(company, ids)
        rows = [serialize_item(item, extra_map.get(item.id), movement_map.get(item.id)) for item in items]

        query = request.query_params.get('q', '').strip().lower()
        if query:
            rows = [row for row in rows if query in ' '.join([str(row.get('brand') or ''), str(row.get('article') or ''), str(row.get('name') or ''), str(row.get('supplier_name') or ''), str(row.get('category_name') or '')]).lower()]

        purchase_list = sorted(
            [row for row in rows if row['needs_restock']],
            key=lambda row: (row['available_quantity'] - row['min_quantity'], -row['sold_qty_90d'], row['supplier_name']),
        )

        slow_moving = sorted(
            [row for row in rows if row['quantity'] > 0 and (row['days_without_sale'] is None or row['days_without_sale'] >= SLOW_DAYS)],
            key=lambda row: (row['frozen_money'], row['days_without_sale'] or 9999),
            reverse=True,
        )

        below_cost = sorted([row for row in rows if row['below_cost']], key=lambda row: row['potential_profit'])
        low_margin = sorted([row for row in rows if row['low_margin']], key=lambda row: row['margin_percent'])
        high_margin = sorted([row for row in rows if row['high_margin']], key=lambda row: row['margin_percent'], reverse=True)
        min_stock = sorted([row for row in rows if row['min_quantity'] and row['available_quantity'] <= row['min_quantity']], key=lambda row: row['available_quantity'] - row['min_quantity'])

        stock_buy_value = round(sum(row['stock_buy_value'] for row in rows), 2)
        stock_sell_value = round(sum(row['stock_sell_value'] for row in rows), 2)
        potential_profit = round(stock_sell_value - stock_buy_value, 2)
        frozen_money = round(sum(row['frozen_money'] for row in slow_moving), 2)
        purchase_value = round(sum(row['reorder_purchase_value'] for row in purchase_list), 2)
        purchase_profit = round(sum(row['reorder_expected_profit'] for row in purchase_list), 2)

        by_supplier = defaultdict(lambda: {'supplier_name': '', 'positions': 0, 'reorder_qty': 0, 'purchase_value': 0.0, 'expected_profit': 0.0})
        for row in purchase_list:
            key = row['supplier_id'] or row['supplier_name'] or 'unknown'
            bucket = by_supplier[key]
            bucket['supplier_name'] = row['supplier_name']
            bucket['positions'] += 1
            bucket['reorder_qty'] += row['reorder_qty']
            bucket['purchase_value'] += row['reorder_purchase_value']
            bucket['expected_profit'] += row['reorder_expected_profit']
        supplier_summary = sorted(
            [{**value, 'purchase_value': round(value['purchase_value'], 2), 'expected_profit': round(value['expected_profit'], 2)} for value in by_supplier.values()],
            key=lambda value: value['purchase_value'],
            reverse=True,
        )

        return Response({
            'summary': {
                'items_count': len(rows),
                'stock_buy_value': stock_buy_value,
                'stock_sell_value': stock_sell_value,
                'potential_profit': potential_profit,
                'reserved_qty': sum(row['reserved_quantity'] for row in rows),
                'available_qty': sum(row['available_quantity'] for row in rows),
                'min_stock_count': len(min_stock),
                'restock_count': len(purchase_list),
                'purchase_value': purchase_value,
                'purchase_expected_profit': purchase_profit,
                'slow_count': len(slow_moving),
                'frozen_money': frozen_money,
                'below_cost_count': len(below_cost),
                'low_margin_count': len(low_margin),
                'high_margin_count': len(high_margin),
                'margin_percent': round((potential_profit / stock_sell_value * 100) if stock_sell_value else 0, 1),
            },
            'purchase_list': purchase_list[:300],
            'purchase_by_supplier': supplier_summary,
            'slow_moving': slow_moving[:300],
            'margin': {
                'below_cost': below_cost[:120],
                'low_margin': low_margin[:120],
                'high_margin': high_margin[:120],
            },
            'min_stock': min_stock[:200],
            'generated_at': timezone.now(),
        })
