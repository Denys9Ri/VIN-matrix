from django.urls import path

from .part_views import (
    AgentAnalogSearchView,
    AgentOriginalArticleSearchView,
    AgentSelectedAnalogSearchView,
)

urlpatterns = [
    path('parts/original-search/', AgentOriginalArticleSearchView.as_view()),
    path('parts/analogs/', AgentAnalogSearchView.as_view()),
    path('parts/selected-analog-search/', AgentSelectedAnalogSearchView.as_view()),
]
