from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.core.views import ChangePasswordView, LogoutView
from apps.core.platform_auth_views import RegisterView
from apps.core.profile_views import ProfileSettingsView
from apps.core.safe_crm_views import CRMTaskViewSet, OrderPartViewSet, OrderServiceViewSet, ServiceCatalogViewSet, VehicleRecommendationViewSet, VisitViewSet
from apps.core.communication_views import CRMClientStatusViewSet, CRMCommunicationViewSet, CRMServiceReminderViewSet
from apps.core.visit_workflow_views import VisitAcceptanceActView, VisitDiagnosticChecklistView
from apps.core.ocr_views import RecognizeDocumentView
from apps.core.complex_views import ServiceComplexViewSet
from apps.core.stock_views import StockMovementViewSet, StockReceiveViewSet
from apps.core