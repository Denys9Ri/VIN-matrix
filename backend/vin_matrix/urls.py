from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter

from apps.core.billing_client_link_views import BillingAdminClientLinkView
from apps.core.billing_runtime_views import (
    BillingMeView,
    BillingPaymentRequestView,
    BillingAdminClientsView,
    BillingAdminPaymentsView,
    BillingAdminPartnerPayoutsView,
    BillingAdminConfirmPaymentView,
    BillingAdminRejectPaymentView,
)
from apps.core.onboarding_views import OnboardingView
from apps.core.system_health_views import SystemHealthView

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
    OrderViewSet,
    WorkPostAvailabilityView,
    PartSearchView,
)
from apps.core.inventory_views import (
    InventoryViewSet,
    CategoryViewSet,
    SupplierViewSet,
)
from apps.core.stock_views import (
    StockReceiveViewSet,
    StockMinQuantityView,
    StockReserveView,
    StockReleaseView,
    StockWriteOffVisitView,
)
from apps.core.inventory_insights_views import InventoryInsightsView
from apps.core.partner_views import PartnerManagementViewSet
from apps.core.platform_client_views import SecurePlatformClientViewSet
from apps.core.profile_views import ProfileSettingsView
from apps.core.platform_auth_views import RegisterView
from apps.core.activity_views import ActivityLogView
from apps.core.dashboard_views import DashboardSummaryView
from apps.core.analytics_views import AnalyticsSummaryView
from apps.core.notifications_views import NotificationsSummaryView
from apps.core.payment_views import VisitPaymentListView, VisitAddPaymentView, VisitMarkPaidView, VisitDebtReminderView
from apps.core.document_views import VisitDocumentView, RecognizeDocumentView, VisitAcceptanceActView, VisitDiagnosticChecklistView
from apps.core.novapost_views import (
    NovaPostProfileListCreateView,
    NovaPostProfileDetailView,
    NovaPostProfileTestView,
    NovaPostCitiesView,
    NovaPostWarehousesView,
    NovaPostDeliveryView,
    NovaPostDeliveryStatusView,
    NovaPostDeliveryRefreshActiveView,
)
from apps.core.novapost_hardened_views import NovaPostDeliveryCreateHardenedView
from apps.core.store_client_views import StoreClientListView, StoreClientDetailView, StoreClientUpdateView, StoreClientRepeatSaleView


router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visits')
router.register(r'orders', OrderViewSet, basename='orders')
router.register(r'order-parts', OrderPartViewSet, basename='order-parts')
router.register(r'order-services', OrderServiceViewSet, basename='order-services')
router.register(r'work-posts', WorkPostViewSet, basename='work-posts')
router.register(r'services', ServiceCatalogViewSet, basename='services')
router.register(r'inventory', InventoryViewSet, basename='inventory')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'partners', PartnerManagementViewSet, basename='partners')
router.register(r'platform-clients', SecurePlatformClientViewSet, basename='platform-clients')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/onboarding/', OnboardingView.as_view(), name='onboarding'),
    path('api/system/health/', SystemHealthView.as_view(), name='system-health'),

    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    path('api/profile/settings/', ProfileSettingsView.as_view(), name='profile-settings-alt'),
    path('api/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/profile/change-password/', ChangePasswordView.as_view(), name='change-password-alt'),

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
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
