from decimal import Decimal
from django.db import connection, transaction


RESERVED = 'reserved'
SOLD = 'sold'
RELEASED = 'released'
RETURNED = 'returned'
DEFECTIVE = 'defective'
NONE = 'none'


def _int_qty(value):
    try:
        qty = int(Decimal(str(value or 0)))
    except Exception:
        qty = 0
    return max(qty, 0)


def _norm(value):
    return ''.join(ch for ch in str(value or '').upper().strip() if ch.isalnum())


def _part_label(part):
    brand = (getattr(part, 'brand', '') or '').strip()
    article = (getattr(part, 'article', '') or '').strip()
    name = (getattr(part, 'name', '') or '').strip()
    return f'{brand} {article}'.strip() or name or 'Товар'


def _company_mode(company):
    return 'store' if getattr(company, 'business_type', '') == 'store' else 'sto'


def _log_stock_activity(part, inventory, action_type, title, description, qty=0, reason='', comment=''):
    try:
        from .activity import log_activity
        visit = getattr(part, 'visit', None)
        company = getattr(visit, 'company', None) or getattr(inventory, 'company', None)
        if not company:
            return None
        return log_activity(
            company=company,
            user=None,
            visit=visit,
            order_part=part,
            inventory_item=inventory,
            mode=_company_mode(company),
            action_type=action_type,
            title=title,
            description=description,
            metadata={
                'brand': getattr(part, 'brand', '') or getattr(inventory, 'brand', '') or '',
                'article': getattr(part, 'article', '') or getattr(inventory, 'article', '') or '',
                'part_name': getattr(part, 'name', '') or getattr(inventory, 'name', '') or '',
                'quantity': int(qty or 0),
                'reason': reason or '',
                'comment': comment or '',
                'stock_action': action_type,
            }
        )
    except Exception as exc:
        print(f'ACTIVITY STOCK LOG failed: {exc}')
        return None


def _stock_extra(inventory_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT quantity, reserved_quantity FROM core_inventoryitem WHERE id=%s', [inventory_id])
            row = cursor.fetchone()
        if not row:
            return 0, 0
        return int(row[0] or 0), int(row[1] or 0)
    except Exception as exc:
        print(f'STOCK SYNC: cannot read stock extra for item={inventory_id}: {exc}')
        return 0, 0


def _change_stock_reserved(inventory_id, delta):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE core_inventoryitem SET reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) + %s, 0) WHERE id=%s',
                [int(delta or 0), inventory_id]
            )
        return True
    except Exception as exc:
        print(f'STOCK SYNC: cannot update stock reserve item={inventory_id}: {exc}')
        return False


def _sell_stock(inventory_id, qty, reserved_to_remove=0):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE core_inventoryitem
                SET quantity = quantity - %s,
                    reserved_quantity = GREATEST(COALESCE(reserved_quantity, 0) - %s, 0)
                WHERE id = %s AND quantity >= %s
                RETURNING quantity, reserved_quantity
                ''',
                [int(qty or 0), int(reserved_to_remove or 0), inventory_id, int(qty or 0)]
            )
            row = cursor.fetchone()
        if not row:
            print(f'STOCK SYNC: sell SQL did not update stock={inventory_id}; requested={qty}')
            return False
        print(f'STOCK SYNC: stock item={inventory_id} new_quantity={row[0]} new_reserved={row[1]}')
        return True
    except Exception as exc:
        print(f'STOCK SYNC: cannot sell stock item={inventory_id}: {exc}')
        return False


def _return_stock(inventory_id, qty):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE core_inventoryitem
                SET quantity = quantity + %s
                WHERE id = %s
                RETURNING quantity, reserved_quantity
                ''',
                [int(qty or 0), inventory_id]
            )
            row = cursor.fetchone()
        if not row:
            print(f'STOCK SYNC: return SQL did not update stock={inventory_id}; qty={qty}')
            return False
        print(f'STOCK SYNC: returned to stock item={inventory_id} new_quantity={row[0]} new_reserved={row[1]}')
        return True
    except Exception as exc:
        print(f'STOCK SYNC: cannot return stock item={inventory_id}: {exc}')
        return False


