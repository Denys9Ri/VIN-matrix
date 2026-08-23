from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.views.static import serve
from rest_framework.routers import DefaultRouter

from apps.core.billing_client_link_views import BillingAdminClientLinkView
from apps.core.billing_views import (
    BillingMeView,
    BillingPaymentRequestView,
    BillingAdminClientsView,
    BillingAdminPaymentsView,
    BillingAdminPartnerPayoutsView,
    BillingAdminConfirmPaymentView,
    BillingAdminRejectPaymentView,
)
from apps.core.system_health_views import SystemHealthView
from apps.core.landing_views import LandingLeadView
from apps.core.security_auth_views import (
    SecureChangePasswordView,
    SecureTokenObtainPairView,
    SecureTokenRefreshView,
)
from apps.core.security_endpoint_wrappers import (
    ActivityLogView,
    BackupExportView,
    ClientsExportView,
    CompanyDictionariesView,
    CompanyOptionBulkView,
    CompanyOptionDetailView,
    CompanyOptionListCreateView,
    DashboardSummaryView,
    InventoryExportView,
    InventoryInsightsView,
    LegacyClientsImportView,
    NotificationsSummaryView,
    NovaPostProfileDetailView,
    NovaPostProfileListCreateView,
    NovaPostProfileTestView,
    OnboardingView,
    OrdersExportView,
    ProfileSettingsView,
    StoExpenseViewSet,
    VisitDebtReminderView,
    VisitPaymentListView,
)
from apps.core.security_wrappers import (
    CRMClientStatusViewSet,
    CRMCommunicationViewSet,
    CRMServiceReminderViewSet,
    CRMTaskViewSet,
    MechanicViewSet,
    OrderPartViewSet,
    OrderServiceViewSet,
    ServiceCatalogViewSet,
    ServiceComplexViewSet,
    VehicleRecommendationViewSet,
    VisitViewSet,
    WorkPostViewSet,
)
from apps.core.views import LogoutView
from apps.core.visit_workflow_views import (
    VisitAcceptanceActView,
    VisitDiagnosticChecklistView,
)
from apps.core.document_views import VisitDocumentView
from apps.core.ocr_views import RecognizeDocumentView
from apps.core.stock_views import StockReceiveViewSet, StockMovementViewSet
from apps.core.stock_actions import (
    StockMinQuantityView,
    StockReserveView,
    StockReleaseView,
    StockWriteOffVisitView,
)
from apps.core.crm_client_views import StoreClientListView, StoreClientDetailView
from apps.core.crm_client_update_views import StoreClientUpdateView, StoreClientRepeatSaleView
from apps.core.analytics_views import AnalyticsSummaryView
from apps.core.payment_views import VisitAddPaymentView, VisitMarkPaidView
from apps.core.paid_views import PartSearchView, CategoryViewSet, InventoryItemViewSet
from apps.core.finance_supplier_views import SupplierViewSet, SupplierAccountViewSet
from apps.core.partner_views import PartnerManagementViewSet
from apps.core.platform_auth_views import RegisterView
from apps.core.platform_client_views import SecurePlatformClientViewSet
from apps.core.support_access_views import SupportExitView, SupportStartView, SupportStatusView

from apps.core.novapost_views import (
    NovaPostCitiesView,
    NovaPostWarehousesView,
    NovaPostDeliveryView,
    NovaPostDeliveryStatusView,
    NovaPostDeliveryRefreshActiveView,
)
from apps.core.novapost_hardened_views import NovaPostDeliveryCreateHardenedView


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
router.register(r'supplier-accounts', SupplierAccountViewSet, basename='supplier-account')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'expenses', StoExpenseViewSet, basename='expense')
router.register(r'platform-clients', SecurePlatformClientViewSet, basename='platform-client')
router.register(r'partners', PartnerManagementViewSet, basename='partner')


