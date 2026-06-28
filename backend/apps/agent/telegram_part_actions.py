from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import PermissionDenied, ValidationError

from .actions import create_add_part_draft
from .parts_agent import search_analogs, search_original, search_selected_analog
from .tools.visits import find_visits, get_visit


INLINE_MARKUP_KEY = '_telegram_inline_markup'
FLOW_ARTICLE = 'part_article'
FLOW_ORIGINAL_RESULTS = 'part_original_results'
FLOW_SELECTED_OFFER = 'part_selected_offer'
FLOW_ANALOG_RESULTS = 'part_analog_results'
FLOW_ANALOG_OFFER_RESULTS = 'part_analog_offer_results'
FLOW_VISIT_QUERY = 'part_visit_query'
FLOW_QUANTITY = 'part_quantity'
PART_FLOWS = {
    FLOW_ARTICLE,
    FLOW_ORIGINAL_RESULTS,
    FLOW_SELECTED_OFFER,
    FLOW_ANALOG_RESULTS,
    FLOW_ANALOG_OFFER_RESULTS,
    FLOW_VISIT_QUERY,
    FLOW_QUANTITY,
}
CANCEL_VALUES = {'/cancel', 'cancel', 'скасувати', 'відміна', '✖️ скасувати'}
MAX_OFFERS = 8


def _button(text, callback_data):
    return {'text': str(text)[:64], 'callback_data': str(callback_data)[:64]}


def _markup(rows):
    return {'inline_keyboard': rows}


def _with_inline(result, markup):
    payload = dict(result or {})
    payload[INLINE_MARKUP_KEY] = markup
    return payload


def _safe_text(value, fallback='—'):
    value = str(value or '').strip()
    return value if value else fallback


def _money(value):
    try:
        return f'{Decimal(str(value)).quantize(Decimal("0.01"))} грн'
    except (InvalidOperation, TypeError, ValueError):
        return 'ціна не вказана'


def _offer_title(offer):
    return f"{_safe_text(offer.get('brand'))} {_safe_text(offer.get('article'))}"


def _offer_button_title(offer):
    text = f"{_offer_title(offer)} · {_money(offer.get('buy_price'))}"
    return text[:64]


def _format_offer(offer, header='Запчастина'):
    lines = [
        f'🔩 {header}',
        _offer_title(offer),
        f"Назва: {_safe_text(offer.get('name'))}",
        f"Постачальник: {_safe_text(offer.get('source'))}",
        f"Закупівля: {_money(offer.get('buy_price'))}",
    ]
    quantity = _safe_text(offer.get('quantity'), '')
    if quantity:
        lines.append(f'Наявність: {quantity}')
    warehouses = offer.get('warehouses')
    if isinstance(warehouses, list) and warehouses:
        warehouse_names = []
        for warehouse in warehouses[:3]:
            if isinstance(warehouse, dict):
                warehouse_names.append(_safe_text(warehouse.get('name') or warehouse.get('warehouse'), ''))
            else:
                warehouse_names.append(_safe_text(warehouse, ''))
        warehouse_names = [name for name in warehouse_names if name]
        if warehouse_names:
            lines.append(f"Склади: {', '.join(warehouse_names)}")
    return '\n'.join(lines)


def _offer_list_markup(offers, callback_prefix):
    rows = [
        [_button(_offer_button_title(offer), f'{callback_prefix}:{index}')]
        for index, offer in enumerate(offers[:MAX_OFFERS])
    ]
    rows.append([_button('✖️ Скасувати', 'p:cancel')])
    return _markup(rows)


def _selected_offer_markup(can_add):
    rows = []
    if can_add:
        rows.append([_button('➕ Додати до запису', 'p:add')])
    rows.append([_button('🔁 Показати аналоги', 'p:analogs')])
    rows.append([_button('✖️ Скасувати', 'p:cancel')])
    return _markup(rows)


def _visit_results_markup(visits):
    rows = [
        [_button(
            f"{visit.get('plate') or 'Без номера'} · {str(visit.get('client') or '')[:20]}",
            f"p:visit:{visit['id']}",
        )]
        for visit in visits[:MAX_OFFERS]
    ]
    rows.append([_button('✖️ Скасувати', 'p:cancel')])
    return _markup(rows)


def _quantity_markup():
    return _markup([
        [_button('1 шт.', 'p:qty:1'), _button('2 шт.', 'p:qty:2'), _button('4 шт.', 'p:qty:4')],
        [_button('✍️ Інша кількість', 'p:qty:custom')],
        [_button('✖️ Скасувати', 'p:cancel')],
    ])


