from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import (
    LogoutView,
    ChangePasswordView,
)
from apps.core.safe_crm_views import (
    VisitViewSet,
    ServiceCatalogViewSet,
    OrderPartViewSet,
    OrderServiceViewSet,
    VehicleRecommendationViewSet,
    CRMTaskViewSet,
)
from apps.core.communication_views import CRMCommunicationViewSet, CRMClientStatusViewSet, CRMServiceReminderViewSet
from apps.core.visit_workflow_views import VisitAcceptanceActView, VisitDiagnosticChecklistView
from apps.core.ocr_views import RecognizeDocumentView
from apps.core.complex_views import ServiceComplexViewSet
from apps.core.paid_views import (
    PartSearchView,
    MechanicViewSet,
    CategoryViewSet,
    InventoryItemViewSet,
    SupplierViewSet,
)
from apps.core.partner_views import PartnerManagementViewSet
from apps.core.platform_auth_views import RegisterView
from apps.core.platform_client_views import SecurePlatformClientViewSet
from apps.core.profile_views import ProfileSettingsView

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'services', ServiceCatalogViewSet, basename='service')
router.register(r'complexes', ServiceComplexViewSet, basename='complex')
router.register(r'recommendations', VehicleRecommendationViewSet, basename='recommendation')
router.register(r'crm-tasks', CRMTaskViewSet, basename='crm-task')
router.register(r'crm-communications', CRMCommunicationViewSet, basename='crm-communication')
router.register(r'crm-client-statuses', CRMClientStatusViewSet, basename='crm-client-status')
router.register(r'crm-service-reminders', CRMServiceReminderViewSet, basename='crm-service-reminder')
router.register(r'mechanics', MechanicViewSet, basename='mechanic')
router.register(r'order-parts', OrderPartViewSet, basename='order-part')
router.register(r'order-services', OrderServiceViewSet, basename='order-service')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'inventory', InventoryItemViewSet, basename='inventory')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'platform-clients', SecurePlatformClientViewSet, basename='platform-client')
router.register(r'partners', PartnerManagementViewSet, basename='partner')

def api_root(request):
    return JsonResponse({"message": "VIN-matrix API is running!", "status": "stable"})

urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    path('api/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/search-parts/', PartSearchView.as_view(), name='search-parts'),
    path('api/visits/recognize_document/', RecognizeDocumentView.as_view(), name='recognize-document'),
    path('api/visit-acceptance-act/', VisitAcceptanceActView.as_view(), name='visit-acceptance-act'),
    path('api/visit-diagnostic-checklist/', VisitDiagnosticChecklistView.as_view(), name='visit-diagnostic-checklist'),
    path('api/', include(router.urls)),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
