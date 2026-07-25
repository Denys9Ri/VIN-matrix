from django.urls import path

from .views import LandingGrowthConfigView, LandingGrowthEventView, LandingGrowthStatusView


urlpatterns = [
    path('config/', LandingGrowthConfigView.as_view(), name='landing-growth-config'),
    path('events/', LandingGrowthEventView.as_view(), name='landing-growth-events'),
    path('status/', LandingGrowthStatusView.as_view(), name='landing-growth-status'),
]
