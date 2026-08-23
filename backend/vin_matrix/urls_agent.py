"""URL wrapper that keeps the existing routing untouched and adds VIN-matrix Agent."""

from django.urls import include, path

from apps.core.analytics_payroll_views import AnalyticsSummaryView as PayrollAnalyticsSummaryView
from apps.core.mechanic_payroll_views import MechanicViewSet as PayrollMechanicViewSet
from apps.core.vesna_search_view import VesnaPartSearchView

from .urls import urlpatterns as core_urlpatterns


mechanic_list_view = PayrollMechanicViewSet.as_view({'get': 'list', 'post': 'create'})
mechanic_detail_view = PayrollMechanicViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'})


urlpatterns = [
    # Payroll-aware routes must come before the legacy router entries below.
    path('api/mechanics/', mechanic_list_view, name='mechanics-payroll-list'),
    path('api/mechanics/<int:pk>/', mechanic_detail_view, name='mechanics-payroll-detail'),
    path('api/analytics/summary/', PayrollAnalyticsSummaryView.as_view(), name='analytics-payroll-summary'),
    path('api/search-parts/', VesnaPartSearchView.as_view(), name='search-parts'),
    path('api/parts/search/', VesnaPartSearchView.as_view(), name='parts-search-alt'),
    path('api/part-search/', VesnaPartSearchView.as_view(), name='part-search-alt'),
    path('api/landing-growth/', include('apps.landing_growth.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/push/', include('apps.push_notifications.urls')),
    *core_urlpatterns,
    path('api/agent/', include('apps.agent.urls')),
    path('api/agent/', include('apps.agent.routes_read')),
    path('api/agent/', include('apps.agent.routes_tg')),
    path('api/agent/', include('apps.agent.routes_catalog')),
    path('api/agent/', include('apps.agent.routes_actions')),
]
