from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, re_path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.core.novapost_views import NovaPostDeliveryCreateView


def api_root(request):
    return JsonResponse({'message': 'VIN-matrix API is running!'})

urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
   