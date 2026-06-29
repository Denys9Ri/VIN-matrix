"""URL wrapper that keeps the existing routing untouched and adds VIN-matrix Agent."""

from django.urls import include, path

from apps.core.vesna_search_view import VesnaPartSearchView

from .urls import urlpatterns as core_urlpatterns


urlpatterns = [
    path('api/search-parts/', VesnaPartSearchView.as_view(), name='search-parts'),
    path('api/parts/search/', VesnaPartSearchView.as_view(), name='parts-search-alt'),
    path('api/part-search/', VesnaPartSearchView.as_view(), name='part-search-alt'),
    *core_urlpatterns,
    path('api/agent/', include('apps.agent.urls')),
    path('api/agent/', include('apps.agent.routes_read')),
    path('api/agent/', include('apps.agent.routes_tg')),
    path('api/agent/', include('apps.agent.routes_catalog')),
    path('api/agent/', include('apps.agent.routes_actions')),
]
