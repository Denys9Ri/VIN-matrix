from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from .models import PlatformClient, SupportAccessSession
from .partner_views import get_user_company, is_platform_admin

SUPPORT_ACCESS_MINUTES = 30


def _client_payload(client):
    company = get_user_company(client.user)
    client_name = client.user.get_full_name() or client.user.username
    return {
        'client_id': client.id,
        'client_code': client.client_code,
        'client_code_display': f'C{client.client_code}',
        'client_name': client_name,
        'company_name': getattr(company, 'name', '') or client_name,
    }


class SupportStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_platform_admin(request.user):
            return Response({'error': 'Запуск support-сесії доступний тільки адміністратору платформи.'}, status=status.HTTP_403_FORBIDDEN)

        client_id = request.data.get('client_id')
        reason = (request.data.get('reason') or 'Технічна підтримка').strip()[:1000]
        if not client_id:
            return Response({'error': 'client_id є обовʼязковим.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            platform_client = PlatformClient.objects.select_related('user').get(id=client_id)
        except PlatformClient.DoesNotExist:
            return Response({'error': 'Клієнта не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        expires_at = timezone.now() + timedelta(minutes=SUPPORT_ACCESS_MINUTES)
        session = SupportAccessSession.objects.create(
            admin_user=request.user,
            platform_client=platform_client,
            target_user=platform_client.user,
            reason=reason,
            expires_at=expires_at,
            ip_address=(request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', ''))[:255],
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:2000],
        )

        token = AccessToken.for_user(platform_client.user)
        token.set_exp(from_time=timezone.now(), lifetime=timedelta(minutes=SUPPORT_ACCESS_MINUTES))
        token['support_mode'] = True
        token['support_session_id'] = str(session.session_id)
        token['support_actor_id'] = request.user.id
        token['support_target_user_id'] = platform_client.user_id
        token['support_client_id'] = platform_client.id

        payload = _client_payload(platform_client)
        payload.update({
            'access': str(token),
            'expires_at': expires_at.isoformat(),
            'support_session_id': str(session.session_id),
        })
        return Response(payload, status=status.HTTP_201_CREATED)


class SupportExitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session = getattr(request, 'support_access_session', None)
        if not session:
            return Response({'error': 'Потрібен валідний support-token.'}, status=status.HTTP_403_FORBIDDEN)
        if not session.ended_at:
            session.ended_at = timezone.now()
            session.save(update_fields=['ended_at'])
        return Response({'success': True})


class SupportStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session = getattr(request, 'support_access_session', None)
        if not session:
            return Response({'error': 'Потрібен валідний support-token.'}, status=status.HTTP_403_FORBIDDEN)
        payload = _client_payload(session.platform_client)
        payload.update({
            'expires_at': session.expires_at.isoformat(),
            'reason': session.reason,
            'support_session_id': str(session.session_id),
        })
        return Response(payload)
