from datetime import datetime

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .visit_slots import create_visit_now, find_available_slots, parse_slot_date
from .services import require_agent_member


FLOW_NAME = 'create_visit'
START_COMMANDS = {
    'новий запис',
    'створити запис',
    'новий візит',
    'створити візит',
    '/new',
}
CANCEL_COMMANDS = {'/cancel', 'cancel', 'скасувати', 'відміна'}
SKIP_VALUES = {'-', 'немає', 'нема', 'не вказано', 'без коментаря'}


def _save_context(conversation, context):
    conversation.context = context
    conversation.save(update_fields=['context'])


def _clear_context(conversation):
    _save_context(conversation, {})


def _is_skip(value):
    return str(value or '').strip().lower() in SKIP_VALUES


def _parse_scheduled_datetime(value):
    raw = str(value or '').strip()
    for value_format in ('%Y-%m-%d %H:%M', '%d.%m.%Y %H:%M'):
        try:
            scheduled = datetime.strptime(raw, value_format)
            scheduled = timezone.make_aware(scheduled, timezone.get_current_timezone())
            if scheduled <= timezone.now():
                raise ValidationError('Дата й час мають бути в майбутньому.')
            return scheduled
        except ValueError:
            continue
    raise ValidationError('Вкажіть дату й час у форматі 2026-06-30 10:30 або 30.06.2026 10:30.')


def _start_visit_wizard(channel, conversation):
    _, _, access = require_agent_member(channel.user)
    if not access.can_create_visits:
        raise PermissionDenied('У вас немає права створювати записи через Agent.')

    _save_context(conversation, {
        'flow': FLOW_NAME,
        'step': 'client',
        'visit': {},
    })
    return (
        'Створюємо новий запис.\n\nЯк звати клієнта?\n'
        'У будь-який момент надішли /cancel, щоб скасувати.',
        'visit_create_started',
        {},
    )


def handle_visit_creation_flow(channel, conversation, text):
    normalized = str(text or '').strip()
    lowered = normalized.lower()
    context = dict(conversation.context or {})

    if lowered in CANCEL_COMMANDS and context.get('flow') == FLOW_NAME:
        _clear_context(conversation)
        return 'Створення запису скасовано.', 'visit_create_cancelled', {}

    if context.get('flow') != FLOW_NAME:
        if lowered not in START_COMMANDS:
            return None
        return _start_visit_wizard(channel, conversation)

    draft = dict(context.get('visit') or {})
    step = context.get('step') or 'client'

    if step == 'client':
        client = normalized[:100]
        if not client or _is_skip(client):
            return 'Вкажіть ім’я клієнта.', 'visit_create_validation_error', {}
        draft['client'] = client
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'plate', 'visit': draft})
        return 'Номер автомобіля? Наприклад: AA1234AA. Якщо номера немає — напишіть «-».', 'visit_create_client_received', {}

    if step == 'plate':
        plate = 'НЕ ВКАЗАНО' if _is_skip(normalized) else normalized.upper()[:20]
        if not plate:
            return 'Вкажіть номер автомобіля або надішліть «-».', 'visit_create_validation_error', {}
        draft['plate'] = plate
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'phone', 'visit': draft})
        return 'Телефон клієнта? Можна надіслати «-», якщо його немає.', 'visit_create_plate_received', {}

    if step == 'phone':
        draft['phone'] = '' if _is_skip(normalized) else normalized[:20]
        if draft.get('scheduled_datetime'):
            _save_context(conversation, {'flow': FLOW_NAME, 'step': 'comment', 'visit': draft})
            return 'Додайте короткий коментар або надішліть «-».', 'visit_create_phone_received', {}
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'date', 'visit': draft})
        return 'На яку дату шукаємо вільні вікна? Наприклад: завтра або 2026-07-10.', 'visit_create_phone_received', {}

    if step == 'date':
        try:
            target_date = parse_slot_date('вільні вікна ' + normalized)
        except ValidationError as exc:
            return str(exc.detail), 'visit_create_validation_error', {}
        result = find_available_slots(channel.user, target_date=target_date)
        if not result['slots']:
            return f"На {result['date']} немає вільних вікон. Спробуйте іншу дату.", 'visit_slots_empty', {}
        draft['slots_date'] = result['date']
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'slot', 'visit': draft})
        from .telegram_visit_actions import free_slots_markup, format_free_slots
        return format_free_slots(result), 'visit_slots_shown', {'_telegram_inline_markup': free_slots_markup(result, prefix='cvslot')}

    if step == 'scheduled_datetime':
        try:
            scheduled = _parse_scheduled_datetime(normalized)
        except ValidationError as exc:
            return str(exc.detail), 'visit_create_validation_error', {}
        draft['scheduled_datetime'] = scheduled.isoformat()
        draft['scheduled_display'] = timezone.localtime(scheduled).strftime('%d.%m.%Y %H:%M')
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'comment', 'visit': draft})
        return 'Додайте короткий коментар або надішліть «-».', 'visit_create_datetime_received', {}

    if step == 'comment':
        comment = '' if _is_skip(normalized) else normalized[:2000]
        try:
            visit = create_visit_now(user=channel.user, client=draft.get('client'), plate=draft.get('plate'), phone=draft.get('phone'), scheduled_datetime=draft.get('scheduled_datetime'), comment=comment, work_post_id=draft.get('work_post_id'), mechanic_id=draft.get('mechanic_id'), conversation=conversation)
        except ValidationError:
            result = find_available_slots(channel.user, target_date=datetime.fromisoformat(draft.get('scheduled_datetime')).date())
            from .telegram_visit_actions import free_slots_markup, format_free_slots
            return 'Цей час уже зайняли. Ось актуальні вільні вікна\n\n' + format_free_slots(result), 'visit_slot_conflict', {'_telegram_inline_markup': free_slots_markup(result, prefix='cvslot')}
        _clear_context(conversation)
        post = visit.work_post.name if visit.work_post else '—'
        master = (visit.responsible_mechanic.get_full_name() or visit.responsible_mechanic.username) if visit.responsible_mechanic else '—'
        return (f"✅ Запис створено\nКлієнт: {visit.client}\nАвто: {visit.plate}\nЧас: {timezone.localtime(visit.scheduled_datetime).strftime('%d.%m.%Y %H:%M')}\nПост: {post}\nМайстер: {master}", 'visit_created', {'visit_id': visit.id})

    _clear_context(conversation)
    return 'Створення запису скасовано через неочікуваний крок. Почніть ще раз: «новий запис».', 'visit_create_reset', {}