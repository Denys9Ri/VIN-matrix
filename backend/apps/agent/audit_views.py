from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentAuditLog
from .services import is_company_owner, require_agent_member


class AgentAuditLogListView(APIView):
    """Returns recent Agent activity without widening tenant or staff visibility."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company, _, _ = require_agent_member(request.user)
        is_owner = is_company_owner(request.user, company)

        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 100))

        logs = AgentAuditLog.objects.filter(company=company).select_related('user')
        if not is_owner:
            logs = logs.filter(user=request.user)

        items = []
        for entry in logs.order_by('-created_at', '-id')[:limit]:
            actor = entry.user
            items.append({
                'id': entry.id,
                'actor': actor.get_full_name() or actor.username if actor else 'Система',
                'recognized_intent': entry.recognized_intent,
                'tool_name': entry.tool_name,
                'request_text': entry.request_text,
                'success': entry.success,
                'error_message': entry.error_message,
                'created_at': entry.created_at,
            })

        return Response({
            'scope': 'company' if is_owner else 'personal',
            'items': items,
        })