def _save_context(conversation, flow, **values):
    context = {'flow': flow, **values}
    conversation.context = context
    conversation.save(update_fields=['context'])


def _clear_context(conversation):
    conversation.context = {}
    conversation.save(update_fields=['context'])


def _selected_offer(context):
    part = context.get('part') if isinstance(context.get('part'), dict) else {}
    offer = part.get('selected_offer')
    if not isinstance(offer, dict):
        raise ValidationError('Пропозиція запчастини вже неактуальна. Почніть пошук ще раз.')
    return offer


def _search_or_raise(func, *args):
    try:
        return func(*args)
    except PermissionError as exc:
        raise PermissionDenied(str(exc))
    except ValueError as exc:
        raise ValidationError(str(exc))


def _start_part_search(conversation):
    _save_context(conversation, FLOW_ARTICLE)
    return (
        'Введіть точний артикул запчастини. Наприклад: 0986494036.',
        'part_search_started',
        {},
    )


def start_part_search(conversation):
    return _start_part_search(conversation)


def handle_part_text(channel, conversation, text):
    context = dict(conversation.context or {})
    flow = context.get('flow')
    if flow not in PART_FLOWS:
        return None

    normalized = str(text or '').strip()
    lowered = normalized.lower()
    if lowered in CANCEL_VALUES:
        _clear_context(conversation)
        return 'Пошук запчастини скасовано.', 'part_flow_cancelled', {}

    if flow == FLOW_ARTICLE:
        offers = _search_or_raise(search_original, channel.user, normalized)
        if not offers:
            return (
                'За точним артикулом нічого не знайдено. Перевірте номер і надішліть його ще раз.',
                'part_original_not_found',
                {'article': normalized},
            )
        _save_context(
            conversation,
            FLOW_ORIGINAL_RESULTS,
            part={'original_offers': offers[:MAX_OFFERS]},
        )
        return (
            f'Знайдено {len(offers)} пропозицій. Оберіть потрібну:',
            'part_original_found',
            _with_inline({'article': normalized, 'count': len(offers)}, _offer_list_markup(offers, 'p:original')),
        )

    if flow == FLOW_VISIT_QUERY:
        visits = find_visits(channel.user, query=normalized, limit=MAX_OFFERS)
        if not visits:
            return (
                'Запис не знайдено. Надішліть номер авто, VIN, ім’я клієнта або телефон ще раз.',
                'part_visit_not_found',
                {'query': normalized},
            )
        return (
            'Оберіть запис, до якого додати запчастину:',
            'part_visit_found',
            _with_inline({'query': normalized, 'count': len(visits)}, _visit_results_markup(visits)),
        )

    if flow == FLOW_QUANTITY:
        return _create_add_part_draft(channel, conversation, normalized)

    return (
        'Оберіть дію кнопками під повідомленням або натисніть «Скасувати».',
        'part_waiting_for_callback',
        {},
    )


def _create_add_part_draft(channel, conversation, quantity):
    context = dict(conversation.context or {})
    offer = _selected_offer(context)
    visit_id = context.get('visit_id')
    if not visit_id:
        raise ValidationError('Не вдалося визначити запис. Почніть додавання ще раз.')
    try:
        quantity_value = Decimal(str(quantity).strip().replace(',', '.')).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return 'Вкажіть кількість числом, наприклад 1 або 2.5.', 'part_quantity_invalid', {}
    if quantity_value <= 0 or quantity_value > Decimal('999'):
        return 'Кількість має бути більшою за нуль і не більшою за 999.', 'part_quantity_invalid', {}

    action = create_add_part_draft(
        channel.user,
        visit_id=visit_id,
        offer=offer,
        quantity=str(quantity_value),
        conversation=conversation,
    )
    _clear_context(conversation)
    return (
        f"Чернетку додавання {_offer_title(offer)} — {quantity_value} шт. створено. "
        'Підтвердіть її в VIN-matrix → AI Agent → «Підтвердження дій».',
        'part_add_draft_created',
        {'pending_action_id': action.id, 'visit_id': int(visit_id), 'quantity': str(quantity_value)},
    )


