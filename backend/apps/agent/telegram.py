import hmac
import os
from datetime import datetime

import requests
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import AgentConversation, AgentInboundMessage, AgentUserChannel
from .services import link_channel_by_code, write_audit
from .telegram_visit_actions import (
    handle_visit_callback,
    handle_visit_lifecycle_text,
    pop_inline_markup,
    schedule_markup,
    visit_results_markup,
)
from .telegram_visit_flow import handle_visit_creation_flow
from .tools.visits import daily_schedule, find_visits
from .visit_slots import find_available_slots, parse_slot_date


TELEGRAM_API_BASE = 'https://api.telegram.org'
TELEGRAM_TIMEOUT_SECONDS = 10
TELEGRAM_ALLOWED_UPDATES = ['message', 'callback_query']

BUTTON_SCHEDULE = '🗓 Розклад'
BUTTON_SEARCH = '🔎 Знайти запис'
BUTTON_NEW_VISIT = '➕ Новий запис'
BUTTON_FREE_SLOTS = '🟢 Вільні вікна'
BUTTON_HELP = 'ℹ️ Допомога'
BUTTON_CANCEL = '✖️ Скасувати'
SEARCH_FLOW = 'find_visit'

MAIN_REPLY_MARKUP = {
    'keyboard': [
        [BUTTON_SCHEDULE, BUTTON_SEARCH],
        [BUTTON_NEW_VISIT, BUTTON_FREE_SLOTS],
        [BUTTON_HELP],
        [BUTTON_CANCEL],
    ],
    'resize_keyboard': True,
    'is_persistent': True,
    'input_field_placeholder': 'Оберіть дію або введіть запит',
}

WORKFLOW_REPLY_MARKUP = {
    'keyboard': [[BUTTON_CANCEL]],
    'resize_keyboard': True,
    'is_persistent': True,
    'input_field_placeholder': 'Відповідайте на питання або скасуйте дію',
}


def _bot_token():
    return os.getenv('TELEGRAM_AGENT_BOT_TOKEN', '').strip()


def _webhook_secret():
    return os.getenv('TELEGRAM_AGENT_WEBHOOK_SECRET', '').strip()


def webhook_secret_is_valid(supplied_secret):
    expected_secret = _webhook_secret()
    if not expected_secret:
        return False
    return hmac.compare_digest(expected_secret, str(supplied_secret or ''))


def _telegram_request(method, payload):
    token = _bot_token()
    if not token:
        raise APIException('Telegram Agent не налаштований: немає TELEGRAM_AGENT_BOT_TOKEN.')
    response = requests.post(
        f'{TELEGRAM_API_BASE}/bot{token}/{method}',
        json=payload,
        timeout=TELEGRAM_TIMEOUT_SECONDS,
    )
    if not response.ok:
        raise APIException(f'Не вдалося виконати дію Telegram: {method}.')
    return response


def _telegram_result(method, payload=None):
    response = _telegram_request(method, payload or {})
    try:
        data = response.json()
    except ValueError:
        raise APIException(f'Telegram повернув некоректну відповідь для {method}.')
    if not data.get('ok'):
        raise APIException(str(data.get('description') or f'Не вдалося виконати дію Telegram: {method}.'))
    return data.get('result')


def get_telegram_webhook_info():
    result = _telegram_result('getWebhookInfo')
    return result if isinstance(result, dict) else {}


def sync_telegram_webhook(webhook_url):
    webhook_url = str(webhook_url or '').strip()
    if not webhook_url.startswith('https://'):
        raise ValidationError('Webhook Telegram має використовувати HTTPS.')
    secret = _webhook_secret()
    if not secret:
        raise APIException('Telegram Agent не налаштований: немає TELEGRAM_AGENT_WEBHOOK_SECRET.')

    _telegram_result('setWebhook', {
        'url': webhook_url,
        'secret_token': secret,
        'allowed_updates': TELEGRAM_ALLOWED_UPDATES,
        'drop_pending_updates': False,
    })
    return get_telegram_webhook_info()


def send_message(chat_id, text, reply_markup=None, inline_markup=None):
    markup = inline_markup if inline_markup is not None else (reply_markup or MAIN_REPLY_MARKUP)
    _telegram_request('sendMessage', {
        'chat_id': str(chat_id),
        'text': str(text)[:4096],
        'disable_web_page_preview': True,
        'reply_markup': markup,
    })


