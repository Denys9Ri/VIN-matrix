from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import (
    RegisterView, 
    VisitViewSet, 
    ServiceCatalogViewSet, 
    ProfileSettingsView, 
    LogoutView,
    ChangePasswordView # ДОДАНО: імпорт контролера зміни пароля
)

# Створюємо роутер для автоматичних маршрутів (CRUD)
router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'services', ServiceCatalogViewSet, basename='service')

def api_root(request):
    return JsonResponse({
        "message": "VIN-matrix API is running!",
        "status": "stable"
    })

urlpatterns = [
    # Головна сторінка API
    path('', api_root),
    
    # Адмінка
    path('admin/', admin.site.urls),
    
    # Авторизація (Вхід та оновлення токена)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Вихід (Logout)
    path('api/logout/', LogoutView.as_view(), name='logout'),
    
    # Реєстрація
    path('api/register/', RegisterView.as_view(), name='register'),
    
    # Налаштування профілю та СТО (Get/Patch)
    path('api/settings/', ProfileSettingsView.as_view(), name='profile-settings'),
    
    # Зміна пароля
    path('api/change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    # Всі API маршрути з роутера (visits та services)
    path('api/', include(router.urls)),
]
