from .platform_auth_views import RegisterView
from .security_throttles import RegistrationIpThrottle


class SecureRegisterView(RegisterView):
    throttle_classes = [RegistrationIpThrottle]
