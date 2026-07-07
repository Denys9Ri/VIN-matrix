from datetime import date, datetime, timedelta

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.models import Employee, WorkPost

from .actions import (
    STATUS_LABELS,
    STATUS_TRANSITIONS,
    create_assign_visit_draft,
    create_cancel_visit_draft,
    create_reschedule_visit_draft,
    create_update_visit_status_draft,
)
from .services import require_agent_member
from .tools.visits import daily_schedule, get_visit
from .visit_slots import find_available_slots, parse_slot_date


INLINE_MARKUP_KEY = '_telegram_inline_markup'
FLOW_RESCHEDULE = 'reschedule_visit'
FLOW_CANCEL = 'cancel_visit'
CANCEL_VALUES = {'/cancel', 'cancel', 'скасувати', 'відміна', '✖️ скасувати'}
SKIP_VALUES = {'-', 'немає', 'нема', 'без причини', 'не вказано'}


def _button(text, callback_data):
    return {'text': str(text)[:64], 'callback_data': str(callback_data)[:64]}


def _markup(rows):
    return {'inline_keyboard': rows}


def _with_inline(result, markup):
    payload = dict(result or {})
    payload[INLINE_MARKUP_KEY] = markup
    return payload


def pop_inline_markup(result):
    payload = dict(result or {})
    return payload.pop(INLINE_MARKUP_KEY, None), payload


def _format_datetime(value):
    if not value:
        return 'час не вказаний'
    return timezone.localtime(value).strftime('%d.%m.%Y %H:%M')


def _format_visit_card(visit):
    lines = [
        f"🚗 {visit['plate']} · {visit['client']}",
        f"Статус: {STATUS_LABELS.get(visit['status'], visit['status'])}",
        f"Час: {_format_datetime(visit.get('scheduled_datetime'))}",
    ]
    if visit.get('work_post'):
        lines.append(f"Пост: {visit['work_post']}")
    if visit.get('responsible_mechanic'):
        lines.append(f"Майстер: {visit['responsible_mechanic']}")
    if visit.get('phone'):
        lines.append(f"Телефон: {visit['phone']}")
    if visit.get('comment'):
        lines.append(f"Коментар: {visit['comment'][:500]}")
    return '\n'.join(lines)


def _visit_card_markup(visit, access):
    rows = []
    visit_id = visit['id']
    if access.can_update_visits:
        allowed = STATUS_TRANSITIONS.get(visit['status'], set())
        if visit['status'] in {'SELECTION', 'PENDING'} and 'IN_PROGRESS' in allowed:
            rows.append([_button('▶️ В роботу', f'st:{visit_id}:IN_PROGRESS')])
        elif visit['status'] == 'IN_PROGRESS' and 'DONE' in allowed:
            rows.append([_button('✅ Готово', f'st:{visit_id}:DONE')])
        elif visit['status'] == 'DONE' and 'COMPLETED' in allowed:
            rows.append([_button('📦 Видано', f'st:{visit_id}:COMPLETED')])
        elif visit['status'] == 'DONE' and 'IN_PROGRESS' in allowed:
            rows.append([_button('↩️ Повернути в роботу', f'st:{visit_id}:IN_PROGRESS')])

        rows.append([
            _button('📅 Перенести', f'rs:{visit_id}'),
            _button('👤 Призначити', f'as:{visit_id}'),
        ])
        if visit['status'] not in {'CANCELLED', 'COMPLETED'}:
            rows.append([_button('❌ Скасувати', f'cn:{visit_id}')])
    rows.append([_button('🔄 Оновити картку', f'v:{visit_id}')])
    return _markup(rows)


def visit_results_markup(visits):
    rows = [
        [_button(f"Відкрити · {visit['plate']} · {visit['client'][:20]}", f"v:{visit['id']}")]
        for visit in visits
    ]
    return _markup(rows) if rows else None


