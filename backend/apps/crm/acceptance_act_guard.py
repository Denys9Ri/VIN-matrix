from django.db import connection
from rest_framework import status
from rest_framework.response import Response

from apps.core.visit_workflow_views import (
    VisitAcceptanceActView,
    ensure_visit_workflow_tables,
    get_visit_for_user,
    row_to_dict,
)


class ImmutableVisitAcceptanceActView(VisitAcceptanceActView):
    """Freeze an acceptance act once it has been marked completed.

    The act is evidence of the vehicle state at intake. Returning the original
    completed row prevents a direct API call from reverting it to draft and
    subsequently deleting or replacing its attached photos.
    """

    def post(self, request):
        ensure_visit_workflow_tables()
        visit, company = get_visit_for_user(request.user, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT * FROM core_visitacceptanceact WHERE company_id = %s AND visit_id = %s LIMIT 1',
                [company.id, visit.id],
            )
            existing = row_to_dict(cursor, cursor.fetchone())

        if existing and str(existing.get('status') or '').lower() == 'completed':
            existing['locked'] = True
            return Response(existing, status=status.HTTP_200_OK)

        return super().post(request)
