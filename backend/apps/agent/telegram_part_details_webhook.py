from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import telegram_parts_webhook as base
from .models import AgentConversation, AgentUserChannel
from .telegram_part_list_details import enrich_part_offer_list
from .telegram_write_execution import finalize_telegram_write


def _conversation_for_chat(chat_id):
    if not chat_id:
        return None
    channel = AgentUserChannel.objects.filter(
        channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
        chat_id=str(chat_id),
        is_active=True,
    ).first()
    if not channel:
        return None
    return AgentConversation.objects.filter(channel=channel).first()


class TelegramPartDetailsWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        supplied_secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not base.webhook_secret_is_valid(supplied_secret):
            return Response({'detail': 'Webhook secret is invalid.'}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data if isinstance(request.data, dict) else {}
        callback = payload.get('callback_query') if isinstance(payload.get('callback_query'), dict) else {}
        callback_id = str(callback.get('id') or '').strip()
        callback_chat_id = base._callback_chat_id(callback)
        update_id = payload.get('update_id')
        callback_acknowledged = False

        base.logger.info(
            'telegram_webhook_received update_id=%s keys=%s callback=%s',
            update_id,
            ','.join(sorted(str(key) for key in payload.keys())),
            bool(callback_id),
        )
        try:
            if callback_id:
                base.answer_callback_query(callback_id)
                callback_acknowledged = True

            result = base.process_agent_update(payload)
            if result is None:
                base.logger.warning(
                    'telegram_webhook_no_result update_id=%s callback=%s',
                    update_id,
                    bool(callback_id),
                )
                if callback_chat_id:
                    base.send_message(
                        callback_chat_id,
                        'Не вдалося розпізнати кнопку. Відкрийте запис, розклад або пошук запчастини ще раз.',
                        reply_markup=base.PARTS_MAIN_REPLY_MARKUP,
                    )
                return Response({'ok': True})

            result = finalize_telegram_write(result)
            result = enrich_part_offer_list(
                result,
                _conversation_for_chat(result.get('chat_id')),
            )
            if result.get('callback_query_id') and not callback_acknowledged:
                base.answer_callback_query(result['callback_query_id'])
            if result.get('chat_id') and result.get('text'):
                base.send_message(
                    result['chat_id'],
                    result['text'],
                    reply_markup=base._enhance_main_reply_markup(result.get('reply_markup')),
                    inline_markup=result.get('inline_markup'),
                )

            base.logger.info(
                'telegram_webhook_processed update_id=%s callback=%s result=%s',
                update_id,
                bool(callback_id),
                bool(result),
            )
        except Exception:
            base.logger.exception(
                'telegram_webhook_processing_failed update_id=%s callback=%s',
                update_id,
                bool(callback_id),
            )
            if callback_id and not callback_acknowledged:
                try:
                    base.answer_callback_query(
                        callback_id,
                        'Не вдалося виконати дію. Спробуйте ще раз.',
                    )
                except Exception:
                    base.logger.exception('telegram_callback_error_reply_failed update_id=%s', update_id)
            if callback_chat_id:
                try:
                    base.send_message(
                        callback_chat_id,
                        'Не вдалося виконати дію. Спробуйте відкрити запис або пошук запчастини ще раз.',
                        reply_markup=base.PARTS_MAIN_REPLY_MARKUP,
                    )
                except Exception:
                    base.logger.exception('telegram_callback_failure_message_failed update_id=%s', update_id)
            return Response({'ok': True})

        return Response({'ok': True})
