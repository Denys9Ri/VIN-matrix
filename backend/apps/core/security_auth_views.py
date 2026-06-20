from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .security_throttles import LoginIpThrottle, LoginUsernameThrottle, TokenRefreshIpThrottle


class SecureTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginIpThrottle, LoginUsernameThrottle]


class SecureTokenRefreshView(TokenRefreshView):
    throttle_classes = [TokenRefreshIpThrottle]
