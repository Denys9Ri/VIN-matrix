from django.urls import path

from .views import AgentStatusView

urlpatterns = [
    path('status/', AgentStatusView.as_view(), name='agent-status'),
]
