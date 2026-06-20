from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class ApiAnonThrottle(AnonRateThrottle):
    scope = 'api_anon'


class ApiUserThrottle(UserRateThrottle):
    scope = 'api_user'


class _IpThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class LoginIpThrottle(_IpThrottle):
    scope = 'login_ip'


class TokenRefreshIpThrottle(_IpThrottle):
    scope = 'token_refresh_ip'


class RegistrationIpThrottle(_IpThrottle):
    scope = 'registration_ip'


class LoginUsernameThrottle(SimpleRateThrottle):
    """Protect a known username even when attempts arrive from multiple IPs."""

    scope = 'login_username'

    def get_cache_key(self, request, view):
        username = str(getattr(request, 'data', {}).get('username', '') or '').strip().lower()
        ident = username[:150] or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
