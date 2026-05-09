from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import RegisterView, VisitViewSet

# Роутер для автоматичного створення шляхів до візитів (API)
router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')

def api_root(request):
    return JsonResponse({"message": "VIN-matrix API is running!"})

urlpatterns = [
    # Головна сторінка API
    path('', api_root),
    
    # Адмінка
    path('admin/', admin.site.urls),
    
    # === ТУТ БУЛА ПОМИЛКА 404: МАРШРУТИ ДЛЯ ВХОДУ (ТОКЕНИ) ===
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Реєстрація
    path('api/register/', RegisterView.as_view(), name='register'),
    
    # Всі інші API маршрути (наприклад, /api/visits/)
    path('api/', include(router.urls)),
]
