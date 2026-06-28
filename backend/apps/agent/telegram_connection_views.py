import os

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import create_connection_code, write_audit
from .telegram import TELEGRAM_ALLOWED_UPDATES, sync_telegram_webhook


TELEGRAM_WEBHOOK_PATH = '/api/agent/telegram/webhook/'


def _public_webhook_url(request):
    configured_url = os.getenv('TELEGRAM_AGENT_WEBHOOK_URL', '').strip()
    if configured_url:
        return configured_url
    return f'https://{request.get_host()}{TELEGRAM_WEBHOOK_PATH}'


class AgentConnectionCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        channel_type = str(request.data.get('channel_type') or '').strip().lower()
        connection = create_connection_code(request.user, channel_type)
        response_data = {
            'channel_type': connection.channel_type,
            'code': connection.code,
            'expires_at': connection.expires_at,
            'expires_in_minutes': 15,
        }

        if channel_type == 'telegram':
            webhook_url = _public_webhook_url(request)
            try:
                webhook_info = sync_telegram_webhook(webhook_url)
            except APIException as exc:
                response_data['webhook_synced'] = False
                response_data['webhook_error'] = str(getattr(exc, 'detail', exc))
            else:
                response_data['webhook_synced'] = True
                response_data['webhook_url'] = webhook_info.get('url', webhook_url)
                response_data['allowed_updates'] = webhook_info.get(
                    'allowed_updates',
                    TELEGRAM_ALLOWED_UPDATES,
                )
                write_audit(
                    company=connection.company,
                    user=request.user,
                    recognized_intent='telegram_webhook_synced',
                    tool_name='sync_telegram_webhook',
                    tool_result={
                        'webhook_url': response_data['webhook_url'],
                        'allowed_updates': response_data['allowed_updates'],
                    },
                )

        return Response(response_data, status=status.HTTP_201_CREATED)
