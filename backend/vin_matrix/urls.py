from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from apps.core.views import VisitViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.core.views import RegisterView

# Функція для головної сторінки, щоб не було 404
def api_root(request):
    return JsonResponse({
        "name": "VIN-matrix API",
        "status": "active",
        "endpoints": {
            "auth": "/api/token/",
            "visits": "/api/core/visits/",
            "search": "/api/integrations/search/"
        }
    })

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')

urlpatterns = [
    path('', api_root), # Тепер на головній буде статус API замість 404
    path('admin/', admin.site.urls),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/core/', include(router.urls)),
    path('api/integrations/', include('apps.integrations.urls')),
]
