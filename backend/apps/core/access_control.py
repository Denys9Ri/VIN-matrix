from rest_framework.permissions import BasePermission

PLATFORM_ADMIN_USERNAMES = {'Denys9Ri'}
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


def is_platform_admin(user):
    return bool(user and user.is_authenticated and (user.username in PLATFORM_ADMIN_USERNAMES or user.is_staff or user.is_superuser))


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
    message = NO_ACCESS_MESSAGE

    def has_permission(self, request, view):
        return not is_blocked_client(request.user)
