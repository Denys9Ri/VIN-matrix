import json

from django.contrib.auth.models import AnonymousUser, User
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Company, PlatformClient
from .partner_views import is_platform_admin, is_partner_user, repair_legacy_account
from .subscriptions import get_billing_status


UNSAFE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

CRITICAL_PREFIXES = (
    '/api/visits/',
    '/api/order-parts/',
    '/api/order-services/',
    '/api/inventory/',
    '/api/stock/',
    '/api/import/',
    '/api/store-clients/repeat-sale/',
)

CRITICAL_EXACT = {
    '/api/delivery/novapost/refresh-active/',
}

CRITICAL_CONTAINS = (
    '/create-ttn/',
    '/create/',
)

ALLOW_PREFIXES = (
    '/api/settings/',
    '/api/profile/',
    '/api/billing/',
    '/api/logout/',
    '/api/change-password/',
)


def is_critical_business_path(path):
    if any(path.startswith(prefix) for prefix in ALLOW_PREFIXES):
        return False
    if path in CRITICAL_EXACT:
        return True
    if any(path.startswith(prefix) for prefix in CRITICAL_PREFIXES):
        return True
    if path.startswith('/api/delivery/novapost/visits/') and any(marker in path for marker in CRITICAL_CONTAINS):
        return True
    return False


def jwt_user(request):
    header = request.META.get('HTTP_AUTHORIZATION') or ''
    if not header.lower().startswith('bearer '):
        return None
    try:
        auth = JWTAuthentication()
        validated = auth.get_validated_token(header.split(' ', 1)[1].strip())
        return auth.get_user(validated)
    except Exception:
        return None


def owner_platform_client_for_user(user):
    if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
        return None
    try:
        repair_legacy_account(user)
    except Exception:
        pass

    try:
        return user.platform_client_profile
    except Exception:
        pass

    company = None
    try:
        company = user.company
    except Exception:
        pass
    if not company:
        try:
            company = user.employee_profile.company
        except Exception:
            company = None
    if not company:
        return None

    owner = getattr(company, 'owner', None)
    if owner:
        try:
            return owner.platform_client_profile
        except Exception:
            return None
    return None


class BillingAccessMiddleware:
    """
    Backend SaaS guard.

    Frontend can redirect blocked clients to /billing, but real business actions must be protected server-side too.
    This middleware blocks only critical unsafe API actions for blocked clients/companies and leaves billing/settings/GET open.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in UNSAFE_METHODS and is_critical_business_path(request.path):
            user = getattr(request, 'user', None)
            if not user or not getattr(user, 'is_authenticated', False):
                user = jwt_user(request)

            if user and getattr(user, 'is_authenticated', False) and not (is_platform_admin(user) or is_partner_user(user)):
                client = owner_platform_client_for_user(user)
                billing = get_billing_status(client) if client else {'access_allowed': True}
                if billing.get('access_allowed') is False:
                    return JsonResponse({
                        'error': 'Доступ призупинено. Для виконання цієї дії потрібно оплатити тариф.',
                        'billing_required': True,
                        'billing': billing,
                        'redirect_to': '/billing',
                    }, status=402, json_dumps_params={'ensure_ascii': False})

        return self.get_response(request)
