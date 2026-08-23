from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


class SecureTokenObtainPairView(TokenObtainPairView):
    """Rate-limit password guessing without changing the JWT response format."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_login'


class SecureTokenRefreshView(TokenRefreshView):
    """Limit abusive refresh loops while preserving multi-device sessions."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_refresh'
