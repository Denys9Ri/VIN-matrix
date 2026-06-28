"""URL wrapper that keeps the existing routing untouched and adds VIN-matrix Agent."""

from django.urls import include, path

from .urls import urlpatterns as core_urlpatterns


urlpatterns = [
    *core_urlpatterns,
    path('api/agent/', include('apps.agent.urls')),
    path('api/agent/', include('apps.agent.routes_read')),
]
