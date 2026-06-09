from django.contrib import admin
from django.http import JsonResponse
from django.urls import path,re_path
from apps.core.novapost_views import NovaPostDeliveryCreateView

def api_root(request): return JsonResponse({'message':'VIN-matrix API is running!'})
urlpatterns=[path('',api_root),path('admin/',admin.site.urls),re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create-ttn/$',