def answer_callback_query(callback_query_id, text=''):
    if not callback_query_id:
        return
    _telegram_request('answerCallbackQuery', {
        'callback_query_id': str(callback_query_id),
        'text': str(text)[:200],
        'show_alert': False,
    })


def _format_datetime(value):
    if not value:
        return 'час не вказаний'
    return timezone.localtime(value).strftime('%d.%m %H:%M')


def _format_visit(item):
    lines = [
        f"{item['plate']} — {item['client']}",
        f"Статус: {item['status']}",
        f"Запис: {_format_datetime(item['scheduled_datetime'])}",
    ]
    if item.get('work_post'):
        lines.append(f"Пост: {item['work_post']}")
    if item.get('responsible_mechanic'):
        lines.append(f"Майстер: {item['responsible_mechanic']}")
    if item.get('phone'):
        lines.append(f"Телефон: {item['phone']}")
    return '\n'.join(lines)


def _format_schedule(result):
    if not result['visits']:
        return f"На {result['date']} записів немає."

    lines = [f"Розклад на {result['date']} — {result['count']} записів:"]
    for item in result['visits']:
        time_value = _format_datetime(item['scheduled_datetime'])
        lines.append(f"• {time_value} — {item['plate']} / {item['client']} / {item['status']}")
    return '\n'.join(lines)


def _help_text():
    return (
        'Я VIN-matrix Agent.\n\n'
        'Користуйтеся кнопками внизу екрана:\n'
        '• «Розклад» — записи на сьогодні\n'
        '• «Знайти запис» — номер, VIN, клієнт або телефон\n'
        '• «Новий запис» — створення запису одразу після перевірки вільного часу\n'
        '• «Вільні вікна» — доступні слоти на сьогодні, завтра або дату\n\n'
        'У результатах пошуку або розкладі натисніть на запис, щоб відкрити картку та доступні дії.'
    )


