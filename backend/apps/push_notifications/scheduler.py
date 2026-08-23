import logging
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

from apps.core.models import CRMServiceReminder, CRMTask, VehicleRecommendation, Visit
from apps.core.serializers import _visit_finance

from .models import WebPushPreference, WebPushSubscription
from .service import get_user_push_preferences, get_vapid_keypair, send_scheduled_user_push


logger = logging.getLogger('vin_matrix.push')
User = get_user_model()
CLOSED_VISIT_STATUSES = {'DONE', 'COMPLETED', 'CANCELLED'}


def _company_for_user(user):
    try:
        return user.company
    except ObjectDoesNotExist:
        pass
    try:
        return user.employee_profile.company
    except ObjectDoesNotExist:
        return None


def _parse_hhmm(value):
    try:
        return datetime.strptime(str(value), '%H:%M').time()
    except (TypeError, ValueError):
        return None


def _minutes_of_day(value):
    return value.hour * 60 + value.minute


def _slot_is_due(local_now, value, window_minutes=10):
    target = _parse_hhmm(value)
    if not target:
        return False
    now_minutes = _minutes_of_day(local_now.time())
    target_minutes = _minutes_of_day(target)
    return 0 <= now_minutes - target_minutes < window_minutes


def _quiet_now(preference, local_now):
    if not preference.quiet_hours_enabled:
        return False
    start = preference.quiet_hours_start
    end = preference.quiet_hours_end
    current = local_now.time().replace(second=0, microsecond=0)
    if start == end:
        return False
    if start < end:
        return start <= current < end
    return current >= start or current < end


def _format_time(value):
    return timezone.localtime(value).strftime('%H:%M') if value else '—'


def _format_money(value):
    return f'{float(value or 0):,.2f}'.replace(',', ' ') + ' ₴'


def _client_search_url(phone='', client='', plate=''):
    query = str(phone or client or plate or '').strip()
    if not query:
        return '/crm'
    from urllib.parse import quote
    return f'/crm?search={quote(query)}&autopen=1'


def _process_visit_reminders(user, company, preference, now, local_now):
    # Appointment reminders are time-critical: if a car is due in one hour,
    # delaying the push until quiet hours end makes the reminder useless.
    if not preference.visit_reminders:
        return 0

    minutes = max(5, min(int(preference.visit_reminder_minutes or 60), 24 * 60))
    target = now + timedelta(minutes=minutes)
    window = timedelta(minutes=5)
    visits = (
        Visit.objects.filter(
            company=company,
            scheduled_datetime__gte=target - window,
            scheduled_datetime__lt=target + window,
        )
        .exclude(status__in=CLOSED_VISIT_STATUSES)
        .order_by('scheduled_datetime', 'id')
    )

    sent = 0
    for visit in visits:
        event_key = f'visit-reminder:{visit.id}:{visit.scheduled_datetime.isoformat()}:{minutes}'
        vehicle = visit.plate or f'Візит №{visit.id}'
        result = send_scheduled_user_push(user, event_key, {
            'title': f'🚗 Запис через {minutes // 60} год.' if minutes % 60 == 0 else f'🚗 Запис через {minutes} хв.',
            'body': f'{vehicle} · {visit.client or "Клієнт"} · {_format_time(visit.scheduled_datetime)}',
            'url': f'/visits?visit_id={visit.id}&open=board',
            'tag': f'visit-reminder-{visit.id}',
        }, 'visit_reminders')
        sent += int(result.get('delivered', 0) > 0)
    return sent


def _company_debt_summary(company):
    count = 0
    amount = 0.0
    visits = (
        Visit.objects.filter(company=company)
        .exclude(status='CANCELLED')
        .prefetch_related('parts', 'services')
        .order_by('-created_at')[:700]
    )
    for visit in visits:
        try:
            finance = _visit_finance(visit)
            debt = float(finance.get('debt_amount') or 0)
        except Exception:
            debt = 0.0
        if debt <= 0:
            continue
        count += 1
        amount += debt
    return count, round(amount, 2)


def _process_debts(user, company, preference, local_now):
    if not preference.payments or _quiet_now(preference, local_now):
        return 0
    if preference.debt_schedule_days == WebPushPreference.DEBT_DAYS_WEEKDAYS and local_now.weekday() >= 5:
        return 0

    sent = 0
    for slot in list(preference.debt_notification_times or []):
        if not _slot_is_due(local_now, slot):
            continue
        count, amount = _company_debt_summary(company)
        if count <= 0 or amount <= 0:
            continue
        event_key = f'debts:{local_now.date().isoformat()}:{slot}'
        result = send_scheduled_user_push(user, event_key, {
            'title': '💳 Є незакриті борги',
            'body': f'{count} клієнт(ів) · загальна сума {_format_money(amount)}',
            'url': '/clients?filter=debt',
            'tag': f'debts-{local_now.date().isoformat()}-{str(slot).replace(":", "")}',
        }, 'payments')
        sent += int(result.get('delivered', 0) > 0)
    return sent


