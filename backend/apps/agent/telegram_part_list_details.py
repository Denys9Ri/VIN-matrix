from decimal import Decimal, InvalidOperation


FLOW_OFFER_KEYS = {
    'part_original_results': 'original_offers',
    'part_analog_results': 'analogs',
    'part_analog_offer_results': 'analog_offers',
}


def _text(value, fallback='—'):
    value = str(value or '').strip()
    return value or fallback


def _price(value):
    try:
        return f'{Decimal(str(value)).quantize(Decimal("0.01"))} грн'
    except (InvalidOperation, TypeError, ValueError):
        return 'ціна не вказана'


def _warehouse_names(offer):
    warehouses = offer.get('warehouses') if isinstance(offer, dict) else []
    if not isinstance(warehouses, list):
        return 'не вказано'

    names = []
    for warehouse in warehouses[:3]:
        if isinstance(warehouse, dict):
            name = (
                warehouse.get('name')
                or warehouse.get('warehouse')
                or warehouse.get('title')
                or warehouse.get('city')
            )
        else:
            name = warehouse
        name = str(name or '').strip()
        if name and name not in names:
            names.append(name)
    return ', '.join(names) if names else 'не вказано'


def format_offer_list_details(offers, limit=8):
    lines = []
    for index, offer in enumerate((offers or [])[:limit], start=1):
        if not isinstance(offer, dict):
            continue
        lines.extend([
            f"{index}. {_text(offer.get('brand'))} {_text(offer.get('article'))} — {_price(offer.get('buy_price'))}",
            f"   Постачальник: {_text(offer.get('source'))}",
            f"   Склад: {_warehouse_names(offer)}",
        ])
        quantity = str(offer.get('quantity') or '').strip()
        if quantity:
            lines.append(f'   Наявність: {quantity}')
    return '\n'.join(lines)


def enrich_part_offer_list(result, conversation):
    """Adds supplier and warehouse details to the Telegram list before selection."""
    if not isinstance(result, dict) or not conversation:
        return result

    context = conversation.context or {}
    flow = context.get('flow')
    offers_key = FLOW_OFFER_KEYS.get(flow)
    if not offers_key:
        return result

    text = str(result.get('text') or '')
    if not text.startswith('Знайдено') and not text.startswith('Пропозиції для аналога'):
        return result

    part = context.get('part') if isinstance(context.get('part'), dict) else {}
    details = format_offer_list_details(part.get(offers_key))
    if not details:
        return result

    enriched = dict(result)
    enriched['text'] = f'{text}\n\n{details}'[:4096]
    return enriched
