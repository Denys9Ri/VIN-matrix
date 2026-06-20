from rest_framework.permissions import SAFE_METHODS, BasePermission

from .partner_views import is_platform_admin


NO_ACCESS_MESSAGE = 'Немає доступу через завершення підписки або відсутність оплати.'


def get_employee(user):
    try:
        return user.employee_profile
    except Exception:
        return None


def get_platform_client(user):
    try:
        return user.platform_client_profile
    except Exception:
        return None


def is_partner_user(user):
    employee = get_employee(user)
    return bool(employee and employee.role == 'partner')


def is_blocked_client(user):
    if not user or not user.is_authenticated:
        return False
    if is_platform_admin(user) or is_partner_user(user):
        return False
    client = get_platform_client(user)
    if not client:
        return False
    try:
        from .subscriptions import sync_client_subscription
        sync_client_subscription(client)
    except Exception:
        pass
    return not bool(client.is_access_enabled)


class HasPaidAccess(BasePermission):
    """Full paid-access gate for endpoints that must be hidden for blocked clients."""

    message = NO_ACCESS_MESSAGE

    def has_permission(self, request, view):
        return not is_blocked_client(request.user)


class HasPaidAccessForWrites(BasePermission):
    """Allow blocked clients to read their data, but not to change business data."""

    message = NO_ACCESS_MESSAGE

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return not is_blocked_client(request.user)
