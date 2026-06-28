import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .telegram import (
    answer_callback_query,
    process_update,
    send_message,
    webhook_secret_is_valid,
)


logger = logging.getLogger('vin_matrix.api')


def _callback_chat_id(callback):
    message = callback.get('message') if isinstance(callback, dict) else None
    chat = message.get('chat') if isinstance(message, dict) else None
    chat_id = chat.get('id') if isinstance(chat, dict) else None
    return str(chat_id) if chat_id not in (None, '') else ''


class TelegramWebhookView(APIView):
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
            # Telegram keeps the inline button in a loading state until this method is called.
            # Acknowledge first, then perform the database and messaging work.
            if callback_id:
                answer_callback_query(callback_id)
                callback_acknowledged = True

            result = process_update(payload)
            if result is None:
                logger.warning(
                    'telegram_webhook_no_result update_id=%s callback=%s',
                    update_id,
                    bool(callback_id),
                )
                if callback_chat_id:
                    send_message(
                        callback_chat_id,
                        'Не вдалося розпізнати кнопку. Відкрийте запис або розклад ще раз.',
                    )
                return Response({'ok': True})

            if result.get('callback_query_id') and not callback_acknowledged:
                answer_callback_query(result['callback_query_id'])
            if result.get('chat_id') and result.get('text'):
                send_message(
                    result['chat_id'],
                    result['text'],
                    reply_markup=result.get('reply_markup'),
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
                    logger.exception(
                        'telegram_callback_error_reply_failed update_id=%s',
                        update_id,
                    )
            if callback_chat_id:
                try:
                    send_message(
                        callback_chat_id,
                        'Не вдалося виконати дію. Спробуйте відкрити запис ще раз.',
                    )
                except Exception:
                    logger.exception(
                        'telegram_callback_failure_message_failed update_id=%s',
                        update_id,
                    )
            # Return 200 to prevent Telegram from retrying malformed or unsupported updates.
            return Response({'ok': True})

        return Response({'ok': True})
