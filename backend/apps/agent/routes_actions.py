from django.urls import path

from .action_views import AgentAddPartDraftView, AgentExecuteActionView

urlpatterns = [
    path('actions/add-part-draft/', AgentAddPartDraftView.as_view()),
    path('actions/<int:action_id>/execute/', AgentExecuteActionView.as_view()),
]
