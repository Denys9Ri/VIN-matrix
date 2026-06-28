import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentConversation, AgentInboundMessage, AgentUserChannel
from .services import write_audit
from .telegram import (
    BUTTON_CANCEL,
    BUTTON_HELP,
    BUTTON_NEW_VISIT,
    BUTTON_SCHEDULE,
    BUTTON_SEARCH,
    MAIN_REPLY_MARKUP,
    WORKFLOW_REPLY_MARKUP,
    _find_callback_channel,
    answer_callback_query,
    process_update,
    send_message,
    webhook_secret_is_valid,
)
from .telegram_part_actions import (
    PART_FLOWS,
    handle_part_callback,
    handle_part_text,
    start_part_search,
)
from .telegram_visit_actions import pop_inline_markup


logger = logging.getLogger('vin_matrix.api')
BUTTON_PARTS = '🔩 Запчастини'

PARTS_MAIN_REPLY_MARKUP = {
    'keyboard': [
        [BUTTON_SCHEDULE, BUTTON_SEARCH],
        [BUTTON_NEW_VISIT, BUTTON_PARTS],
        [BUTTON_HELP, BUTTON_CANCEL],
    ],
    'resize_keyboard': True,
    'is_persistent': True,
    'input_field_placeholder': 'Оберіть дію або введіть запит',
}


def _callback_chat_id(callback):
    message = callback.get('message') if isinstance(callback, dict) else None
    chat = message.get('chat') if isinstance(message, dict) else None
    chat_id = chat.get('id') if isinstance(chat, dict) else None
    return str(chat_id) if chat_id not in (None, '') else ''


def _reply_markup_for(conversation):
    context = conversation.context or {}
    return WORKFLOW_REPLY_MARKUP if context.get('flow') else PARTS_MAIN_REPLY_MARKUP


def _enhance_main_reply_markup(reply_markup):
    return PARTS_MAIN_REPLY_MARKUP if reply_markup == MAIN_REPLY_MARKUP else reply_markup


def _find_linked_channel(message):
    sender = message.get('from') if isinstance(message, dict) else None
    chat = message.get('chat') if isinstance(message, dict) else None
    sender = sender if isinstance(sender, dict) else {}
    chat = chat if isinstance(chat, dict) else {}
    external_user_id = str(sender.get('id') or '').strip()
    chat_id = str(chat.get('id') or '').strip()
    if not external_user_id or not chat_id:
        return None

    channel = AgentUserChannel.objects.filter(
        channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
        external_user_id=external_user_id,
        is_active=True,
    ).select_related('company', 'user').first()
    if not channel:
        return None

    display_name = ' '.join(
        part for part in [sender.get('first_name', ''), sender.get('last_name', '')] if part
    ).strip() or str(sender.get('username') or '').strip()
    if channel.chat_id != chat_id or channel.display_name != display_name:
        channel.chat_id = chat_id
        channel.display_name = display_name
        channel.last_seen_at = timezone.now()
        channel.save(update_fields=['chat_id', 'display_name', 'last_seen_at'])
    return channel


def _process_part_callback(callback):
    data = str(callback.get('data') or '').strip()
    if not data.startswith('p:'):
        return None

    callback_id = str(callback.get('id') or '').strip()
    channel = _find_callback_channel(callback)
    conversation, _ = AgentConversation.objects.get_or_create(
        channel=channel,
        defaults={'company': channel.company, 'user': channel.user},
    )
    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at'])

    try:
        reply, intent, result = handle_part_callback(channel, conversation, data)
    except (PermissionDenied, ValidationError) as exc:
        reply = str(exc.detail if hasattr(exc, 'detail') else exc)
        intent = 'part_callback_access_or_validation_error'
        result = {}
    except Exception:
        logger.exception('telegram_part_callback_failed callback_data=%s', data[:64])
        reply = 'Сталася технічна помилка під час роботи із запчастиною. Почніть пошук ще раз.'
        intent = 'part_callback_internal_error'
        result = {}

    inline_markup, audit_result = pop_inline_markup(result)
    write_audit(
        company=channel.company,
        user=channel.user,
        conversation=conversation,
        request_text=data,
        recognized_intent=intent,
        tool_name='telegram_parts_callback_router',
        tool_result=audit_result,
        success=intent != 'part_callback_internal_error',
    )
    return {
        'chat_id': channel.chat_id,
        'text': reply,
        'reply_markup': _reply_markup_for(conversation),
        'inline_markup': inline_markup,
        'callback_query_id': callback_id,
    }


