from decimal import Decimal

from django.db import connection, transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, OrderPart, StockMovement, Visit
from .safe_crm_views import safe_ensure_company


def qty_value(value):
    try:
        return max(int(float(str(value or 1).replace(',', '.'))), 1)
    except Exception:
        return 1


def extra(table, columns, item_id, defaults):
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT {', '.join(columns)} FROM {table} WHERE id=%s", [item_id])
            row = cursor.fetchone()
        return row or defaults
    except Exception:
        return defaults


def log_move(request, item, move_type, quantity, note='', part=None):
    return StockMovement.objects.create(
        company=item.company,
        inventory_item=item,
        movement_type=move_type,
        supplier=item.supplier,
        source_order_part=part,
        brand=item.brand,
        article=item.article,
        name=item.name,
        quantity=quantity,
        buy_price=item.buy_price,
        sell_price=item.sell_price,
        note=note,
        created_by=request.user,
    )


class StockMinQuantityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company = safe_ensure_company(request.user)
        item = InventoryItem.objects.filter(company=company, id=request.data.get('item_id')).first() if company else None
        if not item:
            return Response({'error': 'Товар не знайдено'}, status=404)
        minimum = max(qty_value(request.data.get('min_quantity')) if request.data.get('min_quantity') else 0, 0)
        with connection.cursor() as cursor:
            cursor.execute('UPDATE core_inventoryitem SET min_quantity=%s WHERE id=%s', [minimum, item.id])
        return Response({'ok': True, 'min_quantity': minimum})


class StockReserveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        company = safe_ensure_company(request.user)
        part = OrderPart.objects.filter(id=request.data.get('order_part_id'), visit__company=company).first() if company else None
        if not part:
            return Response({'error': 'Запчастину у візиті не знайдено'}, status=404)
        item_id = request.data.get('inventory_item_id')
        item = InventoryItem.objects.filter(company=company, id=item_id).first() if item_id else InventoryItem.objects.filter(company=company, brand__iexact=part.brand, article__iexact=part.article).first()
        if not item:
            return Response({'error': 'Товар на складі не знайдено'}, status=404)
        quantity = qty_value(part.quantity)
        reserved, _minimum = extra('core_inventoryitem', ['reserved_quantity', 'min_quantity'], item.id, (0, 0))
        available = int(item.quantity or 0) - int(reserved or 0)
        if available < quantity:
            return Response({'error': f'Недостатньо на складі. Доступно: {available}'}, status=400)
        with connection.cursor() as cursor:
            cursor.execute('UPDATE core_inventoryitem SET reserved_quantity=COALESCE(reserved_quantity,0)+%s WHERE id=%s', [quantity, item.id])
            cursor.execute("UPDATE core_orderpart SET inventory_item_id=%s, stock_status='reserved', status='ARRIVED' WHERE id=%s", [item.id, part.id])
        log_move(request, item, 'reserve', quantity, f'Резерв під візит №{part.visit_id}', part)
        return Response({'ok': True})


class StockReleaseView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        company = safe_ensure_company(request.user)
        part = OrderPart.objects.filter(id=request.data.get('order_part_id'), visit__company=company).first() if company else None
        if not part:
            return Response({'error': 'Запчастину не знайдено'}, status=404)
        stock_status, item_id = extra('core_orderpart', ['stock_status', 'inventory_item_id'], part.id, ('none', None))
        item = InventoryItem.objects.filter(company=company, id=item_id).first() if item_id else None
        if not item or stock_status != 'reserved':
            return Response({'error': 'Ця запчастина не в резерві'}, status=400)
        quantity = qty_value(part.quantity)
        with connection.cursor() as cursor:
            cursor.execute('UPDATE core_inventoryitem SET reserved_quantity=GREATEST(COALESCE(reserved_quantity,0)-%s,0) WHERE id=%s', [quantity, item.id])
            cursor.execute("UPDATE core_orderpart SET stock_status='none', inventory_item_id=NULL WHERE id=%s", [part.id])
        log_move(request, item, 'release', quantity, f'Зняття резерву з візиту №{part.visit_id}', part)
        return Response({'ok': True})


class StockWriteOffVisitView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        company = safe_ensure_company(request.user)
        visit = Visit.objects.filter(company=company, id=request.data.get('visit_id')).first() if company else None
        if not visit:
            return Response({'error': 'Візит не знайдено'}, status=404)
        written = 0
        for part in OrderPart.objects.filter(visit=visit):
            stock_status, item_id = extra('core_orderpart', ['stock_status', 'inventory_item_id'], part.id, ('none', None))
            if stock_status != 'reserved' or not item_id:
                continue
            item = InventoryItem.objects.filter(company=company, id=item_id).first()
            if not item:
                continue
            quantity = qty_value(part.quantity)
            with connection.cursor() as cursor:
                cursor.execute('UPDATE core_inventoryitem SET reserved_quantity=GREATEST(COALESCE(reserved_quantity,0)-%s,0), quantity=GREATEST(COALESCE(quantity,0)-%s,0) WHERE id=%s', [quantity, quantity, item.id])
                cursor.execute("UPDATE core_orderpart SET stock_status='written_off', status='ARRIVED' WHERE id=%s", [part.id])
            log_move(request, item, 'write_off', quantity, f'Списано при закритті візиту №{visit.id}', part)
            written += 1
        visit.status = 'DONE'
        visit.save(update_fields=['status', 'updated_at'])
        return Response({'ok': True, 'written': written})
