from django.urls import path
from .tool_views import AgentDailyScheduleView, AgentVisitSearchView

urlpatterns = [
    path('visits/search/', AgentVisitSearchView.as_view()),
    path('schedule/', AgentDailyScheduleView.as_view()),
]
