from datetime import timedelta

from django.utils import timezone

TRIAL_DAYS = 14
PAID_DAYS = 30
WARNING_DAYS = 5

PAYMENT_TRIAL = 'trial'
PAYMENT_ACTIVE = 'active'
PAYMENT_PENDING = 'pending'
PAYMENT_INACTIVE = 'inactive'


def _now():
    return timezone.now()


def _date_str(value):
    if not value:
        return None
    return timezone.localtime(value).strftime('%d.%m.%Y')


def _ceil_days_until(value):
    if not value:
        return None
    seconds = (value - _now()).total_seconds()
    return max(0, int((seconds + 86399) // 86400))


def get_subscription_end(client):
    if not client:
        return None
    if client.payment_status == PAYMENT_TRIAL:
        return client.trial_until
    if client.payment_status == PAYMENT_ACTIVE:
        return client.subscription_until
    return client.subscription_until or client.trial_until


def sync_client_subscription(client, save=True):
    if not client:
        return None

    changed = False
    now = _now()

    if client.payment_status == PAYMENT_TRIAL:
        if not client.trial_started_at:
            client.trial_started_at = client.created_at or now
            changed = True
        if not client.trial_until:
            client.trial_until = (client.trial_started_at or now) + timedelta(days=TRIAL_DAYS)
            changed = True
        if client.trial_until and client.trial_until <= now:
            client.is_access_enabled = False
            client.payment_status = PAYMENT_INACTIVE
            changed = True
        elif not client.is_access_enabled:
            client.is_access_enabled = True
            changed = True

    elif client.payment_status == PAYMENT_ACTIVE:
        if not client.subscription_started_at:
            client.subscription_started_at = now
            changed = True
        if not client.subscription_until:
            client.subscription_until = now + timedelta(days=PAID_DAYS)
            changed = True
        if client.subscription_until and client.subscription_until <= now:
            client.is_access_enabled = False
            client.payment_status = PAYMENT_INACTIVE
            changed = True
        elif not client.is_access_enabled:
            client.is_access_enabled = True
            changed = True

    else:
        if client.is_access_enabled:
            client.is_access_enabled = False
            changed = True

    if changed and save:
        client.save(update_fields=[
            'trial_started_at', 'trial_until', 'subscription_started_at', 'subscription_until',
            'payment_status', 'is_access_enabled'
        ])
    return client


def activate_trial(client):
    now = _now()
    client.trial_started_at = now
    client.trial_until = now + timedelta(days=TRIAL_DAYS)
    client.subscription_started_at = None
    client.subscription_until = None
    client.payment_status = PAYMENT_TRIAL
    client.is_access_enabled = True
    client.save(update_fields=[
        'trial_started_at', 'trial_until', 'subscription_started_at', 'subscription_until',
        'payment_status', 'is_access_enabled'
    ])
    return client


def renew_client_30_days(client):
    sync_client_subscription(client)
    now = _now()
    base = client.subscription_until if client.subscription_until and client.subscription_until > now and client.payment_status == PAYMENT_ACTIVE else now
    client.subscription_started_at = now
    client.subscription_until = base + timedelta(days=PAID_DAYS)
    client.payment_status = PAYMENT_ACTIVE
    client.is_access_enabled = True
    client.save(update_fields=['subscription_started_at', 'subscription_until', 'payment_status', 'is_access_enabled'])
    return client


def subscription_payload(client):
    sync_client_subscription(client)
    end = get_subscription_end(client)
    days_left = _ceil_days_until(end)
    warning = bool(client.is_access_enabled and days_left is not None and days_left <= WARNING_DAYS)
    expired = bool(not client.is_access_enabled and client.payment_status == PAYMENT_INACTIVE)

    if client.payment_status == PAYMENT_TRIAL:
        label = 'Пробний період'
    elif client.payment_status == PAYMENT_ACTIVE:
        label = 'Активний'
    elif expired:
        label = 'Немає доступу'
    else:
        label = 'Очікує оплату'

    return {
        'subscription_end': end,
        'subscription_end_display': _date_str(end),
        'days_until_subscription_end': days_left,
        'subscription_warning': warning,
        'subscription_expired': expired,
        'subscription_label': label,
    }


def sync_queryset_subscriptions(queryset):
    for client in queryset:
        sync_client_subscription(client)
    return queryset


def get_alert_clients(queryset):
    expiring = []
    expired = []
    for client in queryset.select_related('user', 'assigned_owner'):
        sync_client_subscription(client)
        payload = subscription_payload(client)
        item = {
            'id': client.id,
            'client_code': client.client_code,
            'client_code_display': f'C{client.client_code}',
            'full_name': client.user.first_name or client.user.username,
            'username': client.user.username,
            'phone': client.phone,
            'subscription_end_display': payload['subscription_end_display'],
            'days_until_subscription_end': payload['days_until_subscription_end'],
            'payment_status': client.payment_status,
            'is_access_enabled': client.is_access_enabled,
        }
        if payload['subscription_warning']:
            expiring.append(item)
        if payload['subscription_expired']:
            expired.append(item)
    return {'expiring_soon': expiring, 'expired': expired, 'expiring_count': len(expiring), 'expired_count': len(expired)}
