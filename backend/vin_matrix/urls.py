from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import VisitViewSet

# Роутер для візитів
router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Авторизація (Логін)
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Наші візити
    path('api/core/', include(router.urls)),
    
    # Інтеграції (Пошук, Прайси, Постачальники)
    path('api/integrations/', include('apps.integrations.urls')),
]