def _get_extra(part_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT inventory_item_id, stock_status, reserved_quantity FROM core_orderpart WHERE id=%s', [part_id])
            row = cursor.fetchone()
        if not row:
            return None, NONE, 0
        return row[0], row[1] or NONE, int(row[2] or 0)
    except Exception as exc:
        print(f'STOCK SYNC: cannot read extra fields for part={part_id}: {exc}')
        return None, NONE, 0


def _set_part_extra(part_id, inventory_item_id=None, stock_status=NONE, reserved_quantity=0):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE core_orderpart SET inventory_item_id=%s, stock_status=%s, reserved_quantity=%s WHERE id=%s',
                [inventory_item_id, stock_status, int(reserved_quantity or 0), part_id]
            )
    except Exception as exc:
        print(f'STOCK SYNC: cannot write extra fields for part={part_id}: {exc}')


def _find_inventory_item(part):
    if not part or not getattr(part, 'visit', None):
        return None
    from .models import InventoryItem
    brand = (part.brand or '').strip()
    article = (part.article or '').strip()
    if not article:
        print(f'STOCK SYNC: inventory not found because article is empty for part={getattr(part, "id", None)}')
        return None

    exact = InventoryItem.objects.filter(company=part.visit.company, article__iexact=article)
    if brand:
        exact_brand = exact.filter(brand__iexact=brand).order_by('-quantity', 'id').first()
        if exact_brand:
            print(f'STOCK SYNC: found exact stock item id={exact_brand.id} for brand={brand} article={article}')
            return exact_brand

    article_matches = list(exact.order_by('-quantity', 'id')[:3])
    if len(article_matches) == 1:
        print(f'STOCK SYNC: found stock by article only id={article_matches[0].id} for part_brand={brand} article={article}')
        return article_matches[0]

    if len(article_matches) > 1:
        part_brand_norm = _norm(brand)
        for item in article_matches:
            item_brand_norm = _norm(item.brand)
            if item_brand_norm and part_brand_norm and (item_brand_norm in part_brand_norm or part_brand_norm in item_brand_norm):
                print(f'STOCK SYNC: found stock by fuzzy brand id={item.id} stock_brand={item.brand} part_brand={brand} article={article}')
                return item
        print(f'STOCK SYNC: multiple stock items for article={article}; manual selection needed')
        return None

    print(f'STOCK SYNC: inventory not found for part brand={brand} article={article}')
    return None


def _create_stock_movement(part, inventory, qty, note):
    try:
        from .models import StockMovement
        StockMovement.objects.create(
            company=part.visit.company,
            inventory_item=inventory,
            movement_type='adjustment',
            source_order_part=part,
            brand=part.brand,
            article=part.article,
            name=part.name,
            quantity=int(qty or 0),
            buy_price=getattr(part, 'buy_price', 0) or 0,
            sell_price=getattr(part, 'sell_price', 0) or 0,
            note=note,
            created_by=None,
        )
    except Exception as exc:
        print(f'STOCK SYNC: movement create failed for part={getattr(part, "id", None)}: {exc}')


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
            _change_stock_reserved(existing_inventory_id, -existing_reserved)

        stock_qty, stock_reserved = _stock_extra(inventory.id)
        available = max(stock_qty - stock_reserved, 0)
        if available < qty:
            print(f'STOCK SYNC: cannot reserve part={part.id}; stock={inventory.id}; available={available}; requested={qty}')
            _set_part_extra(part.id, inventory.id, NONE, 0)
            return False

        if not _change_stock_reserved(inventory.id, qty):
            return False
        _set_part_extra(part.id, inventory.id, RESERVED, qty)
        _create_stock_movement(part, inventory, 0, f'Резерв товару під замовлення №{part.visit_id}: {qty} шт')
        _log_stock_activity(part, inventory, 'stock_reserved', 'Резерв зі складу', f'{_part_label(part)} · {qty} шт · замовлення/візит №{part.visit_id}', qty=qty)
        print(f'STOCK SYNC: reserved part={part.id}; stock={inventory.id}; qty={qty}')
        return True


