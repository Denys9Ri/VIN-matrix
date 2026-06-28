from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_company_or_raise, write_audit
from .tools.visits import daily_schedule, find_visits


class AgentVisitSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = str(request.data.get('query') or '').strip()
        if not query:
            return Response(
                {'detail': 'Передайте query для пошуку.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = find_visits(
            request.user,
            query=query,
            limit=request.data.get('limit', 5),
        )
        company = get_company_or_raise(request.user)
        write_audit(
            company=company,
            user=request.user,
            request_text=query,
            recognized_intent='find_visit',
            tool_name='find_visits',
            tool_input={'query': query},
            tool_result={'count': len(results)},
        )
        return Response({'count': len(results), 'results': results})


class AgentDailyScheduleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_date = str(request.query_params.get('date') or '').strip()
        target_date = parse_date(raw_date) if raw_date else None
        if raw_date and target_date is None:
            return Response(
                {'detail': 'date має бути у форматі YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = daily_schedule(request.user, target_date=target_date)
        company = get_company_or_raise(request.user)
        write_audit(
            company=company,
            user=request.user,
            recognized_intent='daily_schedule',
            tool_name='daily_schedule',
            tool_input={'date': result['date']},
            tool_result={'count': result['count']},
        )
        return Response(result)
