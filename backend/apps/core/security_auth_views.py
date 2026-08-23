from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


class SecureTokenObtainPairView(TokenObtainPairView):
    """Rate-limit password guessing without changing the JWT response format."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_login'


class SecureTokenRefreshView(TokenRefreshView):
    """Limit abusive refresh loops while preserving multi-device sessions."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_refresh'


class SecureChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_change'

    def post(self, request):
        old_password = request.data.get('old_password') or ''
        new_password = request.data.get('new_password') or ''

        if not request.user.check_password(old_password):
            return Response({'error': 'Старий пароль невірний'}, status=400)
        if old_password == new_password:
            return Response({'error': 'Новий пароль має відрізнятися від старого.'}, status=400)

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=400)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'message': 'Пароль змінено!', 'reauthenticate_recommended': True}, status=200)