def release_order_part(part, reason='Зняття резерву', comment=''):
    if not part:
        return False
    inventory_id, status, reserved_qty = _get_extra(part.id)
    if status != RESERVED or not inventory_id or reserved_qty <= 0:
        return False
    from .models import InventoryItem
    with transaction.atomic():
        inventory = InventoryItem.objects.select_for_update().get(id=inventory_id)
        _change_stock_reserved(inventory_id, -reserved_qty)
        _set_part_extra(part.id, inventory_id, RELEASED, 0)
        _create_stock_movement(part, inventory, 0, f'{reason}. Замовлення №{part.visit_id}. {comment}'.strip())
        _log_stock_activity(part, inventory, 'stock_released', 'Знято резерв зі складу', f'{_part_label(part)} · {reserved_qty} шт · {reason}', qty=reserved_qty, reason=reason, comment=comment)
    print(f'STOCK SYNC: released reserve part={part.id}; stock={inventory_id}; qty={reserved_qty}')
    return True


def sell_order_part(part):
    from .models import InventoryItem
    if not part:
        return False
    qty = _int_qty(getattr(part, 'quantity', 1)) or 1
    inventory_id, status, reserved_qty = _get_extra(part.id)
    print(f'STOCK SYNC: sell request part={part.id}; brand={part.brand}; article={part.article}; visit={part.visit_id}; status={getattr(part.visit, "status", None)}')
    if status == SOLD:
        print(f'STOCK SYNC: part={part.id} already sold')
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
        _set_part_extra(part.id, None, NONE, 0)
        return False

    with transaction.atomic():
        inventory = InventoryItem.objects.select_for_update().get(id=inventory.id)
        stock_qty, _stock_reserved = _stock_extra(inventory.id)
        if stock_qty < qty:
            print(f'STOCK SYNC: cannot sell part={part.id}; stock={inventory.id}; current={stock_qty}; requested={qty}')
            _set_part_extra(part.id, inventory.id, NONE, 0)
            return False
        if not _sell_stock(inventory.id, qty, reserved_qty):
            return False
        _set_part_extra(part.id, inventory.id, SOLD, 0)
        _create_stock_movement(part, inventory, -qty, f'Списання при виконанні замовлення №{part.visit_id}')
        _log_stock_activity(part, inventory, 'stock_sold', 'Списано товар зі складу', f'{_part_label(part)} · {qty} шт · замовлення/візит №{part.visit_id}', qty=-qty)
    print(f'STOCK SYNC: sold part={part.id}; stock={inventory.id}; qty={qty}')
    return True


def return_order_part_to_stock(part, quantity=None, reason='Повернення товару', comment='', return_to_stock=True):
    from .models import InventoryItem
    if not part:
        return False, 'Товар не знайдено'
    full_qty = _int_qty(getattr(part, 'quantity', 1)) or 1
    qty = _int_qty(quantity) or full_qty
    qty = min(qty, full_qty)
    inventory_id, status, reserved_qty = _get_extra(part.id)

    if status in [RETURNED, DEFECTIVE]:
        return False, 'Цей товар уже повернений або списаний як брак'
    if status == RESERVED:
        ok = release_order_part(part, reason=reason, comment=comment)
        return ok, 'Резерв знято' if ok else 'Не вдалося зняти резерв'
    if status != SOLD or not inventory_id:
        _set_part_extra(part.id, inventory_id, DEFECTIVE if not return_to_stock else RETURNED, 0)
        return True, 'Товар не був списаний зі складу, склад не змінювався'

    with transaction.atomic():
        inventory = InventoryItem.objects.select_for_update().get(id=inventory_id)
        if return_to_stock:
            if not _return_stock(inventory_id, qty):
                return False, 'Не вдалося повернути товар на склад'
            _set_part_extra(part.id, inventory_id, RETURNED, 0)
            _create_stock_movement(part, inventory, qty, f'Повернення на склад. Причина: {reason}. Замовлення №{part.visit_id}. {comment}'.strip())
            _log_stock_activity(part, inventory, 'stock_returned', 'Повернення на склад', f'{_part_label(part)} · {qty} шт · причина: {reason}', qty=qty, reason=reason, comment=comment)
            return True, 'Товар повернуто на склад'
        _set_part_extra(part.id, inventory_id, DEFECTIVE, 0)
        _create_stock_movement(part, inventory, 0, f'Брак / не повернуто на склад. Причина: {reason}. Замовлення №{part.visit_id}. {comment}'.strip())
        _log_stock_activity(part, inventory, 'stock_defective', 'Товар позначено як брак', f'{_part_label(part)} · причина: {reason}', qty=0, reason=reason, comment=comment)
        return True, 'Товар позначено як брак, склад не збільшувався'