def schedule_markup(result):
    rows = [
        [_button(f"{_format_datetime(visit.get('scheduled_datetime'))} · {visit['plate']}", f"v:{visit['id']}")]
        for visit in result.get('visits', [])[:12]
    ]
    target = date.fromisoformat(result['date'])
    rows.append([
        _button('◀️', f"s:{(target - timedelta(days=1)).isoformat()}"),
        _button('Сьогодні', f"s:{timezone.localdate().isoformat()}"),
        _button('▶️', f"s:{(target + timedelta(days=1)).isoformat()}"),
    ])
    return _markup(rows)



FREE_SLOTS_PAGE_SIZE = 8


def _free_slots_page(result, page=1):
    slots = result.get('slots', [])
    page = max(1, int(page or 1))
    start = (page - 1) * FREE_SLOTS_PAGE_SIZE
    end = start + FREE_SLOTS_PAGE_SIZE
    return page, slots[start:end], start > 0, end < len(slots)


def _free_slots_date_label(result):
    try:
        return date.fromisoformat(result.get('date')).strftime('%d.%m')
    except (TypeError, ValueError):
        return result.get('date')


def format_free_slots(result, page=1):
    slots = result.get('slots', [])
    if not slots:
        return f"На {result.get('date')} немає доступних вікон."
    page, page_slots, _, _ = _free_slots_page(result, page)
    lines = [
        f"Вільні вікна на {_free_slots_date_label(result)} · сторінка {page}",
        f"Тривалість {result.get('duration_minutes')} хв · крок {result.get('slot_step_minutes', 30)} хв:",
    ]
    for slot in page_slots:
        parts = [timezone.localtime(slot['start']).strftime('%H:%M')]
        if slot.get('work_post'):
            parts.append(f"пост: {slot['work_post']}")
        if slot.get('mechanic'):
            parts.append(f"майстер: {slot['mechanic']}")
        lines.append('• ' + ' · '.join(parts))
    return '\n'.join(lines)


def free_slots_markup(result, prefix='fs', page=1):
    page, slots, has_prev, has_next = _free_slots_page(result, page)
    rows = []
    for slot in slots:
        label = timezone.localtime(slot['start']).strftime('%H:%M')
        if slot.get('work_post'):
            label += f" · {slot['work_post'][:16]}"
        if slot.get('mechanic'):
            label += f" · {slot['mechanic'][:16]}"
        data = f"{prefix}:{int(slot['start'].timestamp())}:{slot.get('work_post_id') or 0}:{slot.get('mechanic_id') or 0}"
        rows.append([_button(label, data)])
    nav = []
    if has_prev:
        nav.append(_button('← Раніше', f"fsp:{prefix}:{result.get('date')}:{page - 1}"))
    if has_next:
        nav.append(_button('Пізніше →', f"fsp:{prefix}:{result.get('date')}:{page + 1}"))
    if nav:
        rows.append(nav)
    return _markup(rows) if rows else None

def free_slots_date_markup(prefix='fd'):
    return _markup([
        [_button('Сьогодні', f'{prefix}:0'), _button('Завтра', f'{prefix}:1')],
        [_button('Післязавтра', f'{prefix}:2')],
        [_button('📅 Інша дата', f'{prefix}:x')],
    ])


def _parse_day_offset(value):
    if value in {'0', '1', '2'}:
        return timezone.localdate() + timedelta(days=int(value))
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError('Ця кнопка вже неактуальна. Натисніть «🟢 Вільні вікна» ще раз.')


def start_free_slots_date_choice(conversation):
    conversation.context = {'flow': 'free_slots', 'step': 'date_choice'}
    conversation.save(update_fields=['context'])
    return 'Оберіть дату для перегляду вільних вікон:', 'free_slots_date_choice', _with_inline({}, free_slots_date_markup())


def handle_free_slots_text(channel, conversation, text):
    context = dict(conversation.context or {})
    if context.get('flow') != 'free_slots':
        return None
    normalized = str(text or '').strip()
    if normalized.lower() in CANCEL_VALUES:
        _clear_flow(conversation)
        return 'Перегляд вільних вікон скасовано.', 'free_slots_cancelled', {}
    if context.get('step') != 'custom_date':
        return None
    try:
        target_date = date.fromisoformat(normalized)
    except ValueError:
        return 'Введіть дату у форматі 2026-07-10 або натисніть «Скасувати».', 'free_slots_date_validation_error', {}
    result = find_available_slots(channel.user, target_date=target_date)
    conversation.context = {'flow': 'free_slots', 'step': 'slots', 'date': result['date'], 'page': 1}
    conversation.save(update_fields=['context'])
    return format_free_slots(result, page=1), 'free_slots_shown', _with_inline({'date': result['date'], 'count': len(result['slots']), 'page': 1}, free_slots_markup(result, prefix='fsi', page=1))

