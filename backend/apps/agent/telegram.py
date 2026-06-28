import hmac
import os
from datetime import datetime

import requests
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import AgentConversation, AgentInboundMessage, AgentUserChannel
from .services import link_channel_by_code, write_audit
from .tools.visits import daily_schedule, find_visits


TELEGRAM_API_BASE = 'https://api.telegram.org'
TELEGRAM_TIMEOUT_SECONDS = 10


def _bot_token():
    return os.getenv('TELEGRAM_AGENT_BOT_TOKEN', '').strip()


def webhook_secret_is_valid(supplied_secret):
    expected_secret = os.getenv('TELEGRAM_AGENT_WEBHOOK_SECRET', '')
    if not expected_secret:
        return False
    return hmac.compare_digest(expected_secret, str(supplied_secret or ''))


def send_message(chat_id, text):
    token = _bot_token()
    if not token:
        raise APIException('Telegram Agent не налаштований: немає TELEGRAM_AGENT_BOT_TOKEN.')

    response = requests.post(
        f'{TELEGRAM_API_BASE}/bot{token}/sendMessage',
        json={
            'chat_id': str(chat_id),
            'text': str(text)[:4096],
            'disable_web_page_preview': True,
        },
        timeout=TELEGRAM_TIMEOUT_SECONDS,
    )
    if not response.ok:
        raise APIException('Не вдалося надіслати відповідь у Telegram.')


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
        'Напиши:\n'
        '• «розклад» — записи на сьогодні\n'
        '• «розклад 2026-06-30» — записи на дату\n'
        '• «знайди Ауді Андрія» — пошук за номером, VIN, клієнтом або телефоном\n\n'
        'Пошук запчастин, голосові, фото та підтверджувані дії будуть підключені наступними модулями.'
    )


def _parse_schedule_date(text):
    parts = text.split(maxsplit=1)
    if len(parts) == 1:
        return None
    try:
        return datetime.strptime(parts[1].strip(), '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError('Вкажи дату у форматі РРРР-ММ-ДД, наприклад: розклад 2026-06-30.')


def _handle_text(channel, text):
    normalized = str(text or '').strip()
    lowered = normalized.lower()

    if lowered in {'розклад', 'сьогодні', 'сегодня', 'schedule'} or lowered.startswith('розклад '):
        target_date = _parse_schedule_date(normalized)
        result = daily_schedule(channel.user, target_date=target_date)
        return _format_schedule(result), 'daily_schedule', {'date': result['date']}

    search_prefixes = ('знайди ', 'поиск ', 'пошук ', 'find ')
    for prefix in search_prefixes:
        if lowered.startswith(prefix):
            query = normalized[len(prefix):].strip()
            if not query:
                return 'Напиши, що саме знайти: номер, VIN, ім’я клієнта або телефон.', 'find_visit', {}
            results = find_visits(channel.user, query=query, limit=5)
            if not results:
                return f'За запитом «{query}» нічого не знайдено.', 'find_visit', {'query': query, 'count': 0}
            body = '\n\n'.join(_format_visit(item) for item in results)
            return body, 'find_visit', {'query': query, 'count': len(results)}

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


def process_update(payload):
    """Processes a Telegram update and returns a response text when needed."""

    message = payload.get('message') if isinstance(payload, dict) else None
    if not isinstance(message, dict):
        return None

    channel, first_reply = _find_or_link_channel(message)
    chat_id = (message.get('chat') or {}).get('id')
    if first_reply:
        return {'chat_id': chat_id, 'text': first_reply}
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
            reply, intent, result = _handle_text(channel, message['text'])
        except (PermissionDenied, ValidationError) as exc:
            reply = str(exc.detail if hasattr(exc, 'detail') else exc)
            intent = 'access_or_validation_error'
            result = {}
        except Exception:
            reply = 'Сталася технічна помилка. Спробуй ще раз або звернись до адміністратора.'
            intent = 'internal_error'
            result = {}

    inbound.processed_at = timezone.now()
    inbound.save(update_fields=['processed_at'])
    write_audit(
        company=channel.company,
        user=channel.user,
        conversation=conversation,
        request_text=str(message.get('text') or ''),
        recognized_intent=intent,
        tool_name='telegram_text_router',
        tool_result=result,
        success=intent != 'internal_error',
    )
    return {'chat_id': channel.chat_id, 'text': reply}
