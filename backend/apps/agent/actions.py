from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.models import OrderPart, Visit

from .models import AgentPendingAction
from .services import create_pending_action, require_agent_member, write_audit


ADD_PART_ACTION = 'add_order_part'
CREATE_VISIT_ACTION = 'create_visit'


def _money(value, field_name):
    try:
        amount = Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f'Некоректне значення поля {field_name}.')
    if amount < 0:
        raise ValidationError(f'Поле {field_name} не може бути від’ємним.')
    return amount


def _quantity(value):
    try:
        amount = Decimal(str(value or 1)).quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError('Некоректна кількість.')
    if amount <= 0:
        raise ValidationError('Кількість має бути більшою за нуль.')
    return amount


def _scheduled_datetime(value):
    if isinstance(value, datetime):
        scheduled = value
    else:
        raw = str(value or '').strip()
        if not raw:
            raise ValidationError('Вкажіть дату та час запису.')
        try:
            scheduled = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        except ValueError:
            raise ValidationError('Некоректна дата запису.')

    if timezone.is_naive(scheduled):
        scheduled = timezone.make_aware(scheduled, timezone.get_current_timezone())
    return scheduled


def _visit_for_agent(company, user, access, visit_id):
    try:
        visit = Visit.objects.get(id=visit_id, company=company)
    except Visit.DoesNotExist:
        raise ValidationError('Візит не знайдено.')
    if not access.can_view_all_visits and visit.responsible_mechanic_id != user.id:
        raise PermissionDenied('У вас немає доступу до цього візиту.')
    return visit


def create_add_part_draft(user, visit_id, offer, quantity=1, sell_price=None):
    company, _, access = require_agent_member(user)
    if not access.can_add_parts:
        raise PermissionDenied('У вас немає права додавати запчастини через Agent.')
    if not isinstance(offer, dict):
        raise ValidationError('Потрібно передати обрану пропозицію запчастини.')

    visit = _visit_for_agent(company, user, access, visit_id)
    article = str(offer.get('article') or '').strip()
    brand = str(offer.get('brand') or '').strip()
    name = str(offer.get('name') or '').strip()
    source = str(offer.get('source') or '').strip()
    if not article or not brand or not name or not source:
        raise ValidationError('У пропозиції відсутні артикул, бренд, назва або постачальник.')

    buy = _money(offer.get('buy_price'), 'buy_price')
    qty = _quantity(quantity)
    default_sell = (buy * (Decimal('1') + Decimal(str(company.global_margin_percent or 0)) / Decimal('100'))).quantize(Decimal('0.01'))
    sell = _money(sell_price, 'sell_price') if sell_price is not None else default_sell

    payload = {
        'visit_id': visit.id,
        'part': {
            'brand': brand[:100],
            'article': article[:100],
            'name': name[:255],
            'supplier': source[:100],
            'supplier_color': str(offer.get('supplier_color') or '')[:80],
            'buy_price': str(buy),
            'sell_price': str(sell),
            'quantity': str(qty),
        },
    }
    summary = (
        f'Додати до візиту {visit.plate} / {visit.client}: '
        f'{brand} {article}, {qty} шт., постачальник {source}, '
        f'закупівля {buy} грн, продаж {sell} грн.'
    )
    return create_pending_action(
        user=user,
        action_type=ADD_PART_ACTION,
        payload=payload,
        summary_text=summary,
    )


def create_visit_draft(user, client, plate, phone, scheduled_datetime, comment='', conversation=None):
    company, _, access = require_agent_member(user)
    if not access.can_create_visits:
        raise PermissionDenied('У вас немає права створювати записи через Agent.')

    client = str(client or '').strip()[:100]
    plate = str(plate or '').strip().upper()[:20]
    phone = str(phone or '').strip()[:20]
    comment = str(comment or '').strip()[:2000]
    scheduled = _scheduled_datetime(scheduled_datetime)

    if not client:
        raise ValidationError('Вкажіть ім’я клієнта.')
    if not plate:
        raise ValidationError('Вкажіть номер автомобіля або позначте, що його немає.')

    payload = {
        'visit': {
            'client': client,
            'plate': plate,
            'phone': phone,
            'scheduled_datetime': scheduled.isoformat(),
            'comment': comment,
        },
    }
    phone_text = phone or 'не вказано'
    comment_text = f' Коментар: {comment}' if comment else ''
    summary = (
        f'Створити запис: {client}, авто {plate}, телефон {phone_text}, '
        f'на {timezone.localtime(scheduled).strftime("%d.%m.%Y %H:%M")}.{comment_text}'
    )
    return create_pending_action(
        user=user,
        action_type=CREATE_VISIT_ACTION,
        payload=payload,
        summary_text=summary,
        conversation=conversation,
    )


