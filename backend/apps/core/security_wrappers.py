"""Security-focused wrappers for existing CRM viewsets.

Keeping the proven business logic in the original viewsets avoids risky rewrites.
These subclasses add permission boundaries, response redaction and write guards
for fields that must never be changed through an operational employee endpoint.
"""

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .access_control import (
    CanViewClients,
    CompanyOwnerOrPlatformAdmin,
    OwnerWritePermission,
    can_take_payment_data,
    can_view_financial_data,
    is_mechanic_user,
)
from .communication_views import (
    CRMClientStatusViewSet as BaseCRMClientStatusViewSet,
    CRMCommunicationViewSet as BaseCRMCommunicationViewSet,
    CRMServiceReminderViewSet as BaseCRMServiceReminderViewSet,
)
from .complex_views import ServiceComplexViewSet as BaseServiceComplexViewSet
from .finance_supplier_views import OrderPartViewSet as BaseOrderPartViewSet
from .paid_views import MechanicViewSet as BaseMechanicViewSet
from .safe_crm_views import (
    CRMTaskViewSet as BaseCRMTaskViewSet,
    OrderServiceViewSet as BaseOrderServiceViewSet,
    ServiceCatalogViewSet as BaseServiceCatalogViewSet,
    VehicleRecommendationViewSet as BaseVehicleRecommendationViewSet,
    VisitViewSet as BaseVisitViewSet,
    WorkPostViewSet as BaseWorkPostViewSet,
    safe_ensure_company,
)
from .security_serializers import (
    SecureOrderPartSerializer,
    SecureOrderServiceSerializer,
    SecureServiceComplexSerializer,
    SecureVisitSerializer,
)


class VisitViewSet(BaseVisitViewSet):
    serializer_class = SecureVisitSerializer

    def create(self, request, *args, **kwargs):
        # The normal create form sends unpaid/0 defaults. Allow those values, but
        # do not let a mechanic smuggle an initial payment through the visit API.
        if is_mechanic_user(request.user) and not can_take_payment_data(request.user):
            payment_status = str(request.data.get('payment_status') or 'unpaid').lower()
            try:
                prepayment = float(request.data.get('prepayment_amount') or 0)
            except Exception:
                prepayment = 1
            if payment_status not in {'', 'unpaid'} or prepayment != 0:
                return Response({'error': 'Оплати потрібно проводити через захищений модуль оплат.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if is_mechanic_user(request.user) and {'payment_status', 'prepayment_amount'} & set(request.data.keys()):
            return Response({'error': 'Статус і сума оплати змінюються тільки через модуль оплат.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class OrderPartViewSet(BaseOrderPartViewSet):
    serializer_class = SecureOrderPartSerializer


class OrderServiceViewSet(BaseOrderServiceViewSet):
    serializer_class = SecureOrderServiceSerializer
    _SENSITIVE_PAYROLL_FIELDS = {'commission_percent', 'commission_base', 'commission_amount'}

    def _with_sanitized_payroll(self, callback, *args, **kwargs):
        if not is_mechanic_user(self.request.user) or can_view_financial_data(self.request.user):
            return callback(*args, **kwargs)
        original = self.request.data
        try:
            patched = original.copy()
            for field in self._SENSITIVE_PAYROLL_FIELDS:
                try:
                    patched.pop(field, None)
                except TypeError:
                    if field in patched:
                        del patched[field]
            self.request._full_data = patched
            return callback(*args, **kwargs)
        finally:
            self.request._full_data = original

    def perform_create(self, serializer):
        # A mechanic cannot choose their own commission. The proven base view
        # will derive it from the employee settings set by the owner.
        return self._with_sanitized_payroll(super().perform_create, serializer)

    def update(self, request, *args, **kwargs):
        return self._with_sanitized_payroll(super().update, request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class WorkPostViewSet(BaseWorkPostViewSet):
    # Work posts are needed when creating/editing visits, so reads stay
    # available. Company structure may only be changed by the owner/admin.
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class ServiceCatalogViewSet(BaseServiceCatalogViewSet):
    # Mechanics may search the work catalog but cannot silently rewrite company
    # prices or catalog entries.
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class VehicleRecommendationViewSet(BaseVehicleRecommendationViewSet):
    permission_classes = [IsAuthenticated, CanViewClients]


class CRMTaskViewSet(BaseCRMTaskViewSet):
    permission_classes = [IsAuthenticated, CanViewClients]


class CRMCommunicationViewSet(BaseCRMCommunicationViewSet):
    permission_classes = [IsAuthenticated, CanViewClients]


class CRMClientStatusViewSet(BaseCRMClientStatusViewSet):
    permission_classes = [IsAuthenticated, CanViewClients]


class CRMServiceReminderViewSet(BaseCRMServiceReminderViewSet):
    permission_classes = [IsAuthenticated, CanViewClients]


class ServiceComplexViewSet(BaseServiceComplexViewSet):
    serializer_class = SecureServiceComplexSerializer

    def get_permissions(self):
        # Reading/applying a prepared package is operational work. Creating or
        # changing reusable company templates is owner-level configuration.
        if self.action in {'list', 'retrieve', 'apply_to_visit'}:
            classes = [IsAuthenticated]
        else:
            classes = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]
        return [permission() for permission in classes]


class MechanicViewSet(BaseMechanicViewSet):
    """Owner-only employee management with password-strength enforcement."""

    def _validate_employee_password(self, password, *, user=None):
        if not password:
            return 'Пароль працівника обовʼязковий.'
        target = user or User(username=str(self.request.data.get('username') or ''), first_name=str(self.request.data.get('first_name') or ''))
        try:
            validate_password(password, user=target)
        except DjangoValidationError as exc:
            return ' '.join(exc.messages)
        return ''

    def create(self, request, *args, **kwargs):
        error = self._validate_employee_password(request.data.get('password') or '')
        if error:
            return Response({'error': error}, status=400)
        return super().create(request, *args, **kwargs)

    def partial_update(self, request, pk=None, *args, **kwargs):
        new_password = request.data.get('new_password') or ''
        if new_password:
            company = safe_ensure_company(request.user)
            target = User.objects.filter(id=pk, employee_profile__company=company).first() if company else None
            if not target:
                return Response({'error': 'Працівника не знайдено.'}, status=404)
            error = self._validate_employee_password(new_password, user=target)
            if error:
                return Response({'error': error}, status=400)
        return super().partial_update(request, pk=pk, *args, **kwargs)
