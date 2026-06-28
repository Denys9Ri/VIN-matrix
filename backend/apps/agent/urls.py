from django.urls import path

from .views import (
    AgentConnectionCodeView,
    AgentMemberAccessListView,
    AgentPendingActionDecisionView,
    AgentPendingActionListView,
    AgentSettingsView,
    AgentStatusView,
)

urlpatterns = [
    path('status/', AgentStatusView.as_view(), name='agent-status'),
    path('settings/', AgentSettingsView.as_view(), name='agent-settings'),
    path('member-access/', AgentMemberAccessListView.as_view(), name='agent-member-access'),
    path('connect-code/', AgentConnectionCodeView.as_view(), name='agent-connect-code'),
    path('pending-actions/', AgentPendingActionListView.as_view(), name='agent-pending-actions'),
    path(
        'pending-actions/<int:action_id>/decision/',
        AgentPendingActionDecisionView.as_view(),
        name='agent-pending-action-decision',
    ),
]
