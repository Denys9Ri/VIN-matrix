from django.urls import path

from .audit_views import AgentAuditLogListView
from .telegram_connection_views import AgentConnectionCodeView
from .views import (
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
    path('audit-log/', AgentAuditLogListView.as_view(), name='agent-audit-log'),
    path('pending-actions/', AgentPendingActionListView.as_view(), name='agent-pending-actions'),
    path(
        'pending-actions/<int:action_id>/decision/',
        AgentPendingActionDecisionView.as_view(),
        name='agent-pending-action-decision',
    ),
]