def delete_order_part_with_stock(part, stock_action='return', reason='Видалення позиції', comment=''):
    if not part:
        return False, 'Товар не знайдено'
    inventory_id, status, reserved_qty = _get_extra(part.id)
    if status == RESERVED:
        release_order_part(part, reason=reason, comment=comment)
    elif status == SOLD and inventory_id and stock_action == 'return':
        ok, message = return_order_part_to_stock(part, quantity=getattr(part, 'quantity', 1), reason=reason, comment=comment, return_to_stock=True)
        if not ok:
            return False, message
    elif status == SOLD and inventory_id and stock_action == 'defect':
        return_order_part_to_stock(part, quantity=getattr(part, 'quantity', 1), reason=reason, comment=comment, return_to_stock=False)
    return True, 'Товар можна видаляти'


def sync_order_part_after_update(part, old_quantity=None):
    if not part:
        return False
    old_qty = _int_qty(old_quantity)
    new_qty = _int_qty(getattr(part, 'quantity', 1)) or 1
    inventory_id, status, reserved_qty = _get_extra(part.id)
    if old_qty <= 0 or old_qty == new_qty:
        return True
    delta = new_qty - old_qty
    if status == SOLD and inventory_id:
        if delta > 0:
            part.quantity = delta
            ok = sell_order_part(part)
            part.quantity = new_qty
            return ok
        if delta < 0:
            part.quantity = abs(delta)
            ok, _msg = return_order_part_to_stock(part, quantity=abs(delta), reason='Зменшення кількості в замовленні', return_to_stock=True)
            part.quantity = new_qty
            if ok:
                _set_part_extra(part.id, inventory_id, SOLD, 0)
            return ok
    if status == RESERVED and inventory_id:
        if delta > 0:
            stock_qty, stock_reserved = _stock_extra(inventory_id)
            available = max(stock_qty - stock_reserved, 0)
            if available < delta:
                print(f'STOCK SYNC: cannot increase reserve for part={part.id}; available={available}; delta={delta}')
                return False
            _change_stock_reserved(inventory_id, delta)
        elif delta < 0:
            _change_stock_reserved(inventory_id, delta)
        _set_part_extra(part.id, inventory_id, RESERVED, new_qty)
        return True
    return True


def reserve_visit_parts(visit):
    reserved = 0
    failed = 0
    for part in visit.parts.all():
        if reserve_order_part(part): reserved += 1
        else: failed += 1
    return reserved, failed


def release_visit_parts(visit):
    released = 0
    for part in visit.parts.all():
        if release_order_part(part): released += 1
    return released


def sell_visit_parts(visit):
    sold = 0
    failed = 0
    for part in visit.parts.all():
        _inventory_id, status, _reserved_qty = _get_extra(part.id)
        if status in [SOLD, RETURNED, DEFECTIVE]:
            continue
        if sell_order_part(part): sold += 1
        else: failed += 1
    print(f'STOCK SYNC: visit={visit.id}; sold={sold}; failed={failed}')
    return sold, failed


def sync_visit_stock_for_status(visit):
    status = getattr(visit, 'status', '')
    if status == 'COMPLETED': return sell_visit_parts(visit)
    if status == 'CANCELLED': return release_visit_parts(visit), 0
    return reserve_visit_parts(visit)


def sync_order_part_after_create(part):
    visit_status = getattr(getattr(part, 'visit', None), 'status', '')
    if visit_status == 'COMPLETED': return sell_order_part(part)
    if visit_status == 'CANCELLED':
        _set_part_extra(part.id, None, RELEASED, 0)
        return False
    return reserve_order_part(part)


def attach_stock_workflow():
    from django.db.models.signals import post_save
    from .models import OrderPart, Visit

    def order_part_post_save(sender, instance, created=False, **kwargs):
        if not created: return
        try: sync_order_part_after_create(instance)
        except Exception as exc: print(f'Stock sync after order part save failed: {exc}')

    def visit_post_save(sender, instance, created=False, **kwargs):
        if created: return
        try: sync_visit_stock_for_status(instance)
        except Exception as exc: print(f'Stock sync after visit save failed: {exc}')

    post_save.connect(order_part_post_save, sender=OrderPart, dispatch_uid='vin_matrix_order_part_stock_sync')
    post_save.connect(visit_post_save, sender=Visit, dispatch_uid='vin_matrix_visit_stock_sync')
    print('STOCK SYNC: signals attached')
