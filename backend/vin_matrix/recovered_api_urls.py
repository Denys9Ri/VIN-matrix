from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.core.activity_views import ActivityLogView
from apps.core.company_option_views import CompanyDictionariesView, CompanyOptionBulkView, CompanyOptionDetailView, CompanyOptionListCreateView
from apps.core.complex_views import ServiceComplexViewSet
from apps.core.crm_client_update_views import StoreClientRepeatSaleView, StoreClientUpdateView
from apps.core.crm_client_views import StoreClientDetailView, StoreClientListView
from apps.core.notification_views import NotificationsSummaryView
from apps.core.payment_views import VisitAddPaymentView, VisitDebtReminderView, VisitMarkPaidView, VisitPaymentListView
from apps.core.safe_crm_views import CRMTaskViewSet, VehicleRecommendationViewSet
from apps.core.visit_workflow_views import VisitAcceptanceActView, VisitDiagnosticChecklistView

router = DefaultRouter()
router.register(r'complexes', ServiceComplexViewSet, basename='complex')
router.register(r'recommendations', VehicleRecommendationViewSet, basename='recommendation')
router.register(r'crm-tasks', CRMTaskViewSet, basename='crm-task')

urlpatterns = [
    path('api/store-clients/', StoreClientListView.as_view(), name='store-client-list'),
    path('api/store-clients/detail/', StoreClientDetailView.as_view(), name='store-client-detail'),
    path('api/store-clients/update/', StoreClientUpdateView.as_view(), name='store-client-update'),
    path('api/store-clients/repeat-sale/', StoreClientRepeatSaleView.as_view(), name='store-client-repeat-sale'),
    path('api/visit-acceptance-act/',