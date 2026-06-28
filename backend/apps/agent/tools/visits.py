from datetime import date

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.models import Visit

from ..services import require_agent_member


MAX_RESULTS = 20


def _scope_visits(company, user, access):
    queryset = Visit.objects.filter(company=company).select_related(
        'work_post',
        'responsible_mechanic',
    )
    if not access.can_view_all_visits:
        queryset = queryset.filter(responsible_mechanic=user)
    return queryset


def _serialize_visit(visit, access):
    return {
        'id': visit.id,
        'plate': visit.plate,
        'vin_code': visit.vin_code or '',
        'client': visit.client,
        'phone': visit.phone if access.can_view_client_phone else '',
        'status': visit.status,
        'scheduled_datetime': visit.scheduled_datetime,
        'work_post': visit.work_post.name if visit.work_post else '',
        'responsible_mechanic': (
            visit.responsible_mechanic.get_full_name()
            or visit.responsible_mechanic.username
            if visit.responsible_mechanic
            else ''
        ),
        'comment': visit.comment or '',
    }


def get_visit(user, visit_id):
    company, _, access = require_agent_member(user)
    try:
        visit_id = int(visit_id)
    except (TypeError, ValueError):
        raise ValidationError('Некоректний номер запису.')

    try:
        visit = _scope_visits(company, user, access).get(id=visit_id)
    except Visit.DoesNotExist:
        raise ValidationError('Запис не знайдено або у вас немає до нього доступу.')
    return _serialize_visit(visit, access)


def find_visits(user, query, limit=5):
    company, _, access = require_agent_member(user)
    query = str(query or '').strip()
    if not query:
        return []

    try:
        limit = max(1, min(int(limit), MAX_RESULTS))
    except (TypeError, ValueError):
        limit = 5

    search_filter = (
        Q(plate__icontains=query)
        | Q(vin_code__icontains=query)
        | Q(client__icontains=query)
    )
    if access.can_view_client_phone:
        search_filter |= Q(phone__icontains=query)

    visits = (
        _scope_visits(company, user, access)
        .filter(search_filter)
        .order_by('-scheduled_datetime', '-created_at')[:limit]
    )
    return [_serialize_visit(visit, access) for visit in visits]


def daily_schedule(user, target_date=None):
    company, _, access = require_agent_member(user)
    if target_date is None:
        target_date = timezone.localdate()
    if not isinstance(target_date, date):
        raise ValueError('target_date must be a date instance.')

    visits = (
        _scope_visits(company, user, access)
        .filter(scheduled_datetime__date=target_date)
        .order_by('scheduled_datetime', 'id')
    )
    return {
        'date': target_date.isoformat(),
        'count': visits.count(),
        'visits': [_serialize_visit(visit, access) for visit in visits],
    }
