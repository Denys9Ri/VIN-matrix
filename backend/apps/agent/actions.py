from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.models import OrderPart, Visit, WorkPost

from .models import AgentPendingAction
from .services import create_pending_action, require_agent_member, write_audit


ADD_PART_ACTION = 'add_order_part'
CREATE_VISIT_ACTION = 'create_visit'
RESCHEDULE_VISIT_ACTION = 'reschedule_visit'
CANCEL_VISIT_ACTION = 'cancel_visit'
UPDATE_VISIT_STATUS_ACTION = 'update_visit_status'
ASSIGN_VISIT_ACTION = 'assign_visit'

STATUS_LABELS = {
    'SELECTION': 'У черзі',
    'PENDING': 'У черзі',
    'IN_PROGRESS': 'В роботі',
    'DONE': 'Готово',
    'COMPLETED': 'Видано',
    'CANCELLED': 'Скасовано',
}

STATUS_TRANSITIONS = {
    'SELECTION': {'IN_PROGRESS', 'CANCELLED'},
    'PENDING': {'IN_PROGRESS', 'CANCELLED'},
    'IN_PROGRESS': {'DONE', 'CANCELLED'},
    'DONE': {'IN_PROGRESS', 'COMPLETED', 'CANCELLED'},
    'COMPLETED': set(),
    'CANCELLED': set(),
}


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


def _scheduled_datetime(value, *, require_future=False):
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
    if require_future and scheduled <= timezone.now():
        raise ValidationError('Дата й час мають бути в майбутньому.')
    return scheduled


def _visit_for_agent(company, user, access, visit_id):
    try:
        visit = Visit.objects.select_related('work_post', 'responsible_mechanic').get(id=visit_id, company=company)
    except Visit.DoesNotExist:
        raise ValidationError('Візит не знайдено.')
    if not access.can_view_all_visits and visit.responsible_mechanic_id != user.id:
        raise PermissionDenied('У вас немає доступу до цього візиту.')
    return visit


def _require_visit_update_access(access):
    if not access.can_update_visits:
        raise PermissionDenied('У вас немає права змінювати записи через Agent.')


def _visit_version(visit):
    return visit.updated_at.isoformat() if visit.updated_at else ''


def _ensure_visit_not_changed(visit, expected_updated_at):
    if expected_updated_at and _visit_version(visit) != str(expected_updated_at):
        raise ValidationError('Запис змінився після створення чернетки. Створіть дію ще раз.')


def _active_work_post(company, work_post_id):
    if work_post_id in [None, '']:
        return None
    try:
        return WorkPost.objects.get(id=int(work_post_id), company=company, is_active=True)
    except (TypeError, ValueError, WorkPost.DoesNotExist):
        raise ValidationError('Активний пост для цього запису не знайдено.')


def _company_mechanic(company, mechanic_id):
    if mechanic_id in [None, '']:
        return None
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        return User.objects.get(id=int(mechanic_id), employee_profile__company=company)
    except (TypeError, ValueError, User.DoesNotExist):
        raise ValidationError('Працівника цієї компанії не знайдено.')


def _visit_summary(visit):
    time_value = timezone.localtime(visit.scheduled_datetime).strftime('%d.%m.%Y %H:%M') if visit.scheduled_datetime else 'без часу'
    return f'{visit.plate} / {visit.client} / {time_value}'


def _create_visit_action(user, action_type, visit, payload, summary_text, conversation=None):
    return create_pending_action(
        user=user,
        action_type=action_type,
        payload={
            'visit_id': visit.id,
            'expected_updated_at': _visit_version(visit),
            **payload,
        },
        summary_text=summary_text,
        conversation=conversation,
    )


def create_add_part_draft(user, visit_id, offer, quantity=1, sell_price=None, conversation=None):
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
    return _create_visit_action(user, ADD_PART_ACTION, visit, payload, summary, conversation=conversation)


def create_visit_draft(user, client, plate, phone, scheduled_datetime, comment='', conversation=None):
    company, _, access = require_agent_member(user)
    if not access.can_create_visits:
        raise PermissionDenied('У вас немає права створювати записи через Agent.')

    client = str(client or '').strip()[:100]
    plate = str(plate or '').strip().upper()[:20]
    phone = str(phone or '').strip()[:20]
    comment = str(comment or '').strip()[:2000]
    scheduled = _scheduled_datetime(scheduled_datetime, require_future=True)

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


