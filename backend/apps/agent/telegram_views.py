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


class TelegramWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        supplied_secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not webhook_secret_is_valid(supplied_secret):
            return Response({'detail': 'Webhook secret is invalid.'}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data if isinstance(request.data, dict) else {}
        try:
            result = process_update(payload)
            if result and result.get('callback_query_id'):
                answer_callback_query(result['callback_query_id'])
            if result and result.get('chat_id') and result.get('text'):
                send_message(
                    result['chat_id'],
                    result['text'],
                    reply_markup=result.get('reply_markup'),
                    inline_markup=result.get('inline_markup'),
                )
        except Exception:
            # Return 200 to prevent Telegram from retrying malformed or unsupported updates.
            # Internal request logging captures the server-side exception.
            return Response({'ok': True})

        return Response({'ok': True})
