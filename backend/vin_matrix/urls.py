from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import (
    RegisterView, VisitViewSet, ServiceCatalogViewSet, 
    ProfileSettingsView, LogoutView, ChangePasswordView, MechanicViewSet,
    OrderPartViewSet, OrderServiceViewSet,
    PlatformClientViewSet,
    # === НОВІ ІМПОРТИ ДЛЯ СКЛАДУ ТА ПОСТАЧАЛЬНИКІВ ===
    CategoryViewSet, InventoryItemViewSet, SupplierViewSet,
    PartSearchView # <--- ДОДАЛИ ТІЛЬКИ ЦЕ
)

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'services', ServiceCatalogViewSet, basename='service')
router.register(r'mechanics', MechanicViewSet, basename='mechanic')
# === НОВІ РОУТИ ===
router.register(r'order-parts', OrderPartViewSet, basename='order-part')
router.register(r'order-services', OrderServiceViewSet, basename='order-service')
# === НОВІ РОУТИ ДЛЯ СКЛАДУ ТА ПОСТАЧАЛЬНИКІВ ===
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'inventory', InventoryItemViewSet, basename='inventory')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'platform-clients', PlatformClientViewSet, basename='platform-client')

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
    path('api/search-parts/', PartSearchView.as_view(), name='search-parts'), # <--- І ДОДАЛИ ЦЕЙ РЯДОК
    path('api/', include(router.urls)),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
