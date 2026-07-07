from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from .models import SupportAccessSession


class SupportJWTAuthentication(JWTAuthentication):
    """JWT auth that preserves normal JWT behavior and validates support sessions."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        if not bool(validated_token.get('support_mode', False)):
            return result

        session_id = validated_token.get('support_session_id')
        actor_id = validated_token.get('support_actor_id')
        target_user_id = validated_token.get('support_target_user_id')
        client_id = validated_token.get('support_client_id')

        if not all([session_id, actor_id, target_user_id, client_id]):
            raise AuthenticationFailed('Недійсний support-token.', code='support_token_invalid')

        try:
            session = SupportAccessSession.objects.select_related(
                'admin_user', 'target_user', 'platform_client'
            ).get(session_id=session_id)
        except SupportAccessSession.DoesNotExist as exc:
            raise AuthenticationFailed('Support-сесія не знайдена.', code='support_session_not_found') from exc

        if session.ended_at:
            raise AuthenticationFailed('Support-сесію завершено.', code='support_session_ended')
        if session.expires_at <= timezone.now():
            raise AuthenticationFailed('Термін support-сесії минув.', code='support_session_expired')
        try:
            actor_id = int(actor_id)
            target_user_id = int(target_user_id)
            client_id = int(client_id)
        except (TypeError, ValueError) as exc:
            raise AuthenticationFailed('Недійсні support claims.', code='support_claims_invalid') from exc

        if session.admin_user_id != actor_id:
            raise AuthenticationFailed('Support actor mismatch.', code='support_actor_mismatch')
        if session.target_user_id != target_user_id or user.id != target_user_id:
            raise AuthenticationFailed('Support target mismatch.', code='support_target_mismatch')
        if session.platform_client_id != client_id:
            raise AuthenticationFailed('Support client mismatch.', code='support_client_mismatch')
        if session.platform_client.user_id != session.target_user_id:
            raise AuthenticationFailed('Support client owner mismatch.', code='support_client_owner_mismatch')

        request.support_access_session = session
        request.support_actor = session.admin_user
        request.support_platform_client = session.platform_client
        return result
