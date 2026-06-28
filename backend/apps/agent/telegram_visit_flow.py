from datetime import datetime

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .actions import create_visit_draft
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
    """Returns a reply tuple for the visit wizard or None when no wizard applies."""
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
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'scheduled_datetime', 'visit': draft})
        return 'Коли записати? Формат: 2026-06-30 10:30 або 30.06.2026 10:30.', 'visit_create_phone_received', {}

    if step == 'scheduled_datetime':
        try:
            scheduled = _parse_scheduled_datetime(normalized)
        except ValidationError as exc:
            return str(exc.detail), 'visit_create_validation_error', {}
        draft['scheduled_datetime'] = scheduled.isoformat()
        _save_context(conversation, {'flow': FLOW_NAME, 'step': 'comment', 'visit': draft})
        return 'Додайте короткий коментар або надішліть «-».', 'visit_create_datetime_received', {}

    if step == 'comment':
        comment = '' if _is_skip(normalized) else normalized[:2000]
        action = create_visit_draft(
            user=channel.user,
            client=draft.get('client'),
            plate=draft.get('plate'),
            phone=draft.get('phone'),
            scheduled_datetime=draft.get('scheduled_datetime'),
            comment=comment,
            conversation=conversation,
        )
        _clear_context(conversation)
        scheduled = timezone.localtime(_parse_scheduled_datetime(draft.get('scheduled_datetime')))
        return (
            'Чернетку запису створено.\n\n'
            f"{draft.get('client')} · {draft.get('plate')}\n"
            f"{scheduled.strftime('%d.%m.%Y %H:%M')}\n\n"
            'Відкрий VIN-matrix → AI Agent → «Підтвердження дій» і підтвердь створення.',
            'visit_draft_created',
            {'pending_action_id': action.id},
        )

    _clear_context(conversation)
    return 'Створення запису скасовано через неочікуваний крок. Почніть ще раз: «новий запис».', 'visit_create_reset', {}
