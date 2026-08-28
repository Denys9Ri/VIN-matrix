from datetime import date, datetime

from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access_control import CompanyOwnerOrPlatformAdmin, is_company_owner_or_platform_admin
from apps.core.visit_workflow_views import (
    VisitAcceptanceActView,
    ensure_visit_workflow_tables,
    get_visit_for_user,
    row_to_dict,
)
from .models import VisitAcceptanceActRevision, VisitAcceptancePhoto


def _read_act(company_id, visit_id):
    ensure_visit_workflow_tables()
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT * FROM core_visitacceptanceact WHERE company_id = %s AND visit_id = %s LIMIT 1',
            [company_id, visit_id],
        )
        return row_to_dict(cursor, cursor.fetchone())


def _json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _decorate_act(data, user, company_id=None, visit_id=None):
    if not isinstance(data, dict):
        return data
    company_id = company_id or data.get('company_id')
    visit_id = visit_id or data.get('visit_id')
    completed = str(data.get('status') or '').lower() == 'completed'
    data['locked'] = completed
    data['can_correct'] = bool(completed and is_company_owner_or_platform_admin(user))
    if company_id and visit_id:
        data['revision_count'] = VisitAcceptanceActRevision.objects.filter(
            company_id=company_id,
            visit_id=visit_id,
        ).count()
    else:
        data['revision_count'] = 0
    return data


def _lock_visit_photos(company_id, visit_id, user):
    return VisitAcceptancePhoto.objects.filter(
        company_id=company_id,
        visit_id=visit_id,
        locked_at__isnull=True,
    ).update(locked_at=timezone.now(), locked_by=user)


class ImmutableVisitAcceptanceActView(VisitAcceptanceActView):
    """Freeze completed evidence, while allowing an audited owner correction.

    A completed act itself is never silently overwritten. If the owner needs to
    correct a mistake, the dedicated correction endpoint stores a full immutable
    snapshot first, permanently locks all existing photos, and only then reopens
    the working copy as a draft.
    """

    def get(self, request):
        response = super().get(request)
        if isinstance(response.data, dict) and response.data:
            response.data = _decorate_act(response.data, request.user)
        return response

    def post(self, request):
        ensure_visit_workflow_tables()
        visit, company = get_visit_for_user(request.user, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        existing = _read_act(company.id, visit.id)
        if existing and str(existing.get('status') or '').lower() == 'completed':
            return Response(
                _decorate_act(existing, request.user, company.id, visit.id),
                status=status.HTTP_200_OK,
            )

        response = super().post(request)
        if isinstance(response.data, dict):
            if str(response.data.get('status') or '').lower() == 'completed':
                _lock_visit_photos(company.id, visit.id, request.user)
            response.data = _decorate_act(response.data, request.user, company.id, visit.id)
        return response


class ReopenVisitAcceptanceActView(APIView):
    """Owner-only correction flow that preserves the previous evidence version."""

    permission_classes = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]

    def post(self, request):
        visit, company = get_visit_for_user(request.user, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        reason = str(request.data.get('reason') or '').strip()
        if len(reason) < 3:
            return Response(
                {'detail': 'Вкажіть коротку причину коригування.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing = _read_act(company.id, visit.id)
            if not existing:
                return Response({'detail': 'Акт ще не створено.'}, status=status.HTTP_404_NOT_FOUND)
            if str(existing.get('status') or '').lower() != 'completed':
                return Response(
                    {'detail': 'Акт уже доступний для редагування.'},
                    status=status.HTTP_409_CONFLICT,
                )

            photos = list(
                VisitAcceptancePhoto.objects.filter(company=company, visit=visit)
                .order_by('created_at', 'id')
                .values('id', 'category', 'sha256', 'original_name', 'created_at', 'created_by_id')
            )
            snapshot = _json_safe(existing)
            snapshot['photos'] = _json_safe(photos)

            revision = VisitAcceptanceActRevision.objects.create(
                company=company,
                visit=visit,
                snapshot=snapshot,
                reason=reason,
                created_by=request.user,
            )

            _lock_visit_photos(company.id, visit.id, request.user)

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE core_visitacceptanceact
                    SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                    WHERE company_id = %s AND visit_id = %s
                    RETURNING *
                    """,
                    [company.id, visit.id],
                )
                reopened = row_to_dict(cursor, cursor.fetchone())

        reopened = _decorate_act(reopened or {}, request.user, company.id, visit.id)
        reopened['correction_revision_id'] = revision.id
        reopened['correction_reason'] = reason
        return Response(reopened, status=status.HTTP_200_OK)
