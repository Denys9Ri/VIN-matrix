from rest_framework.permissions import SAFE_METHODS, BasePermission


PLATFORM_ADMIN_USERNAMES = {'Denys9Ri'}
NO_ACCESS_MESSAGE = 'Немає доступу через завершення підписки або відсутність оплати.'

# Some paid wrappers intentionally replace permission_classes of their safe base
# view. Keep the mechanic-specific restrictions here as a second backend gate so
# a wrapper can never accidentally reopen sensitive data.
PAID_VIEW_MECHANIC_FEATURES = {
    'InventoryItemViewSet': 'can_manage_inventory',
}


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


def is_mechanic_user(user):
    employee = get_employee(user)
    return bool(employee and employee.role == 'mechanic')


def is_company_owner(user):
    if not user or not user.is_authenticated:
        return False
    try:
        return bool(user.company)
    except Exception:
        return False


def mechanic_feature_allowed(user, field):
    """Owners/admins/partners pass automatically; mechanics use the saved feature flag."""
    if not user or not user.is_authenticated:
        return False
    employee = get_employee(user)
    if not employee or employee.role != 'mechanic':
        return True
    return bool(getattr(employee, field, False))


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
    """Paid-access gate plus a fail-closed guard for sensitive paid wrappers."""

    message = NO_ACCESS_MESSAGE

    def has_permission(self, request, view):
        if is_blocked_client(request.user):
            return False

        view_name = view.__class__.__name__
        feature = PAID_VIEW_MECHANIC_FEATURES.get(view_name)
        if feature and not mechanic_feature_allowed(request.user, feature):
            self.message = 'У вас немає доступу до складу.'
            return False

        # Employee management contains passwords, access flags and payroll data.
        # Only the company owner/platform admin may call this API.
        if view_name == 'MechanicViewSet' and not (is_company_owner(request.user) or is_platform_admin(request.user)):
            self.message = 'Керування працівниками доступне тільки власнику.'
            return False

        return True


class HasPaidAccessForWrites(BasePermission):
    """Allow blocked clients to read their data, but not to change business data."""

    message = NO_ACCESS_MESSAGE

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return not is_blocked_client(request.user)


class MechanicFeaturePermission(BasePermission):
    feature_field = ''
    message = 'Для цього працівника функція вимкнена власником.'

    def has_permission(self, request, view):
        return mechanic_feature_allowed(request.user, self.feature_field)


class CanCreateVisits(MechanicFeaturePermission):
    feature_field = 'can_create_visits'
    message = 'У вас немає права створювати нові візити.'


class CanViewClients(MechanicFeaturePermission):
    feature_field = 'can_view_clients'
    message = 'У вас немає доступу до клієнтської бази та історії.'


class CanViewFinances(MechanicFeaturePermission):
    feature_field = 'can_view_finances'
    message = 'У вас немає доступу до фінансів.'


class CanViewAnalytics(MechanicFeaturePermission):
    feature_field = 'can_view_analytics'
    message = 'У вас немає доступу до аналітики.'


class CanManageInventory(MechanicFeaturePermission):
    feature_field = 'can_manage_inventory'
    message = 'У вас немає доступу до складу.'


class CanTakePayments(MechanicFeaturePermission):
    feature_field = 'can_take_payments'
    message = 'У вас немає права приймати або закривати оплати.'
