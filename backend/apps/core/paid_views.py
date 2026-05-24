from rest_framework.permissions import IsAuthenticated

from .access_control import HasPaidAccess
from .safe_crm_views import (
    CategoryViewSet as SafeCategoryViewSet,
    InventoryItemViewSet as SafeInventoryItemViewSet,
    SupplierViewSet as SafeSupplierViewSet,
    MechanicViewSet as SafeMechanicViewSet,
)
from .views import PartSearchView as BasePartSearchView


class CategoryViewSet(SafeCategoryViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class InventoryItemViewSet(SafeInventoryItemViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class SupplierViewSet(SafeSupplierViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class MechanicViewSet(SafeMechanicViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class PartSearchView(BasePartSearchView):
    permission_classes = [IsAuthenticated, HasPaidAccess]
