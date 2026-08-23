"""Security-focused wrappers for existing CRM viewsets.

Keeping the proven business logic in the original viewsets avoids risky rewrites.
These subclasses add only permission boundaries and response redaction.
"""

from rest_framework.permissions import IsAuthenticated

from .access_control import (
    CanViewClients,
    CompanyOwnerOrPlatformAdmin,
    OwnerWritePermission,
)
from .communication_views import (
    CRMClientStatusViewSet as BaseCRMClientStatusViewSet,
    CRMCommunicationViewSet as BaseCRMCommunicationViewSet,
    CRMServiceReminderViewSet as BaseCRMServiceReminderViewSet,
)
from .complex_views import ServiceComplexViewSet as BaseServiceComplexViewSet
from .finance_supplier_views import OrderPartViewSet as BaseOrderPartViewSet
from .safe_crm_views import (
    CRMTaskViewSet as BaseCRMTaskViewSet,
    OrderServiceViewSet as BaseOrderServiceViewSet,
    ServiceCatalogViewSet as BaseServiceCatalogViewSet,
    VehicleRecommendationViewSet as BaseVehicleRecommendationViewSet,
    VisitViewSet as BaseVisitViewSet,
    WorkPostViewSet as BaseWorkPostViewSet,
)
from .security_serializers import (
    SecureOrderPartSerializer,
    SecureOrderServiceSerializer,
    SecureServiceComplexSerializer,
    SecureVisitSerializer,
)


class VisitViewSet(BaseVisitViewSet):
    serializer_class = SecureVisitSerializer


class OrderPartViewSet(BaseOrderPartViewSet):
    serializer_class = SecureOrderPartSerializer


class OrderServiceViewSet(BaseOrderServiceViewSet):
    serializer_class = SecureOrderServiceSerializer


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