def _parse_schedule_date(text):
    parts = text.split(maxsplit=1)
    if len(parts) == 1:
        return None
    try:
        return datetime.strptime(parts[1].strip(), '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError('Вкажи дату у форматі РРРР-ММ-ДД, наприклад: розклад 2026-06-30.')


def _clear_conversation_flow(conversation):
    conversation.context = {}
    conversation.save(update_fields=['context'])


def _reply_markup_for(conversation):
    context = conversation.context or {}
    return WORKFLOW_REPLY_MARKUP if context.get('flow') else MAIN_REPLY_MARKUP


def _search_visits(channel, query):
    query = str(query or '').strip()
    if not query:
        return 'Напишіть номер авто, VIN, ім’я клієнта або телефон.', 'find_visit', {}

    results = find_visits(channel.user, query=query, limit=5)
    if not results:
        return f'За запитом «{query}» нічого не знайдено.', 'find_visit', {'query': query, 'count': 0}

    body = '\n\n'.join(_format_visit(item) for item in results)
    return body, 'find_visit', {
        'query': query,
        'count': len(results),
        '_telegram_inline_markup': visit_results_markup(results),
    }


def _handle_search_flow(channel, conversation, normalized, lowered):
    context = dict(conversation.context or {})
    if context.get('flow') != SEARCH_FLOW:
        return None

    if lowered in {'/cancel', 'cancel', 'скасувати', 'відміна', BUTTON_CANCEL.lower()}:
        _clear_conversation_flow(conversation)
        return 'Пошук скасовано.', 'find_visit_cancelled', {}

    reply, intent, result = _search_visits(channel, normalized)
    if result.get('query'):
        _clear_conversation_flow(conversation)
    return reply, intent, result


def _handle_text(channel, text, conversation=None):
    normalized = str(text or '').strip()
    lowered = normalized.lower()

    if conversation:
        lifecycle_response = handle_visit_lifecycle_text(channel, conversation, normalized)
        if lifecycle_response is not None:
            return lifecycle_response

        search_flow_response = _handle_search_flow(channel, conversation, normalized, lowered)
        if search_flow_response is not None:
            return search_flow_response

        visit_text = '/cancel' if lowered == BUTTON_CANCEL.lower() else normalized
        visit_flow_response = handle_visit_creation_flow(channel, conversation, visit_text)
        if visit_flow_response is not None:
            return visit_flow_response

    if normalized == BUTTON_SEARCH:
        if not conversation:
            return 'Скористайтеся цим меню після підключення Telegram.', 'find_visit', {}
        conversation.context = {'flow': SEARCH_FLOW, 'step': 'query'}
        conversation.save(update_fields=['context'])
        return 'Що знайти? Надішліть номер авто, VIN, ім’я клієнта або телефон.', 'find_visit_started', {}

    if normalized == BUTTON_SCHEDULE:
        normalized = 'розклад'
        lowered = normalized
    elif normalized == BUTTON_NEW_VISIT:
        normalized = 'новий запис'
        lowered = normalized
        if conversation:
            visit_flow_response = handle_visit_creation_flow(channel, conversation, normalized)
            if visit_flow_response is not None:
                return visit_flow_response
    elif normalized == BUTTON_FREE_SLOTS:
        normalized = 'вільні вікна'
        lowered = normalized
    elif normalized == BUTTON_HELP:
        return _help_text(), 'help', {}
    elif normalized == BUTTON_CANCEL:
        return 'Немає активної дії для скасування. Оберіть потрібний пункт у меню.', 'cancel_no_active_flow', {}

    if lowered.startswith('вільні вікна') or lowered.startswith('свободные окна') or lowered.startswith('слоти'):
        from .telegram_visit_actions import free_slots_markup, format_free_slots
        target_date = parse_slot_date(normalized)
        result = find_available_slots(channel.user, target_date=target_date, limit=10)
        return format_free_slots(result), 'free_slots', {'date': result['date'], 'count': len(result['slots']), '_telegram_inline_markup': free_slots_markup(result)}

    if lowered in {'розклад', 'сьогодні', 'сегодня', 'schedule'} or lowered.startswith('розклад '):
        target_date = _parse_schedule_date(normalized)
        result = daily_schedule(channel.user, target_date=target_date)
        return _format_schedule(result), 'daily_schedule', {
            'date': result['date'],
            'count': result['count'],
            '_telegram_inline_markup': schedule_markup(result),
        }

    search_prefixes = ('знайди ', 'поиск ', 'пошук ', 'find ')
    for prefix in search_prefixes:
        if lowered.startswith(prefix):
            return _search_visits(channel, normalized[len(prefix):])

    return _help_text(), 'help', {}


def _find_or_link_channel(message):
    sender = message.get('from') or {}
    chat = message.get('chat') or {}
    external_user_id = str(sender.get('id') or '').strip()
    chat_id = str(chat.get('id') or '').strip()
    display_name = ' '.join(
        part for part in [sender.get('first_name', ''), sender.get('last_name', '')] if part
    ).strip() or str(sender.get('username') or '').strip()

    if not external_user_id or not chat_id:
        raise ValidationError('Telegram не передав дані користувача або чату.')

    channel = AgentUserChannel.objects.filter(
        channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
        external_user_id=external_user_id,
        is_active=True,
    ).select_related('company', 'user').first()
    if channel:
        if channel.chat_id != chat_id or channel.display_name != display_name:
            channel.chat_id = chat_id
            channel.display_name = display_name
            channel.last_seen_at = timezone.now()
            channel.save(update_fields=['chat_id', 'display_name', 'last_seen_at'])
        return channel, None

    text = str(message.get('text') or '').strip()
    if not text.lower().startswith('/start'):
        return None, 'Відкрий VIN-matrix у браузері, створи код підключення Telegram і надішли його так: /start КОД'

    parts = text.split(maxsplit=1)
    if len(parts) != 2:
        return None, 'Потрібен код підключення. Формат: /start КОД'

    channel = link_channel_by_code(
        AgentUserChannel.CHANNEL_TELEGRAM,
        parts[1].strip(),
        external_user_id,
        chat_id,
        display_name,
    )
    return channel, 'Готово, Telegram підключено до VIN-matrix.\n\n' + _help_text()


def _find_callback_channel(callback):
    sender = callback.get('from') or {}
    message = callback.get('message') or {}
    chat = message.get('chat') or {}
    external_user_id = str(sender.get('id') or '').strip()
    chat_id = str(chat.get('id') or '').strip()
    if not external_user_id or not chat_id:
        raise ValidationError('Telegram не передав дані користувача або чату.')

    channel = AgentUserChannel.objects.filter(
        channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
        external_user_id=external_user_id,
        chat_id=chat_id,
        is_active=True,
    ).select_related('company', 'user').first()
    if not channel:
        raise PermissionDenied('Telegram не підключений до VIN-matrix для цього користувача.')
    channel.last_seen_at = timezone.now()
    channel.save(update_fields=['last_seen_at'])
    return channel


def _process_callback(callback):
    callback_id = str(callback.get('id') or '').strip()
    channel = _find_callback_channel(callback)
    conversation, _ = AgentConversation.objects.get_or_create(
        channel=channel,
        defaults={'company': channel.company, 'user': channel.user},
    )
    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at'])

    try:
        reply, intent, result = handle_visit_callback(
            channel,
            conversation,
            callback.get('data'),
        )
    except (PermissionDenied, ValidationError) as exc:
        reply = str(exc.detail if hasattr(exc, 'detail') else exc)
        intent = 'callback_access_or_validation_error'
        result = {}
    except Exception:
        reply = 'Сталася технічна помилка. Відкрийте запис ще раз або зверніться до адміністратора.'
        intent = 'callback_internal_error'
        result = {}

    inline_markup, audit_result = pop_inline_markup(result)
    write_audit(
        company=channel.company,
        user=channel.user,
        conversation=conversation,
        request_text=str(callback.get('data') or ''),
        recognized_intent=intent,
        tool_name='telegram_callback_router',
        tool_result=audit_result,
        success=intent != 'callback_internal_error',
    )
    return {
        'chat_id': channel.chat_id,
        'text': reply,
        'reply_markup': _reply_markup_for(conversation),
        'inline_markup': inline_markup,
        'callback_query_id': callback_id,
    }


def process_update(payload):
    """Processes a Telegram update and returns a response payload when needed."""
    if not isinstance(payload, dict):
        return None

    callback = payload.get('callback_query')
    if isinstance(callback, dict):
        return _process_callback(callback)

    message = payload.get('message')
    if not isinstance(message, dict):
        return None

    channel, first_reply = _find_or_link_channel(message)
    chat_id = (message.get('chat') or {}).get('id')
    if first_reply:
        return {'chat_id': chat_id, 'text': first_reply, 'reply_markup': MAIN_REPLY_MARKUP}
    if not channel:
        return None

    external_message_id = str(message.get('message_id') or '').strip()
    if not external_message_id:
        return None

    try:
        with transaction.atomic():
            inbound, created = AgentInboundMessage.objects.get_or_create(
                channel=channel,
                external_message_id=external_message_id,
                defaults={
                    'message_type': 'text' if message.get('text') else 'unsupported',
                    'text': str(message.get('text') or ''),
                    'payload': {'update_id': payload.get('update_id')},
                },
            )
    except IntegrityError:
        return None

    if not created:
        return None

    conversation, _ = AgentConversation.objects.get_or_create(
        channel=channel,
        defaults={'company': channel.company, 'user': channel.user},
    )
    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at'])

    if not message.get('text'):
        reply = 'Поки що я обробляю текст. Голосові та фото будуть підключені наступними модулями.'
        intent = 'unsupported_message'
        result = {}
    else:
        try:
            reply, intent, result = _handle_text(channel, message['text'], conversation=conversation)
        except (PermissionDenied, ValidationError) as exc:
            reply = str(exc.detail if hasattr(exc, 'detail') else exc)
            intent = 'access_or_validation_error'
            result = {}
        except Exception:
            reply = 'Сталася технічна помилка. Спробуй ще раз або звернись до адміністратора.'
            intent = 'internal_error'
            result = {}

    inline_markup, audit_result = pop_inline_markup(result)
    inbound.processed_at = timezone.now()
    inbound.save(update_fields=['processed_at'])
    write_audit(
        company=channel.company,
        user=channel.user,
        conversation=conversation,
        request_text=str(message.get('text') or ''),
        recognized_intent=intent,
        tool_name='telegram_text_router',
        tool_result=audit_result,
        success=intent != 'internal_error',
    )
    return {
        'chat_id': channel.chat_id,
        'text': reply,
        'reply_markup': _reply_markup_for(conversation),
        'inline_markup': inline_markup,
    }
