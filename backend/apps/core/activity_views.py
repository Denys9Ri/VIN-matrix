from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import activity_query
from .safe_crm_views import safe_ensure_company


class ActivityLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'results': []})
        limit = request.query_params.get('limit') or 80
        try:
            limit = min(max(int(limit), 1), 200)
        except Exception:
            limit = 80
        results = activity_query(
            company=company,
            visit_id=request.query_params.get('visit') or None,
            phone=request.query_params.get('client_phone') or request.query_params.get('phone') or None,
            mode=request.query_params.get('mode') or None,
            action_type=request.query_params.get('type') or request.query_params.get('action_type') or None,
            limit=limit,
        )
        return Response({'results': results})
