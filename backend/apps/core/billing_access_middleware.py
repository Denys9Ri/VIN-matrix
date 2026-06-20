import logging

from django.contrib.auth.models import AnonymousUser
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

from .partner_views import is_platform_admin, is_partner_user, repair_legacy_account
from .request_context import get_request_id
from .subscriptions import get_billing_status


logger = logging.getLogger('vin_matrix.billing')
UNSAFE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Only write requests under these API paths are blocked for a suspended SaaS client.
# GET requests remain available so the client can review data, open Billing and restore access.
CRITICAL_PREFIXES = (
    '/api/visits/',
    '/api/order-parts/',
    '/api/order-services/',
    '/api/inventory/',
    '/api/stock/',
    '/api/stock-movements/',
    '/api/suppliers/',
    '/api/expenses/',
    '/api/import/',
    '/api/store-clients/repeat-sale/',
    '/api/services/',
    '/api/categories/',
    '/api/complexes/',
    '/api/work-posts/',
    '/api/mechanics/',
    '/api/crm-tasks/',
    '/api/crm-communications/',
    '/api/crm-client-statuses/',
    '/api/crm-service-reminders/',
    '/api/recommendations/',
    '/api/delivery/novapost/',
)

# Payment, profile and recovery actions must stay accessible to a blocked client.
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
    return any(path.startswith(prefix) for prefix in CRITICAL_PREFIXES)


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
    """Find a billing profile for the user or for the company owner of an employee account."""
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
    if not owner:
        return None
    try:
        return owner.platform_client_profile
    except Exception:
        return None


class BillingAccessMiddleware:
    """
    Server-side SaaS access guard.

    A frontend redirect is useful UX but is not security. This guard prevents a
    blocked client from changing business data through direct API requests.
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
                    request_id = getattr(request, 'request_id', get_request_id())
                    logger.warning(
                        'billing_write_blocked',
                        extra={
                            'request_id': request_id,
                            'method': request.method,
                            'path': request.path,
                            'user_id': user.id,
                            'client_id': getattr(client, 'id', None),
                        },
                    )
                    return JsonResponse({
                        'error': 'Доступ призупинено. Для виконання цієї дії потрібно оплатити тариф.',
                        'code': 'billing_access_required',
                        'billing_required': True,
                        'billing': billing,
                        'redirect_to': '/billing',
                        'request_id': request_id,
                    }, status=402, json_dumps_params={'ensure_ascii': False})

        return self.get_response(request)
