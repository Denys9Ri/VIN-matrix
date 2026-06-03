from decimal import Decimal
from django.db import connection, transaction
from django.db.models import F


RESERVED = 'reserved'
SOLD = 'sold'
RELEASED = 'released'
NONE = 'none'


def _int_qty(value):
    try:
        qty = int(Decimal(str(value or 0)))
    except Exception:
        qty = 0
    return max(qty, 0)


def _get_extra(part_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT inventory_item_id, stock_status, reserved_quantity FROM core_orderpart WHERE id=%s', [part_id])
            row = cursor.fetchone()
        if not row:
            return None, NONE, 0
        return row[0], row[1] or NONE, int(row[2] or 0)
    except Exception:
        return None, NONE, 0


def _set_part_extra(part_id, inventory_item_id=None, stock_status=NONE, reserved_quantity=0):
    with connection.cursor() as cursor:
        cursor.execute(
            'UPDATE core_orderpart SET inventory_item_id=%s, stock_status=%s, reserved_quantity=%s WHERE id=%s',
            [inventory_item_id, stock_status, int(reserved_quantity or 0), part_id]
        )


def _find_inventory_item(part):
    if not part or not getattr(part, 'visit', None):
        return None
    from .models import InventoryItem
    brand = (part.brand or '').strip()
    article = (part.article or '').strip()
    if not article:
        return None
    qs = InventoryItem.objects.filter(company=part.visit.company, article__iexact=article)
    if brand:
        qs = qs.filter(brand__iexact=brand)
    return qs.order_by('-quantity', 'id').first()


def reserve_order_part(part, inventory_item=None):
    from .models import InventoryItem
    if not part:
        return False
    qty = _int_qty(getattr(part, 'quantity', 1)) or 1
    if qty <= 0:
        return False

    with transaction.atomic():
        inventory = inventory_item or _find_inventory_item(part)
        if not inventory:
            _set_part_extra(part.id, None, NONE, 0)
            return False

        inventory = InventoryItem.objects.select_for_update().get(id=inventory.id)
        existing_inventory_id, existing_status, existing_reserved = _get_extra(part.id)
        if existing_status == SOLD:
            return True
        if existing_status == RESERVED and existing_inventory_id == inventory.id and existing_reserved == qty:
            return True

        if existing_status == RESERVED and existing_inventory_id:
            InventoryItem.objects.filter(id=existing_inventory_id).update(
                reserved_quantity=F('reserved_quantity') - existing_reserved
            )

        available = max(int(inventory.quantity or 0) - int(getattr(inventory, 'reserved_quantity', 0) or 0), 0)
        if available < qty:
            _set_part_extra(part.id, inventory.id, NONE, 0)
            return False

        InventoryItem.objects.filter(id=inventory.id).update(reserved_quantity=F('reserved_quantity') + qty)
        _set_part_extra(part.id, inventory.id, RESERVED, qty)
        return True


def release_order_part(part):
    from .models import InventoryItem
    if not part:
        return False
    inventory_id, status, reserved_qty = _get_extra(part.id)
    if status != RESERVED or not inventory_id or reserved_qty <= 0:
        return False
    with transaction.atomic():
        InventoryItem.objects.filter(id=inventory_id).update(reserved_quantity=F('reserved_quantity') - reserved_qty)
        _set_part_extra(part.id, inventory_id, RELEASED, 0)
    return True


def sell_order_part(part):
    from .models import InventoryItem, StockMovement
    if not part:
        return False
    qty = _int_qty(getattr(part, 'quantity', 1)) or 1
    inventory_id, status, reserved_qty = _get_extra(part.id)
    if status == SOLD:
        return True
    inventory = None
    if inventory_id:
        try:
            inventory = InventoryItem.objects.get(id=inventory_id)
        except InventoryItem.DoesNotExist:
            inventory = None
    if not inventory:
        inventory = _find_inventory_item(part)
    if not inventory:
        return False

    with transaction.atomic():
        inventory = InventoryItem.objects.select_for_update().get(id=inventory.id)
        current_qty = int(inventory.quantity or 0)
        if current_qty < qty:
            return False
        new_reserved = max(int(getattr(inventory, 'reserved_quantity', 0) or 0) - int(reserved_qty or 0), 0)
        InventoryItem.objects.filter(id=inventory.id).update(quantity=F('quantity') - qty, reserved_quantity=new_reserved)
        _set_part_extra(part.id, inventory.id, SOLD, 0)
        try:
            StockMovement.objects.create(
                company=part.visit.company,
                inventory_item=inventory,
                movement_type='sale',
                source_order_part=part,
                brand=part.brand,
                article=part.article,
                name=part.name,
                quantity=-qty,
                buy_price=getattr(part, 'buy_price', 0) or 0,
                sell_price=getattr(part, 'sell_price', 0) or 0,
                note=f'Списання при виконанні замовлення №{part.visit_id}',
                created_by=None,
            )
        except Exception:
            pass
    return True


def reserve_visit_parts(visit):
    reserved = 0
    failed = 0
    for part in visit.parts.all():
        if reserve_order_part(part):
            reserved += 1
        else:
            failed += 1
    return reserved, failed


def release_visit_parts(visit):
    released = 0
    for part in visit.parts.all():
        if release_order_part(part):
            released += 1
    return released


def sell_visit_parts(visit):
    sold = 0
    failed = 0
    for part in visit.parts.all():
        inventory_id, status, _reserved_qty = _get_extra(part.id)
        if status == SOLD:
            continue
        if sell_order_part(part):
            sold += 1
        elif inventory_id:
            failed += 1
    return sold, failed


def sync_visit_stock_for_status(visit):
    status = getattr(visit, 'status', '')
    if status == 'COMPLETED':
        return sell_visit_parts(visit)
    if status == 'CANCELLED':
        return release_visit_parts(visit), 0
    return reserve_visit_parts(visit)


def sync_order_part_after_create(part):
    visit_status = getattr(getattr(part, 'visit', None), 'status', '')
    if visit_status == 'COMPLETED':
        return sell_order_part(part)
    if visit_status == 'CANCELLED':
        _set_part_extra(part.id, None, RELEASED, 0)
        return False
    return reserve_order_part(part)


def attach_stock_workflow():
    from .views import OrderPartViewSet, VisitViewSet
    original_order_part_perform_create = OrderPartViewSet.perform_create

    if getattr(OrderPartViewSet, '_stock_reservation_attached', False):
        return

    def perform_create_with_stock(self, serializer):
        original_order_part_perform_create(self, serializer)
        try:
            sync_order_part_after_create(serializer.instance)
        except Exception as exc:
            print(f'Stock sync after part create failed: {exc}')

    def perform_update_with_stock(self, serializer):
        instance = serializer.save()
        try:
            sync_visit_stock_for_status(instance)
        except Exception as exc:
            print(f'Stock sync after visit update failed: {exc}')
        return instance

    OrderPartViewSet.perform_create = perform_create_with_stock
    VisitViewSet.perform_update = perform_update_with_stock
    OrderPartViewSet._stock_reservation_attached = True