def _crm_due_date(preference, local_now):
    raw_days = preference.crm_reminder_days_before
    days = max(0, min(int(1 if raw_days is None else raw_days), 30))
    return local_now.date() + timedelta(days=days)


def _process_crm_due(user, company, preference, local_now):
    if not preference.crm or _quiet_now(preference, local_now):
        return 0
    if not _slot_is_due(local_now, preference.crm_notification_time.strftime('%H:%M')):
        return 0

    due_date = _crm_due_date(preference, local_now)
    sent = 0

    tasks = CRMTask.objects.filter(company=company, due_date=due_date).exclude(status=CRMTask.STATUS_DONE).order_by('id')
    for task in tasks:
        event_key = f'crm-task:{task.id}:{due_date.isoformat()}'
        result = send_scheduled_user_push(user, event_key, {
            'title': '📋 Завтра задача по клієнту' if preference.crm_reminder_days_before == 1 else '📋 Наближається задача по клієнту',
            'body': f'{task.title} · {task.client or task.plate or task.phone or "Клієнт"}',
            'url': _client_search_url(task.phone, task.client, task.plate),
            'tag': f'crm-task-{task.id}',
        }, 'crm')
        sent += int(result.get('delivered', 0) > 0)

    recommendations = VehicleRecommendation.objects.filter(
        company=company,
        due_date=due_date,
        status=VehicleRecommendation.STATUS_ACTIVE,
    ).order_by('id')
    for rec in recommendations:
        event_key = f'recommendation:{rec.id}:{due_date.isoformat()}'
        result = send_scheduled_user_push(user, event_key, {
            'title': '🔧 Завтра сервісна рекомендація' if preference.crm_reminder_days_before == 1 else '🔧 Наближається сервісна рекомендація',
            'body': f'{rec.title} · {rec.client or rec.plate or rec.phone or "Клієнт"}',
            'url': _client_search_url(rec.phone, rec.client, rec.plate),
            'tag': f'recommendation-{rec.id}',
        }, 'crm')
        sent += int(result.get('delivered', 0) > 0)

    reminders = CRMServiceReminder.objects.filter(
        company=company,
        due_date=due_date,
        status=CRMServiceReminder.STATUS_ACTIVE,
    ).order_by('id')
    for reminder in reminders:
        title = reminder.title or reminder.get_reminder_type_display()
        event_key = f'service-reminder:{reminder.id}:{due_date.isoformat()}'
        result = send_scheduled_user_push(user, event_key, {
            'title': '🔔 Завтра нагадати клієнту' if preference.crm_reminder_days_before == 1 else '🔔 Сервісне нагадування',
            'body': f'{title} · {reminder.client or reminder.plate or reminder.phone or "Клієнт"}',
            'url': _client_search_url(reminder.phone, reminder.client, reminder.plate),
            'tag': f'service-reminder-{reminder.id}',
        }, 'crm')
        sent += int(result.get('delivered', 0) > 0)

    return sent


def process_scheduled_pushes(now=None):
    """Process all time-based push rules. Safe to call repeatedly; dispatch logs prevent duplicates."""
    now = now or timezone.now()
    local_now = timezone.localtime(now)

    # Heartbeat lets the UI distinguish a valid browser subscription from a
    # running scheduler that is actually processing time-based rules.
    vapid = get_vapid_keypair()
    vapid.scheduler_heartbeat_at = now
    vapid.save(update_fields=['scheduler_heartbeat_at'])

    active_user_ids = WebPushSubscription.objects.filter(is_active=True).values_list('user_id', flat=True).distinct()
    users = User.objects.filter(id__in=active_user_ids, is_active=True).order_by('id')

    stats = {'users': 0, 'visit_reminders': 0, 'debts': 0, 'crm': 0}
    for user in users:
        company = _company_for_user(user)
        if not company:
            continue
        preference = get_user_push_preferences(user)
        stats['users'] += 1
        stats['visit_reminders'] += _process_visit_reminders(user, company, preference, now, local_now)
        stats['debts'] += _process_debts(user, company, preference, local_now)
        stats['crm'] += _process_crm_due(user, company, preference, local_now)

    logger.info(
        'scheduled_push_tick users=%s visits=%s debts=%s crm=%s',
        stats['users'], stats['visit_reminders'], stats['debts'], stats['crm'],
    )
    return stats