def _process_part_message(payload):
    message = payload.get('message') if isinstance(payload, dict) else None
    if not isinstance(message, dict) or not message.get('text'):
        return None

    normalized = str(message.get('text') or '').strip()
    if not normalized:
        return None

    channel = _find_linked_channel(message)
    if not channel:
        return None

    conversation, _ = AgentConversation.objects.get_or_create(
        channel=channel,
        defaults={'company': channel.company, 'user': channel.user},
    )
    is_part_flow = (conversation.context or {}).get('flow') in PART_FLOWS
    if normalized != BUTTON_PARTS and not is_part_flow:
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
                    'message_type': 'text',
                    'text': normalized,
                    'payload': {'update_id': payload.get('update_id')},
                },
            )
    except IntegrityError:
        return None
    if not created:
        return None

    conversation.last_message_at = timezone.now()
    conversation.save(update_fields=['last_message_at'])
    try:
        if normalized == BUTTON_PARTS:
            reply, intent, result = start_part_search(conversation)
        else:
            reply, intent, result = handle_part_text(channel, conversation, normalized)
    except (PermissionDenied, ValidationError) as exc:
        reply = str(exc.detail if hasattr(exc, 'detail') else exc)
        intent = 'part_access_or_validation_error'
        result = {}
    except Exception:
        logger.exception('telegram_part_message_failed message_id=%s', external_message_id)
        reply = 'Сталася технічна помилка під час пошуку запчастини. Спробуйте ще раз.'
        intent = 'part_internal_error'
        result = {}

    inline_markup, audit_result = pop_inline_markup(result)
    inbound.processed_at = timezone.now()
    inbound.save(update_fields=['processed_at'])
    write_audit(
        company=channel.company,
        user=channel.user,
        conversation=conversation,
        request_text=normalized,
        recognized_intent=intent,
        tool_name='telegram_parts_text_router',
        tool_result=audit_result,
        success=intent != 'part_internal_error',
    )
    return {
        'chat_id': channel.chat_id,
        'text': reply,
        'reply_markup': _reply_markup_for(conversation),
        'inline_markup': inline_markup,
    }


def process_agent_update(payload):
    if not isinstance(payload, dict):
        return None
    callback = payload.get('callback_query')
    if isinstance(callback, dict):
        result = _process_part_callback(callback)
        if result is not None:
            return result
    else:
        result = _process_part_message(payload)
        if result is not None:
            return result
    return process_update(payload)


class TelegramPartsWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        supplied_secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not webhook_secret_is_valid(supplied_secret):
            return Response({'detail': 'Webhook secret is invalid.'}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data if isinstance(request.data, dict) else {}
        callback = payload.get('callback_query') if isinstance(payload.get('callback_query'), dict) else {}
        callback_id = str(callback.get('id') or '').strip()
        callback_chat_id = _callback_chat_id(callback)
        update_id = payload.get('update_id')
        callback_acknowledged = False

        logger.info(
            'telegram_webhook_received update_id=%s keys=%s callback=%s',
            update_id,
            ','.join(sorted(str(key) for key in payload.keys())),
            bool(callback_id),
        )
        try:
            if callback_id:
                answer_callback_query(callback_id)
                callback_acknowledged = True

            result = process_agent_update(payload)
            if result is None:
                logger.warning(
                    'telegram_webhook_no_result update_id=%s callback=%s',
                    update_id,
                    bool(callback_id),
                )
                if callback_chat_id:
                    send_message(
                        callback_chat_id,
                        'Не вдалося розпізнати кнопку. Відкрийте запис, розклад або пошук запчастини ще раз.',
                        reply_markup=PARTS_MAIN_REPLY_MARKUP,
                    )
                return Response({'ok': True})

            if result.get('callback_query_id') and not callback_acknowledged:
                answer_callback_query(result['callback_query_id'])
            if result.get('chat_id') and result.get('text'):
                send_message(
                    result['chat_id'],
                    result['text'],
                    reply_markup=_enhance_main_reply_markup(result.get('reply_markup')),
                    inline_markup=result.get('inline_markup'),
                )

            logger.info(
                'telegram_webhook_processed update_id=%s callback=%s result=%s',
                update_id,
                bool(callback_id),
                bool(result),
            )
        except Exception:
            logger.exception(
                'telegram_webhook_processing_failed update_id=%s callback=%s',
                update_id,
                bool(callback_id),
            )
            if callback_id and not callback_acknowledged:
                try:
                    answer_callback_query(
                        callback_id,
                        'Не вдалося виконати дію. Спробуйте ще раз.',
                    )
                except Exception:
                    logger.exception('telegram_callback_error_reply_failed update_id=%s', update_id)
            if callback_chat_id:
                try:
                    send_message(
                        callback_chat_id,
                        'Не вдалося виконати дію. Спробуйте відкрити запис або пошук запчастини ще раз.',
                        reply_markup=PARTS_MAIN_REPLY_MARKUP,
                    )
                except Exception:
                    logger.exception('telegram_callback_failure_message_failed update_id=%s', update_id)
            return Response({'ok': True})

        return Response({'ok': True})
