from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter

from apps.core.billing_client_link_views import BillingAdminClientLinkView
from apps.core.billing_views import (
    BillingMeView,
    BillingPaymentRequestView,
    BillingAdminPaymentsView,
    BillingAdminConfirmPaymentView,
    BillingAdminRejectPaymentView,
)

from apps.core.data_exchange_views import (
    OrdersExportView,
    ClientsExportView,
    InventoryExportView,
    BackupExportView,
    LegacyClientsImportView,
)

from apps.core.company_option_views import (
    CompanyOptionListCreateView,
    CompanyOptionDetailView,
    CompanyOptionBulkView,
    CompanyDictionariesView,
)

from apps.core.views import (
    LogoutView,
    ChangePasswordView,
)
from apps.core.safe_crm_views import (
    VisitViewSet,
    WorkPostViewSet,
    ServiceCatalogViewSet,
    OrderPartViewSet,
    OrderServiceViewSet,
    VehicleRecommendationViewSet,
    CRMTaskViewSet,
)
from apps.core.communication_views import (
    CRMCommunicationViewSet,
    CRMClientStatusViewSet,
    CRMServiceReminderViewSet,
)
from apps.core.visit_workflow_views import (
    VisitAcceptanceActView,
    VisitDiagnosticChecklistView,
)
from apps.core.document_views import VisitDocumentView
from apps.core.ocr_views import RecognizeDocumentView
from apps.core.complex_views import ServiceComplexViewSet
from apps.core.stock_views import StockReceiveViewSet, StockMovementViewSet
from apps.core.stock_actions import (
    StockMinQuantityView,
    StockReserveView,
    StockReleaseView,
    StockWriteOffVisitView,
)
from apps.core.crm_client_views import StoreClientListView, StoreClientDetailView
from apps.core.crm_client_update_views import StoreClientUpdateView, StoreClientRepeatSaleView
from apps.core.notification_views import NotificationsSummaryView
from apps.core.dashboard_views import DashboardSummaryView
from apps.core.analytics_views import AnalyticsSummaryView
from apps.core.expense_views import StoExpenseViewSet
from apps.core.activity_views import ActivityLogView
from apps.core.payment_views import (
    VisitAddPaymentView,
    VisitDebtReminderView,
    VisitMarkPaidView,
    VisitPaymentListView,
)
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

from apps.core.novapost_views import (
    NovaPostProfileListCreateView,
    NovaPostProfileDetailView,
    NovaPostProfileTestView,
    NovaPostCitiesView,
    NovaPostWarehousesView,
    NovaPostDeliveryView,
    NovaPostDeliveryStatusView,
    NovaPostDeliveryCreateView,
    NovaPostDeliveryRefreshActiveView,
)


router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'work-posts', WorkPostViewSet, basename='work-post')
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
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'expenses', StoExpenseViewSet, basename='expense')
router.register(r'platform-clients', SecurePlatformClientViewSet, basename='platform-client')
router.register(r'partners', PartnerManagementViewSet, basename='partner')



def openapi_schema(request):
    return JsonResponse({
        "openapi": "3.0.3",
        "info": {"title": "VIN-matrix API", "version": "1.0.0"},
        "paths": {
            "/token/": {"post": {"summary": "Obtain JWT token pair"}},
            "/token/refresh/": {"post": {"summary": "Refresh JWT access token"}},
            "/api/visits/": {"get": {"summary": "List visits"}, "post": {"summary": "Create visit"}},
            "/api/payments/": {"get": {"summary": "List visit payments"}},
            "/api/inventory/": {"get": {"summary": "List inventory"}, "post": {"summary": "Create inventory item"}},
            "/api/documents/visits/{visit_id}/{doc_type}/": {"get": {"summary": "Render visit document"}},
        },
    })


def swagger_ui(request):
    return HttpResponse(
        """<!doctype html><html><head><title>VIN-matrix API docs</title>
        <link rel='stylesheet' href='https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'></head>
        <body><div id='swagger-ui'></div><script src='https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'></script>
        <script>SwaggerUIBundle({url:'/schema/',dom_id:'#swagger-ui'});</script></body></html>""",
        content_type='text/html',
    )

def api_root(request):
    return JsonResponse({
        "message": "VIN-matrix API is running!",
        "status": "stable",
    })


urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('schema/', openapi_schema, name='schema'),
    path('docs/', swagger_ui, name='swagger-ui'),

    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/register/', RegisterView.as_view(), name='register'),

    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    path('api/profile/settings/', ProfileSettingsView.as_view(), name='profile-settings-alt'),
    path('api/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/profile/change-password/', ChangePasswordView.as_view(), name='change-password-alt'),

    path(
        'api/settings/dictionaries/',
        CompanyDictionariesView.as_view(),
        name='settings-dictionaries',
    ),
    path(
        'api/settings/options/',
        CompanyOptionListCreateView.as_view(),
        name='settings-options',
    ),
    path(
        'api/settings/options/bulk/',
        CompanyOptionBulkView.as_view(),
        name='settings-options-bulk',
    ),
    path(
        'api/settings/options/<int:pk>/',
        CompanyOptionDetailView.as_view(),
        name='settings-option-detail',
    ),

    path('api/search-parts/', PartSearchView.as_view(), name='search-parts'),
    path('api/parts/search/', PartSearchView.as_view(), name='parts-search-alt'),
    path('api/part-search/', PartSearchView.as_view(), name='part-search-alt'),

    path('api/notifications/summary/', NotificationsSummaryView.as_view(), name='notifications-summary'),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('api/activity/', ActivityLogView.as_view(), name='activity-log'),

    path('api/billing/me/', BillingMeView.as_view(), name='billing-me'),
    path('api/billing/payment-request/', BillingPaymentRequestView.as_view(), name='billing-payment-request'),
    path('api/billing/admin/payments/', BillingAdminPaymentsView.as_view(), name='billing-admin-payments'),
    path('api/billing/admin/confirm/', BillingAdminConfirmPaymentView.as_view(), name='billing-admin-confirm'),
    path('api/billing/admin/reject/', BillingAdminRejectPaymentView.as_view(), name='billing-admin-reject'),
    path('api/billing/admin/client-link/', BillingAdminClientLinkView.as_view(), name='billing-admin-client-link'),

    path('api/export/orders/', OrdersExportView.as_view(), name='export-orders'),
    path('api/export/clients/', ClientsExportView.as_view(), name='export-clients'),
    path('api/export/inventory/', InventoryExportView.as_view(), name='export-inventory'),
    path('api/export/backup/', BackupExportView.as_view(), name='export-backup'),
    path('api/import/clients/', LegacyClientsImportView.as_view(), name='import-clients'),
    path('api/import/legacy-clients/', LegacyClientsImportView.as_view(), name='import-legacy-clients'),

    path('api/payments/', VisitPaymentListView.as_view(), name='visit-payments'),
    path('api/visits/<int:pk>/add-payment/', VisitAddPaymentView.as_view(), name='visit-add-payment'),
    path('api/visits/<int:pk>/mark-paid/', VisitMarkPaidView.as_view(), name='visit-mark-paid'),
    path('api/visits/<int:pk>/debt-reminder/', VisitDebtReminderView.as_view(), name='visit-debt-reminder'),

    path('api/documents/visits/<int:visit_id>/<str:doc_type>/', VisitDocumentView.as_view(), name='visit-document'),
    path('api/visits/<int:visit_id>/documents/<str:doc_type>/', VisitDocumentView.as_view(), name='visit-document-alt'),

    path('api/visits/recognize_document/', RecognizeDocumentView.as_view(), name='recognize-document'),
    path('api/visit-acceptance-act/', VisitAcceptanceActView.as_view(), name='visit-acceptance-act'),
    path('api/visit-diagnostic-checklist/', VisitDiagnosticChecklistView.as_view(), name='visit-diagnostic-checklist'),

    path('api/stock/receive/', StockReceiveViewSet.as_view({'post': 'receive'}), name='stock-receive'),
    path('api/stock/set-min/', StockMinQuantityView.as_view(), name='stock-set-min'),
    path('api/stock/reserve/', StockReserveView.as_view(), name='stock-reserve'),
    path('api/stock/release/', StockReleaseView.as_view(), name='stock-release'),
    path('api/stock/write-off-visit/', StockWriteOffVisitView.as_view(), name='stock-write-off-visit'),

    path('api/store-clients/', StoreClientListView.as_view(), name='store-client-list'),
    path('api/store-clients/detail/', StoreClientDetailView.as_view(), name='store-client-detail'),
    path('api/store-clients/update/', StoreClientUpdateView.as_view(), name='store-client-update'),
    path('api/store-clients/repeat-sale/', StoreClientRepeatSaleView.as_view(), name='store-client-repeat-sale'),

    path('api/delivery/novapost/profiles/', NovaPostProfileListCreateView.as_view(), name='novapost-profiles'),
    path('api/delivery/novapost/profiles/<int:pk>/', NovaPostProfileDetailView.as_view(), name='novapost-profile-detail'),
    path('api/delivery/novapost/profiles/<int:pk>/test/', NovaPostProfileTestView.as_view(), name='novapost-profile-test'),
    path('api/delivery/novapost/cities/', NovaPostCitiesView.as_view(), name='novapost-cities'),
    path('api/delivery/novapost/warehouses/', NovaPostWarehousesView.as_view(), name='novapost-warehouses'),
    path(
        'api/delivery/novapost/refresh-active/',
        NovaPostDeliveryRefreshActiveView.as_view(),
        name='novapost-delivery-refresh-active',
    ),

    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/$',
        NovaPostDeliveryView.as_view(),
        name='novapost-delivery',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/status/$',
        NovaPostDeliveryStatusView.as_view(),
        name='novapost-delivery-status',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create-ttn/$',
        NovaPostDeliveryCreateView.as_view(),
        name='novapost-delivery-create-ttn',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create/$',
        NovaPostDeliveryCreateView.as_view(),
        name='novapost-delivery-create-fallback',
    ),

    path('api/', include(router.urls)),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