def openapi_schema(request):
    return JsonResponse({
        'openapi': '3.0.3',
        'info': {'title': 'VIN-matrix API', 'version': '1.0.0'},
        'paths': {
            '/token/': {'post': {'summary': 'Obtain JWT token pair'}},
            '/token/refresh/': {'post': {'summary': 'Refresh JWT access token pair'}},
            '/api/visits/': {'get': {'summary': 'List visits'}, 'post': {'summary': 'Create visit'}},
            '/api/payments/': {'get': {'summary': 'List visit payments'}},
            '/api/inventory/': {'get': {'summary': 'List inventory'}, 'post': {'summary': 'Create inventory item'}},
            '/api/inventory/insights/': {'get': {'summary': 'Inventory purchasing and margin insights'}},
            '/api/onboarding/': {'get': {'summary': 'Get company onboarding state'}, 'patch': {'summary': 'Save onboarding step'}},
            '/api/system/health/': {'get': {'summary': 'Platform health status (platform admin only)'}},
            '/api/billing/admin/clients/': {'get': {'summary': 'SaaS billing clients overview'}},
            '/api/billing/admin/partner-payouts/': {'get': {'summary': 'Partner payout analytics'}},
            '/api/documents/visits/{visit_id}/{doc_type}/': {'get': {'summary': 'Render visit document'}},
            '/api/landing/leads/': {'post': {'summary': 'Create public sales-demo request'}},
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
        'message': 'VIN-matrix API is running!',
        'status': 'stable',
    })


def private_supplier_price_file(request, path):
    # Supplier price lists may contain commercial terms and must never be served
    # as guessable public media URLs. Backend integrations can still read the
    # FileField directly from storage.
    return JsonResponse({'detail': 'Not found.'}, status=404)


urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('schema/', openapi_schema, name='schema'),
    path('docs/', swagger_ui, name='swagger-ui'),

    path('token/', SecureTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', SecureTokenRefreshView.as_view(), name='token_refresh'),

    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/landing/leads/', LandingLeadView.as_view(), name='landing-leads'),
    path('api/onboarding/', OnboardingView.as_view(), name='onboarding'),
    path('api/system/health/', SystemHealthView.as_view(), name='system-health'),
    path('api/support/start/', SupportStartView.as_view(), name='support-start'),
    path('api/support/exit/', SupportExitView.as_view(), name='support-exit'),
    path('api/support/status/', SupportStatusView.as_view(), name='support-status'),

    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    path('api/profile/settings/', ProfileSettingsView.as_view(), name='profile-settings-alt'),
    path('api/change-password/', SecureChangePasswordView.as_view(), name='change-password'),
    path('api/profile/change-password/', SecureChangePasswordView.as_view(), name='change-password-alt'),

    path('api/settings/dictionaries/', CompanyDictionariesView.as_view(), name='settings-dictionaries'),
    path('api/settings/options/', CompanyOptionListCreateView.as_view(), name='settings-options'),
    path('api/settings/options/bulk/', CompanyOptionBulkView.as_view(), name='settings-options-bulk'),
    path('api/settings/options/<int:pk>/', CompanyOptionDetailView.as_view(), name='settings-option-detail'),

    path('api/search-parts/', PartSearchView.as_view(), name='search-parts'),
    path('api/parts/search/', PartSearchView.as_view(), name='parts-search-alt'),
    path('api/part-search/', PartSearchView.as_view(), name='part-search-alt'),

    path('api/notifications/summary/', NotificationsSummaryView.as_view(), name='notifications-summary'),
    path('api/dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('api/analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('api/activity/', ActivityLogView.as_view(), name='activity-log'),

    path('api/billing/me/', BillingMeView.as_view(), name='billing-me'),
    path('api/billing/payment-request/', BillingPaymentRequestView.as_view(), name='billing-payment-request'),
    path('api/billing/admin/clients/', BillingAdminClientsView.as_view(), name='billing-admin-clients'),
    path('api/billing/admin/payments/', BillingAdminPaymentsView.as_view(), name='billing-admin-payments'),
    path('api/billing/admin/partner-payouts/', BillingAdminPartnerPayoutsView.as_view(), name='billing-admin-partner-payouts'),
    path('api/billing/admin/confirm/', BillingAdminConfirmPaymentView.as_view(), name='billing-admin-confirm'),
    path('api/billing/admin/confirm-payment/', BillingAdminConfirmPaymentView.as_view(), name='billing-admin-confirm-payment'),
    path('api/billing/admin/reject/', BillingAdminRejectPaymentView.as_view(), name='billing-admin-reject'),
    path('api/billing/admin/reject-payment/', BillingAdminRejectPaymentView.as_view(), name='billing-admin-reject-payment'),
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
    path('api/inventory/insights/', InventoryInsightsView.as_view(), name='inventory-insights'),

    path('api/store-clients/', StoreClientListView.as_view(), name='store-client-list'),
    path('api/store-clients/detail/', StoreClientDetailView.as_view(), name='store-client-detail'),
    path('api/store-clients/update/', StoreClientUpdateView.as_view(), name='store-client-update'),
    path('api/store-clients/repeat-sale/', StoreClientRepeatSaleView.as_view(), name='store-client-repeat-sale'),

    path('api/delivery/novapost/profiles/', NovaPostProfileListCreateView.as_view(), name='novapost-profiles'),
    path('api/delivery/novapost/profiles/<int:pk>/', NovaPostProfileDetailView.as_view(), name='novapost-profile-detail'),
    path('api/delivery/novapost/profiles/<int:pk>/test/', NovaPostProfileTestView.as_view(), name='novapost-profile-test'),
    path('api/delivery/novapost/cities/', NovaPostCitiesView.as_view(), name='novapost-cities'),
    path('api/delivery/novapost/warehouses/', NovaPostWarehousesView.as_view(), name='novapost-warehouses'),
    path('api/delivery/novapost/refresh-active/', NovaPostDeliveryRefreshActiveView.as_view(), name='novapost-delivery-refresh-active'),

    re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/$', NovaPostDeliveryView.as_view(), name='novapost-delivery'),
    re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/status/$', NovaPostDeliveryStatusView.as_view(), name='novapost-delivery-status'),
    re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create-ttn/$', NovaPostDeliveryCreateHardenedView.as_view(), name='novapost-delivery-create-ttn'),
    re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create/$', NovaPostDeliveryCreateHardenedView.as_view(), name='novapost-delivery-create-fallback'),

    path('api/', include(router.urls)),
]

urlpatterns += [
    re_path(r'^media/supplier_prices/(?P<path>.*)$', private_supplier_price_file, name='private-supplier-price-file'),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