def _execute_add_part_action(company, user, access, action):
    if not access.can_add_parts:
        raise PermissionDenied('У вас немає права виконати цю дію.')

    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    part_data = action.payload.get('part') or {}
    part = OrderPart.objects.create(
        visit=visit,
        brand=str(part_data.get('brand') or '')[:100],
        article=str(part_data.get('article') or '')[:100],
        name=str(part_data.get('name') or '')[:255],
        supplier=str(part_data.get('supplier') or '')[:100],
        supplier_color=str(part_data.get('supplier_color') or '')[:80] or None,
        buy_price=_money(part_data.get('buy_price'), 'buy_price'),
        sell_price=_money(part_data.get('sell_price'), 'sell_price'),
        quantity=_quantity(part_data.get('quantity')),
        status='WAITING',
    )
    return {
        'order_part_id': part.id,
        'visit_id': visit.id,
    }


def _execute_create_visit_action(company, user, access, action):
    if not access.can_create_visits:
        raise PermissionDenied('У вас немає права виконати цю дію.')

    visit_data = action.payload.get('visit') or {}
    scheduled = _scheduled_datetime(visit_data.get('scheduled_datetime'))
    client = str(visit_data.get('client') or '').strip()[:100]
    plate = str(visit_data.get('plate') or '').strip().upper()[:20]
    phone = str(visit_data.get('phone') or '').strip()[:20]
    comment = str(visit_data.get('comment') or '').strip()[:2000]

    if not client or not plate:
        raise ValidationError('У чернетці бракує клієнта або номера автомобіля.')

    visit = Visit.objects.create(
        company=company,
        client=client,
        plate=plate,
        phone=phone,
        scheduled_datetime=scheduled,
        comment=comment,
        status='SELECTION',
        delivery_type='pickup',
        payment_status='unpaid',
    )
    return {
        'visit_id': visit.id,
        'client': visit.client,
        'plate': visit.plate,
    }


def execute_confirmed_action(user, action_id):
    company, _, access = require_agent_member(user)

    with transaction.atomic():
        try:
            action = (
                AgentPendingAction.objects
                .select_for_update()
                .get(id=action_id, company=company, user=user)
            )
        except AgentPendingAction.DoesNotExist:
            raise ValidationError('Чернетку не знайдено.')

        if action.status == AgentPendingAction.STATUS_EXECUTED:
            return {'action_id': action.id, 'status': action.status, 'result': 'already_executed'}
        if action.status != AgentPendingAction.STATUS_CONFIRMED:
            raise ValidationError('Спочатку підтвердьте дію.')
        if action.expires_at <= timezone.now():
            action.status = AgentPendingAction.STATUS_EXPIRED
            action.save(update_fields=['status'])
            raise ValidationError('Час виконання чернетки сплив.')

        if action.action_type == ADD_PART_ACTION:
            result = _execute_add_part_action(company, user, access, action)
        elif action.action_type == CREATE_VISIT_ACTION:
            result = _execute_create_visit_action(company, user, access, action)
        else:
            raise ValidationError('Для цього типу дії ще немає виконавця.')

        action.status = AgentPendingAction.STATUS_EXECUTED
        action.executed_at = timezone.now()
        action.error_message = ''
        action.save(update_fields=['status', 'executed_at', 'error_message'])

    write_audit(
        company=company,
        user=user,
        conversation=action.conversation,
        recognized_intent='pending_action_executed',
        tool_name=action.action_type,
        tool_result={'pending_action_id': action.id, **result},
    )
    return {
        'action_id': action.id,
        'status': action.status,
        'result': result,
    }
