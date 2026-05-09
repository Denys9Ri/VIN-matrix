from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import (
    RegisterView, 
    VisitViewSet, 
    ServiceCatalogViewSet, 
    ProfileSettingsView, 
    LogoutView,
    ChangePasswordView
)

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'services', ServiceCatalogViewSet, basename='service')

def api_root(request):
    return JsonResponse({
        "message": "VIN-matrix API is running!",
        "status": "stable"
    })

urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    path('api/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/', include(router.urls)),
]

# Додаємо підтримку медіа-файлів (логотипів)
if settings.MEDIA_URL:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