def _format_schedule(result):
    if not result['visits']:
        return f"На {result['date']} записів немає."
    lines = [f"Розклад на {result['date']} — {result['count']} записів:"]
    for visit in result['visits']:
        lines.append(
            f"• {_format_datetime(visit.get('scheduled_datetime'))} — "
            f"{visit['plate']} / {visit['client']} / {STATUS_LABELS.get(visit['status'], visit['status'])}"
        )
    return '\n'.join(lines)


def _save_flow(conversation, flow, visit_id):
    conversation.context = {'flow': flow, 'visit_id': int(visit_id)}
    conversation.save(update_fields=['context'])


def _clear_flow(conversation):
    conversation.context = {}
    conversation.save(update_fields=['context'])


def _parse_datetime(value):
    raw = str(value or '').strip()
    for date_format in ('%Y-%m-%d %H:%M', '%d.%m.%Y %H:%M'):
        try:
            scheduled = datetime.strptime(raw, date_format)
            scheduled = timezone.make_aware(scheduled, timezone.get_current_timezone())
            if scheduled <= timezone.now():
                raise ValidationError('Дата й час мають бути в майбутньому.')
            return scheduled
        except ValueError:
            continue
    raise ValidationError('Вкажіть дату й час у форматі 2026-06-30 10:30 або 30.06.2026 10:30.')


def handle_visit_lifecycle_text(channel, conversation, text):
    context = dict(conversation.context or {})
    flow = context.get('flow')
    if flow not in {FLOW_RESCHEDULE, FLOW_CANCEL}:
        return None

    normalized = str(text or '').strip()
    if normalized.lower() in CANCEL_VALUES:
        _clear_flow(conversation)
        return 'Дію скасовано. Оберіть наступну дію в меню.', 'visit_lifecycle_cancelled', {}

    visit_id = context.get('visit_id')
    if not visit_id:
        _clear_flow(conversation)
        return 'Не вдалося визначити запис. Відкрийте його ще раз.', 'visit_lifecycle_reset', {}

    if flow == FLOW_RESCHEDULE:
        try:
            scheduled = _parse_datetime(normalized)
        except ValidationError as exc:
            return str(exc.detail), 'visit_reschedule_validation_error', {}
        action = create_reschedule_visit_draft(
            channel.user,
            visit_id=visit_id,
            scheduled_datetime=scheduled,
            conversation=conversation,
        )
        _clear_flow(conversation)
        return (
            f"Чернетку перенесення створено на {_format_datetime(scheduled)}. "
            'Підтвердіть її в VIN-matrix → AI Agent → «Підтвердження дій».',
            'visit_reschedule_draft_created',
            {'pending_action_id': action.id, 'visit_id': int(visit_id)},
        )

    reason = '' if normalized.lower() in SKIP_VALUES else normalized[:1000]
    action = create_cancel_visit_draft(
        channel.user,
        visit_id=visit_id,
        reason=reason,
        conversation=conversation,
    )
    _clear_flow(conversation)
    return (
        'Чернетку скасування створено. Підтвердіть її в VIN-matrix → AI Agent → «Підтвердження дій».',
        'visit_cancel_draft_created',
        {'pending_action_id': action.id, 'visit_id': int(visit_id)},
    )


