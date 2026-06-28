from django.urls import path

from .part_views import AgentAnalogSearchView, AgentOriginalArticleSearchView, AgentSelectedAnalogSearchView

urlpatterns = [
    path('catalog/original-search/', AgentOriginalArticleSearchView.as_view()),
    path('catalog/analogs/', AgentAnalogSearchView.as_view()),
    path('catalog/selected-search/', AgentSelectedAnalogSearchView.as_view()),
]
