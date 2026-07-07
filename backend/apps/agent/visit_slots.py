from datetime import datetime, time, timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from apps.core.models import Employee, Visit, WorkPost
from .services import require_agent_member, write_audit
ACTIVE_EXCLUDED_STATUSES = {'CANCELLED', 'COMPLETED'}
ALLOWED_DURATIONS = {30, 60, 90, 120}
def get_default_duration(settings):
    try: value = int(getattr(settings, 'default_visit_duration_minutes', 60) or 60)
    except (TypeError, ValueError): value = 60
    return value if value in ALLOWED_DURATIONS else 60
def parse_slot_date(text):
    raw = str(text or '').strip().lower()
    tail = raw.replace('вільні вікна', '').replace('свободные окна', '').replace('слоти', '').strip()
    if not tail: return timezone.localdate()
    if tail in {'завтра', 'tomorrow'}: return timezone.localdate() + timedelta(days=1)
    if tail in {'сьогодні', 'сегодня', 'today'}: return timezone.localdate()
    try: return datetime.strptime(tail, '%Y-%m-%d').date()
    except ValueError: raise ValidationError('Вкажіть дату у форматі 2026-07-10 або напишіть «вільні вікна завтра».')
def _setting_time(value, fallback):
    return value if isinstance(value, time) else fallback

def get_slot_step_minutes(settings):
    try: value = int(getattr(settings, 'slot_step_minutes', 30) or 30)
    except (TypeError, ValueError): value = 30
    return value if value in {30, 60} else 30

def _day_bounds(target_date, settings):
    tz = timezone.get_current_timezone()
    start_time = _setting_time(getattr(settings, 'workday_start_time', None), time(9, 0))
    end_time = _setting_time(getattr(settings, 'workday_end_time', None), time(18, 0))
    if end_time <= start_time:
        start_time, end_time = time(9, 0), time(18, 0)
    return timezone.make_aware(datetime.combine(target_date, start_time), tz), timezone.make_aware(datetime.combine(target_date, end_time), tz)
def _overlap_filter(start, end, duration_minutes):
    return Q(scheduled_datetime__lt=end, scheduled_datetime__gt=start - timedelta(minutes=duration_minutes))
def _candidate_mechanics(company, user, access):
    qs = Employee.objects.filter(company=company, role='mechanic').select_related('user').order_by('user__first_name', 'user__username', 'id')
    if not access.can_view_all_visits: qs = qs.filter(user=user)
    return list(qs)
def _mechanic_name(user): return user.get_full_name() or user.username
def find_available_slots(user, target_date=None, limit=None):
    company, settings, access = require_agent_member(user)
    target_date = target_date or timezone.localdate(); duration = get_default_duration(settings)
    day_start, day_end = _day_bounds(target_date, settings); now = timezone.now(); step = get_slot_step_minutes(settings)
    posts = list(WorkPost.objects.filter(company=company, is_active=True).order_by('sort_order', 'number', 'id'))
    mechanics = _candidate_mechanics(company, user, access); slots=[]; current=day_start
    max_slots = int(limit) if limit is not None else None
    while current + timedelta(minutes=duration) <= day_end and (max_slots is None or len(slots) < max_slots):
        if current <= now: current += timedelta(minutes=step); continue
        end = current + timedelta(minutes=duration)
        busy = Visit.objects.filter(company=company).exclude(status__in=ACTIVE_EXCLUDED_STATUSES).filter(_overlap_filter(current, end, duration))
        busy_posts = set(busy.exclude(work_post__isnull=True).values_list('work_post_id', flat=True))
        busy_mechanics = set(busy.exclude(responsible_mechanic__isnull=True).values_list('responsible_mechanic_id', flat=True))
        free_posts = [p for p in posts if p.id not in busy_posts]
        free_mechanics = [m for m in mechanics if m.user_id not in busy_mechanics]
        if (not posts or free_posts) and (access.can_view_all_visits or free_mechanics):
            post = free_posts[0] if free_posts else None; mech = free_mechanics[0] if free_mechanics else None
            slots.append({'start': current, 'end': end, 'duration_minutes': duration, 'work_post_id': post.id if post else None, 'work_post': post.name if post else '', 'mechanic_id': mech.user_id if mech else (user.id if not access.can_view_all_visits else None), 'mechanic': _mechanic_name(mech.user) if mech else (_mechanic_name(user) if not access.can_view_all_visits else ''), 'available_posts': [{'id': p.id, 'name': p.name} for p in free_posts[:8]], 'available_mechanics': [{'id': m.user_id, 'name': _mechanic_name(m.user)} for m in free_mechanics[:8]]})
        current += timedelta(minutes=step)
    return {'date': target_date.isoformat(), 'duration_minutes': duration, 'slot_step_minutes': step, 'slots': slots}
def validate_slot_available(company, start, duration_minutes, work_post_id=None, mechanic_id=None):
    end = start + timedelta(minutes=duration_minutes)
    conflicts = Visit.objects.select_for_update().filter(company=company).exclude(status__in=ACTIVE_EXCLUDED_STATUSES).filter(_overlap_filter(start, end, duration_minutes))
    if work_post_id and conflicts.filter(work_post_id=work_post_id).exists(): raise ValidationError('Обраний пост уже зайнятий у цей час.')
    if mechanic_id and conflicts.filter(responsible_mechanic_id=mechanic_id).exists(): raise ValidationError('Обраний майстер уже зайнятий у цей час.')
    if not work_post_id and not mechanic_id and conflicts.exists(): raise ValidationError('Цей час уже зайняли.')
    return True
def create_visit_now(user, *, client, plate, phone, scheduled_datetime, comment='', work_post_id=None, mechanic_id=None, conversation=None):
    company, settings, access = require_agent_member(user)
    if not access.can_create_visits: raise PermissionDenied('У вас немає права створювати записи через Agent.')
    duration = get_default_duration(settings); start = scheduled_datetime if hasattr(scheduled_datetime, 'tzinfo') else datetime.fromisoformat(str(scheduled_datetime))
    if timezone.is_naive(start): start = timezone.make_aware(start, timezone.get_current_timezone())
    if not access.can_view_all_visits: mechanic_id = user.id
    with transaction.atomic():
        validate_slot_available(company, start, duration, work_post_id=work_post_id, mechanic_id=mechanic_id)
        visit = Visit.objects.create(company=company, client=str(client or '').strip()[:100], plate=str(plate or 'НЕ ВКАЗАНО').strip()[:20], phone=str(phone or '').strip()[:20], scheduled_datetime=start, comment=str(comment or '').strip()[:2000], work_post_id=work_post_id or None, responsible_mechanic_id=mechanic_id or None)
    write_audit(company=company, user=user, conversation=conversation, recognized_intent='telegram_visit_created', tool_name='telegram_create_visit', tool_input={'scheduled_datetime': start.isoformat(), 'work_post_id': work_post_id, 'mechanic_id': mechanic_id}, tool_result={'visit_id': visit.id})
    return visit