def _assignment_markup(channel, visit_id):
    company, _, access = require_agent_member(channel.user)
    if not access.can_update_visits:
        raise PermissionDenied('У вас немає права призначати пост або майстра через Agent.')

    rows = []
    posts = WorkPost.objects.filter(company=company, is_active=True).order_by('sort_order', 'number', 'id')[:8]
    for post in posts:
        rows.append([_button(f'Пост: {post.name}', f'ap:{visit_id}:{post.id}')])

    employees = Employee.objects.filter(company=company, role='mechanic').select_related('user').order_by('user__first_name', 'user__username')[:8]
    for employee in employees:
        name = employee.user.get_full_name() or employee.user.username
        rows.append([_button(f'Майстер: {name}', f'am:{visit_id}:{employee.user_id}')])

    rows.append([_button('← Назад до запису', f'v:{visit_id}')])
    return _markup(rows)


def _show_visit(channel, visit_id):
    visit = get_visit(channel.user, visit_id)
    _, _, access = require_agent_member(channel.user)
    return (
        _format_visit_card(visit),
        'visit_card_opened',
        _with_inline({'visit_id': visit['id']}, _visit_card_markup(visit, access)),
    )


def handle_visit_callback(channel, conversation, callback_data):
    data = str(callback_data or '').strip()
    parts = data.split(':')
    if not parts:
        raise ValidationError('Некоректна дія.')

    command = parts[0]
    if command not in {'rs', 'cn', 'cvslot', 'fd', 'fsi', 'fsp'} and (conversation.context or {}).get('flow'):
        _clear_flow(conversation)

    if command == 'v' and len(parts) == 2:
        return _show_visit(channel, parts[1])

    if command == 's' and len(parts) == 2:
        try:
            target_date = date.fromisoformat(parts[1])
        except ValueError:
            raise ValidationError('Некоректна дата розкладу.')
        result = daily_schedule(channel.user, target_date=target_date)
        return (
            _format_schedule(result),
            'daily_schedule_callback',
            _with_inline({'date': result['date'], 'count': result['count']}, schedule_markup(result)),
        )

    if command == 'fs':
        raise ValidationError('Ця кнопка вже неактуальна. Натисніть «🟢 Вільні вікна» ще раз.')

    if command == 'fd' and len(parts) == 2:
        if parts[1] == 'x':
            conversation.context = {'flow': 'free_slots', 'step': 'custom_date'}
            conversation.save(update_fields=['context'])
            return 'Введіть дату у форматі 2026-07-10.', 'free_slots_custom_date_requested', {}
        target_date = _parse_day_offset(parts[1])
        result = find_available_slots(channel.user, target_date=target_date)
        conversation.context = {'flow': 'free_slots', 'step': 'slots', 'date': result['date'], 'page': 1}
        conversation.save(update_fields=['context'])
        return format_free_slots(result, page=1), 'free_slots_callback', _with_inline({'date': result['date'], 'count': len(result['slots']), 'page': 1}, free_slots_markup(result, prefix='fsi', page=1))

    if command == 'fsp' and len(parts) == 4:
        prefix = parts[1]
        if prefix not in {'fsi', 'cvslot'}:
            raise ValidationError('Ця кнопка вже неактуальна. Натисніть «🟢 Вільні вікна» ще раз.')
        target_date = _parse_day_offset(parts[2])
        try:
            page = max(1, int(parts[3]))
        except (TypeError, ValueError):
            page = 1
        result = find_available_slots(channel.user, target_date=target_date)
        if prefix == 'fsi':
            conversation.context = {'flow': 'free_slots', 'step': 'slots', 'date': result['date'], 'page': page}
            conversation.save(update_fields=['context'])
        return format_free_slots(result, page=page), 'free_slots_page_callback', _with_inline({'date': result['date'], 'count': len(result['slots']), 'page': page}, free_slots_markup(result, prefix=prefix, page=page))

    if command == 'fsi' and len(parts) == 4:
        context = dict(conversation.context or {})
        scheduled = datetime.fromtimestamp(int(parts[1]), tz=timezone.get_current_timezone())
        if context.get('flow') and (context.get('flow') != 'free_slots' or context.get('step') != 'slots'):
            raise ValidationError('Ця кнопка вже неактуальна. Натисніть «🟢 Вільні вікна» ще раз.')
        if context.get('flow') == 'free_slots' and context.get('date') != timezone.localtime(scheduled).date().isoformat():
            raise ValidationError('Ця кнопка вже неактуальна. Натисніть «🟢 Вільні вікна» ще раз.')
        draft = {
            'scheduled_datetime': scheduled.isoformat(),
            'scheduled_display': timezone.localtime(scheduled).strftime('%d.%m.%Y %H:%M'),
            'work_post_id': None if parts[2] == '0' else int(parts[2]),
            'mechanic_id': None if parts[3] == '0' else int(parts[3]),
        }
        conversation.context = {'flow': 'create_visit', 'step': 'client', 'visit': draft}
        conversation.save(update_fields=['context'])
        return f"Запис на {timezone.localtime(scheduled).strftime('%d.%m.%Y о %H:%M')} обрано. Як звати клієнта?", 'free_slot_selected_create_visit_started', {}

    if command == 'cvslot' and len(parts) == 4:
        context = dict(conversation.context or {})
        if context.get('flow') != 'create_visit':
            raise ValidationError('Ця кнопка вже неактуальна. Почніть новий запис ще раз.')
        draft = dict(context.get('visit') or {})
        scheduled = datetime.fromtimestamp(int(parts[1]), tz=timezone.get_current_timezone())
        draft['scheduled_datetime'] = scheduled.isoformat()
        draft['scheduled_display'] = timezone.localtime(scheduled).strftime('%d.%m.%Y %H:%M')
        draft['work_post_id'] = None if parts[2] == '0' else int(parts[2])
        draft['mechanic_id'] = None if parts[3] == '0' else int(parts[3])
        conversation.context = {'flow': 'create_visit', 'step': 'comment', 'visit': draft}
        conversation.save(update_fields=['context'])
        return 'Слот обрано: ' + draft['scheduled_display'] + '. Додайте короткий коментар або надішліть «-».', 'visit_slot_selected', {}

    if command == 'rs' and len(parts) == 2:
        get_visit(channel.user, parts[1])
        _save_flow(conversation, FLOW_RESCHEDULE, parts[1])
        return (
            'Введіть нові дату й час у форматі 2026-06-30 10:30 або 30.06.2026 10:30.',
            'visit_reschedule_started',
            {'visit_id': int(parts[1])},
        )

    if command == 'cn' and len(parts) == 2:
        get_visit(channel.user, parts[1])
        _save_flow(conversation, FLOW_CANCEL, parts[1])
        return (
            'Вкажіть причину скасування або надішліть «-», щоб скасувати без причини.',
            'visit_cancel_started',
            {'visit_id': int(parts[1])},
        )

    if command == 'st' and len(parts) == 3:
        action = create_update_visit_status_draft(
            channel.user,
            visit_id=parts[1],
            new_status=parts[2],
            conversation=conversation,
        )
        return (
            f"Чернетку зміни статусу на «{STATUS_LABELS.get(parts[2], parts[2])}» створено. "
            'Підтвердіть її в VIN-matrix → AI Agent → «Підтвердження дій».',
            'visit_status_draft_created',
            {'pending_action_id': action.id, 'visit_id': int(parts[1])},
        )

    if command == 'as' and len(parts) == 2:
        get_visit(channel.user, parts[1])
        return (
            'Оберіть, що призначити для запису:',
            'visit_assign_started',
            _with_inline({'visit_id': int(parts[1])}, _assignment_markup(channel, parts[1])),
        )

    if command in {'ap', 'am'} and len(parts) == 3:
        if command == 'ap':
            action = create_assign_visit_draft(
                channel.user,
                visit_id=parts[1],
                work_post_id=parts[2],
                conversation=conversation,
            )
        else:
            action = create_assign_visit_draft(
                channel.user,
                visit_id=parts[1],
                mechanic_id=parts[2],
                conversation=conversation,
            )
        return (
            'Чернетку призначення створено. Підтвердіть її в VIN-matrix → AI Agent → «Підтвердження дій».',
            'visit_assign_draft_created',
            {'pending_action_id': action.id, 'visit_id': int(parts[1])},
        )

    raise ValidationError('Ця кнопка вже неактуальна. Відкрийте запис ще раз.')
