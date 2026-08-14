from datetime import datetime, time as dt_time

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .activity import log_activity
from .models import CompanyOption, Visit


# ORDERED is the current system key for the "В роботі" column. IN_PROGRESS is
# kept for visits created before the configurable status dictionary was added.
LEGACY_IN_PROGRESS_STATUSES = {'ORDERED', 'IN_PROGRESS'}


def in_progress_visit_statuses(company):
    """Return every active status that represents an STO visit in progress."""
    configured = CompanyOption.objects.filter(
        company=company,
        group=CompanyOption.GROUP_STO_VISIT_STATUS,
        semantic_role='in_progress',
        is_active=True,
    ).values_list('key', flat=True)
    return LEGACY_IN_PROGRESS_STATUSES.union(configured)


def _move_datetime_to_date(value, target_date):
    """Move a datetime to target_date while preserving its local clock time."""
    current_timezone = timezone.get_current_timezone()
    if timezone.is_naive(value):
        value = timezone.make_aware(value, current_timezone)
    local_value = timezone.localtime(value, current_timezone)
    local_time = local_value.time().replace(tzinfo=None)
    return timezone.make_aware(datetime.combine(target_date, local_time), current_timezone)


def rollover_in_progress_visits(company, target_date=None):
    """
    Carry unfinished STO visits from earlier days onto target_date.

    The function is intentionally company-scoped and idempotent so it is safe
    to call whenever today's board is opened, including from several workers.
    """
    if not company or getattr(company, 'business_type', '') == CompanyOption.MODE_STORE:
        return 0

    target_date = target_date or timezone.localdate()
    target_start = timezone.make_aware(
        datetime.combine(target_date, dt_time.min),
        timezone.get_current_timezone(),
    )
    status_keys = in_progress_visit_statuses(company)
    now = timezone.now()
    changes = []

    with transaction.atomic():
        visits = list(
            Visit.objects.select_for_update()
            .filter(company=company, status__in=status_keys)
            .filter(
                Q(scheduled_datetime__lt=target_start)
                | Q(scheduled_datetime__isnull=True, created_at__lt=target_start)
            )
            .only('id', 'status', 'scheduled_datetime', 'created_at', 'client', 'phone', 'plate')
        )

        for visit in visits:
            previous_datetime = visit.scheduled_datetime
            time_source = previous_datetime or visit.created_at
            visit.scheduled_datetime = _move_datetime_to_date(time_source, target_date)
            visit.updated_at = now
            changes.append((visit, previous_datetime))

        if visits:
            Visit.objects.bulk_update(visits, ['scheduled_datetime', 'updated_at'])

    for visit, previous_datetime in changes:
        log_activity(
            company=company,
            visit=visit,
            action_type='visit_auto_carried_over',
            title='Автоматично перенесено візит',
            description=(
                f'Незавершений візит №{visit.id} зі статусом «В роботі» '
                f'перенесено на {target_date:%d.%m.%Y}.'
            ),
            old_value=previous_datetime,
            new_value=visit.scheduled_datetime,
            metadata={'reason': 'in_progress_day_rollover', 'status': visit.status},
        )

    return len(changes)