def create_reschedule_visit_draft(user, visit_id, scheduled_datetime, conversation=None):
    company, _, access = require_agent_member(user)
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, visit_id)
    if visit.status in {'CANCELLED', 'COMPLETED'}:
        raise ValidationError('Цей запис уже закритий і його не можна перенести через Agent.')
    scheduled = _scheduled_datetime(scheduled_datetime, require_future=True)
    summary = f'Перенести запис {_visit_summary(visit)} на {timezone.localtime(scheduled).strftime("%d.%m.%Y %H:%M")}.'
    return _create_visit_action(
        user,
        RESCHEDULE_VISIT_ACTION,
        visit,
        {'scheduled_datetime': scheduled.isoformat()},
        summary,
        conversation=conversation,
    )


def create_cancel_visit_draft(user, visit_id, reason='', conversation=None):
    company, _, access = require_agent_member(user)
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, visit_id)
    if visit.status == 'CANCELLED':
        raise ValidationError('Цей запис уже скасований.')
    if visit.status == 'COMPLETED':
        raise ValidationError('Виданий запис не можна скасувати через Agent.')
    reason = str(reason or '').strip()[:1000]
    reason_text = f' Причина: {reason}' if reason else ''
    return _create_visit_action(
        user,
        CANCEL_VISIT_ACTION,
        visit,
        {'reason': reason},
        f'Скасувати запис {_visit_summary(visit)}.{reason_text}',
        conversation=conversation,
    )


def create_update_visit_status_draft(user, visit_id, new_status, conversation=None):
    company, _, access = require_agent_member(user)
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, visit_id)
    new_status = str(new_status or '').strip().upper()
    if new_status not in STATUS_LABELS:
        raise ValidationError('Непідтримуваний статус запису.')
    if new_status not in STATUS_TRANSITIONS.get(visit.status, set()):
        raise ValidationError(f'Не можна змінити статус «{STATUS_LABELS.get(visit.status, visit.status)}» на «{STATUS_LABELS[new_status]}».')
    return _create_visit_action(
        user,
        UPDATE_VISIT_STATUS_ACTION,
        visit,
        {'status': new_status},
        f'Змінити статус запису {_visit_summary(visit)}: «{STATUS_LABELS.get(visit.status, visit.status)}» → «{STATUS_LABELS[new_status]}».',
        conversation=conversation,
    )


def create_assign_visit_draft(user, visit_id, work_post_id=None, mechanic_id=None, conversation=None):
    company, _, access = require_agent_member(user)
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, visit_id)
    if visit.status in {'CANCELLED', 'COMPLETED'}:
        raise ValidationError('Закритий запис не можна перепризначати через Agent.')
    work_post = _active_work_post(company, work_post_id)
    mechanic = _company_mechanic(company, mechanic_id)
    if not work_post and not mechanic:
        raise ValidationError('Оберіть пост або відповідального працівника.')
    if mechanic and not access.can_view_all_visits and mechanic.id != user.id:
        raise PermissionDenied('Ви можете призначити відповідальним лише себе.')
    payload = {
        'work_post_id': work_post.id if work_post else None,
        'mechanic_id': mechanic.id if mechanic else None,
    }
    details = []
    if work_post:
        details.append(f'пост «{work_post.name}»')
    if mechanic:
        details.append(f'майстер {mechanic.get_full_name() or mechanic.username}')
    return _create_visit_action(
        user,
        ASSIGN_VISIT_ACTION,
        visit,
        payload,
        f'Призначити для запису {_visit_summary(visit)}: {", ".join(details)}.',
        conversation=conversation,
    )


def _execute_add_part_action(company, user, access, action):
    if not access.can_add_parts:
        raise PermissionDenied('У вас немає права виконати цю дію.')

    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    _ensure_visit_not_changed(visit, action.payload.get('expected_updated_at'))
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
    return {'order_part_id': part.id, 'visit_id': visit.id}


