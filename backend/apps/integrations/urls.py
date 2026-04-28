from django.urls import path
from .views import UnifiedSearchView

urlpatterns = [
    path('search/', UnifiedSearchView.as_view(), name='unified_search'),
]