def handle_part_callback(channel, conversation, callback_data):
    data = str(callback_data or '').strip()
    if not data.startswith('p:'):
        return None

    parts = data.split(':')
    command = parts[1] if len(parts) > 1 else ''
    context = dict(conversation.context or {})

    if command == 'cancel':
        _clear_context(conversation)
        return 'Пошук запчастини скасовано.', 'part_flow_cancelled', {}

    if command == 'original' and len(parts) == 3:
        offers = (context.get('part') or {}).get('original_offers')
        try:
            offer = offers[int(parts[2])]
        except (TypeError, ValueError, IndexError):
            raise ValidationError('Ця пропозиція вже неактуальна. Почніть пошук ще раз.')
        _save_context(conversation, FLOW_SELECTED_OFFER, part={'selected_offer': offer, 'origin': 'original'})
        return (
            _format_offer(offer, 'Обрана пропозиція'),
            'part_offer_selected',
            _with_inline({'article': offer.get('article'), 'source': offer.get('source')}, _selected_offer_markup(True)),
        )

    if command == 'analogs':
        offer = _selected_offer(context)
        analogs = _search_or_raise(search_analogs, channel.user, offer)
        if not analogs:
            return (
                'Аналогів для цієї пропозиції не знайдено.',
                'part_analogs_not_found',
                _with_inline({}, _selected_offer_markup(True)),
            )
        _save_context(
            conversation,
            FLOW_ANALOG_RESULTS,
            part={'selected_offer': offer, 'analogs': analogs[:MAX_OFFERS]},
        )
        return (
            f'Знайдено {len(analogs)} аналогів. Оберіть аналог для пошуку пропозицій:',
            'part_analogs_found',
            _with_inline({'count': len(analogs)}, _offer_list_markup(analogs, 'p:analog')),
        )

    if command == 'analog' and len(parts) == 3:
        analogs = (context.get('part') or {}).get('analogs')
        try:
            analog = analogs[int(parts[2])]
        except (TypeError, ValueError, IndexError):
            raise ValidationError('Цей аналог уже неактуальний. Почніть пошук ще раз.')
        offers = _search_or_raise(
            search_selected_analog,
            channel.user,
            analog.get('article'),
            analog.get('brand'),
        )
        if not offers:
            return (
                'За цим аналогом немає актуальних пропозицій у підключених постачальників.',
                'part_analog_offers_not_found',
                {},
            )
        _save_context(
            conversation,
            FLOW_ANALOG_OFFER_RESULTS,
            part={'analog_offers': offers[:MAX_OFFERS]},
        )
        return (
            f'Пропозиції для аналога {_offer_title(analog)}. Оберіть потрібну:',
            'part_analog_offers_found',
            _with_inline({'count': len(offers)}, _offer_list_markup(offers, 'p:analog_offer')),
        )

    if command == 'analog_offer' and len(parts) == 3:
        offers = (context.get('part') or {}).get('analog_offers')
        try:
            offer = offers[int(parts[2])]
        except (TypeError, ValueError, IndexError):
            raise ValidationError('Ця пропозиція вже неактуальна. Почніть пошук ще раз.')
        _save_context(conversation, FLOW_SELECTED_OFFER, part={'selected_offer': offer, 'origin': 'analog'})
        return (
            _format_offer(offer, 'Обраний аналог'),
            'part_analog_offer_selected',
            _with_inline({'article': offer.get('article'), 'source': offer.get('source')}, _selected_offer_markup(True)),
        )

    if command == 'add':
        offer = _selected_offer(context)
        _save_context(conversation, FLOW_VISIT_QUERY, part={'selected_offer': offer})
        return (
            'До якого запису додати запчастину? Надішліть номер авто, VIN, ім’я клієнта або телефон.',
            'part_visit_selection_started',
            {},
        )

    if command == 'visit' and len(parts) == 3:
        try:
            visit = get_visit(channel.user, parts[2])
        except ValueError as exc:
            raise ValidationError(str(exc))
        if visit.get('status') in {'CANCELLED', 'COMPLETED'}:
            raise ValidationError('До скасованого або виданого запису не можна додавати запчастини.')
        offer = _selected_offer(context)
        _save_context(conversation, FLOW_QUANTITY, part={'selected_offer': offer}, visit_id=visit['id'])
        return (
            f"Додаємо до запису {visit.get('plate') or 'без номера'} / {visit.get('client')}. Оберіть кількість:",
            'part_quantity_started',
            _with_inline({'visit_id': visit['id']}, _quantity_markup()),
        )

    if command == 'qty' and len(parts) == 3:
        if context.get('flow') != FLOW_QUANTITY:
            raise ValidationError('Спочатку оберіть запис для запчастини.')
        if parts[2] == 'custom':
            return (
                'Введіть кількість числом, наприклад 1 або 2.5.',
                'part_custom_quantity_requested',
                {},
            )
        return _create_add_part_draft(channel, conversation, parts[2])

    raise ValidationError('Ця кнопка вже неактуальна. Почніть пошук запчастини ще раз.')