def _execute_create_visit_action(company, user, access, action):
    if not access.can_create_visits:
        raise PermissionDenied('У вас немає права виконати цю дію.')

    visit_data = action.payload.get('visit') or {}
    scheduled = _scheduled_datetime(visit_data.get('scheduled_datetime'), require_future=True)
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
    return {'visit_id': visit.id, 'client': visit.client, 'plate': visit.plate}


def _execute_reschedule_visit_action(company, user, access, action):
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    _ensure_visit_not_changed(visit, action.payload.get('expected_updated_at'))
    if visit.status in {'CANCELLED', 'COMPLETED'}:
        raise ValidationError('Цей запис уже закритий і його не можна перенести.')
    old_time = visit.scheduled_datetime
    visit.scheduled_datetime = _scheduled_datetime(action.payload.get('scheduled_datetime'), require_future=True)
    visit.save(update_fields=['scheduled_datetime', 'updated_at'])
    return {
        'visit_id': visit.id,
        'old_scheduled_datetime': old_time.isoformat() if old_time else None,
        'scheduled_datetime': visit.scheduled_datetime.isoformat(),
    }


def _execute_cancel_visit_action(company, user, access, action):
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    _ensure_visit_not_changed(visit, action.payload.get('expected_updated_at'))
    if visit.status in {'CANCELLED', 'COMPLETED'}:
        raise ValidationError('Цей запис уже закритий і не може бути скасований.')
    reason = str(action.payload.get('reason') or '').strip()
    note = 'Скасовано через VIN-matrix Agent.' + (f' Причина: {reason}' if reason else '')
    visit.status = 'CANCELLED'
    visit.comment = f'{visit.comment}\n{note}'.strip() if visit.comment else note
    visit.save(update_fields=['status', 'comment', 'updated_at'])
    return {'visit_id': visit.id, 'status': visit.status}


def _execute_update_visit_status_action(company, user, access, action):
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    _ensure_visit_not_changed(visit, action.payload.get('expected_updated_at'))
    new_status = str(action.payload.get('status') or '').strip().upper()
    if new_status not in STATUS_LABELS:
        raise ValidationError('У чернетці вказано непідтримуваний статус.')
    if new_status not in STATUS_TRANSITIONS.get(visit.status, set()):
        raise ValidationError('Статус запису змінився. Створіть дію ще раз.')
    old_status = visit.status
    visit.status = new_status
    visit.save(update_fields=['status', 'updated_at'])
    return {'visit_id': visit.id, 'old_status': old_status, 'status': visit.status}


def _execute_assign_visit_action(company, user, access, action):
    _require_visit_update_access(access)
    visit = _visit_for_agent(company, user, access, action.payload.get('visit_id'))
    _ensure_visit_not_changed(visit, action.payload.get('expected_updated_at'))
    if visit.status in {'CANCELLED', 'COMPLETED'}:
        raise ValidationError('Закритий запис не можна перепризначати.')
    work_post = _active_work_post(company, action.payload.get('work_post_id'))
    mechanic = _company_mechanic(company, action.payload.get('mechanic_id'))
    if mechanic and not access.can_view_all_visits and mechanic.id != user.id:
        raise PermissionDenied('Ви можете призначити відповідальним лише себе.')
    if work_post:
        visit.work_post = work_post
    if mechanic:
        visit.responsible_mechanic = mechanic
    visit.save(update_fields=['work_post', 'responsible_mechanic', 'updated_at'])
    return {
        'visit_id': visit.id,
        'work_post_id': visit.work_post_id,
        'responsible_mechanic_id': visit.responsible_mechanic_id,
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
        elif action.action_type == RESCHEDULE_VISIT_ACTION:
            result = _execute_reschedule_visit_action(company, user, access, action)
        elif action.action_type == CANCEL_VISIT_ACTION:
            result = _execute_cancel_visit_action(company, user, access, action)
        elif action.action_type == UPDATE_VISIT_STATUS_ACTION:
            result = _execute_update_visit_status_action(company, user, access, action)
        elif action.action_type == ASSIGN_VISIT_ACTION:
            result = _execute_assign_visit_action(company, user, access, action)
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
    return {'action_id': action.id, 'status': action.status, 'result': result}
