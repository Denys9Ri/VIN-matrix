from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

TRIAL_DAYS = 14
PAID_DAYS = 30
NOTICE_DAYS = 3
GRACE_DAYS = 3
MONTHLY_PRICE = Decimal('2000.00')
CURRENCY = 'UAH'
PLAN_CODE = 'vin_matrix_full'
PLAN_NAME = 'VIN-matrix Full'

PAYMENT_TRIAL = 'trial'
PAYMENT_ACTIVE = 'active'
PAYMENT_PENDING = 'pending'
PAYMENT_INACTIVE = 'inactive'

BILLING_TRIAL = 'trial'
BILLING_ACTIVE = 'active'
BILLING_DUE_SOON = 'payment_due_soon'
BILLING_GRACE = 'grace'
BILLING_BLOCKED = 'blocked'
BILLING_MANUAL_FREE = 'manual_free'


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
    if seconds <= 0:
        return 0
    return int((seconds + 86399) // 86400)


def _days_overdue(value):
    if not value:
        return 0
    seconds = (_now() - value).total_seconds()
    if seconds <= 0:
        return 0
    return int(seconds // 86400) + 1


def _safe_set(client, field, value, changed_fields):
    if hasattr(client, field) and getattr(client, field, None) != value:
        setattr(client, field, value)
        changed_fields.add(field)


def get_subscription_end(client):
    if not client:
        return None
    if getattr(client, 'billing_status', None) == BILLING_MANUAL_FREE:
        return None
    if getattr(client, 'payment_status', None) == PAYMENT_TRIAL:
        return getattr(client, 'trial_until', None)
    if getattr(client, 'payment_status', None) == PAYMENT_ACTIVE:
        return getattr(client, 'subscription_until', None)
    return getattr(client, 'subscription_until', None) or getattr(client, 'trial_until', None)


def sync_client_subscription(client, save=True):
    if not client:
        return None

    now = _now()
    changed_fields = set()
    payment_status = getattr(client, 'payment_status', PAYMENT_TRIAL)

    if not getattr(client, 'subscription_price', None):
        _safe_set(client, 'subscription_price', MONTHLY_PRICE, changed_fields)

    if getattr(client, 'billing_status', None) == BILLING_MANUAL_FREE:
        _safe_set(client, 'is_access_enabled', True, changed_fields)
        _safe_set(client, 'payment_status', PAYMENT_ACTIVE, changed_fields)
        _safe_set(client, 'blocked_at', None, changed_fields)
        _safe_set(client, 'blocked_reason', None, changed_fields)
    elif payment_status == PAYMENT_TRIAL:
        if not getattr(client, 'trial_started_at', None):
            _safe_set(client, 'trial_started_at', getattr(client, 'created_at', None) or now, changed_fields)
        if not getattr(client, 'trial_until', None):
            _safe_set(client, 'trial_until', (getattr(client, 'trial_started_at', None) or now) + timedelta(days=TRIAL_DAYS), changed_fields)

        end = getattr(client, 'trial_until', None)
        if end and end <= now:
            grace_until = end + timedelta(days=GRACE_DAYS)
            _safe_set(client, 'grace_until', grace_until, changed_fields)
            if grace_until > now:
                _safe_set(client, 'billing_status', BILLING_GRACE, changed_fields)
                _safe_set(client, 'is_access_enabled', True, changed_fields)
                _safe_set(client, 'payment_status', PAYMENT_PENDING, changed_fields)
            else:
                _safe_set(client, 'billing_status', BILLING_BLOCKED, changed_fields)
                _safe_set(client, 'is_access_enabled', False, changed_fields)
                _safe_set(client, 'payment_status', PAYMENT_INACTIVE, changed_fields)
                _safe_set(client, 'blocked_at', getattr(client, 'blocked_at', None) or now, changed_fields)
                _safe_set(client, 'blocked_reason', 'Закінчився тестовий період і 3 дні мʼякого доступу.', changed_fields)
        else:
            days_left = _ceil_days_until(end)
            _safe_set(client, 'payment_notice_from', end - timedelta(days=NOTICE_DAYS) if end else None, changed_fields)
            _safe_set(client, 'billing_status', BILLING_DUE_SOON if days_left is not None and days_left <= NOTICE_DAYS else BILLING_TRIAL, changed_fields)
            _safe_set(client, 'is_access_enabled', True, changed_fields)
            _safe_set(client, 'blocked_at', None, changed_fields)
            _safe_set(client, 'blocked_reason', None, changed_fields)

    elif payment_status == PAYMENT_ACTIVE:
        if not getattr(client, 'subscription_started_at', None):
            _safe_set(client, 'subscription_started_at', now, changed_fields)
        if not getattr(client, 'subscription_until', None):
            _safe_set(client, 'subscription_until', now + timedelta(days=PAID_DAYS), changed_fields)

        end = getattr(client, 'subscription_until', None)
        if end and end <= now:
            grace_until = getattr(client, 'grace_until', None) or (end + timedelta(days=GRACE_DAYS))
            _safe_set(client, 'grace_until', grace_until, changed_fields)
            if grace_until > now:
                _safe_set(client, 'billing_status', BILLING_GRACE, changed_fields)
                _safe_set(client, 'is_access_enabled', True, changed_fields)
                _safe_set(client, 'payment_status', PAYMENT_PENDING, changed_fields)
            else:
                _safe_set(client, 'billing_status', BILLING_BLOCKED, changed_fields)
                _safe_set(client, 'is_access_enabled', False, changed_fields)
                _safe_set(client, 'payment_status', PAYMENT_INACTIVE, changed_fields)
                _safe_set(client, 'blocked_at', getattr(client, 'blocked_at', None) or now, changed_fields)
                _safe_set(client, 'blocked_reason', 'Оплата прострочена більше ніж на 3 дні.', changed_fields)
        else:
            days_left = _ceil_days_until(end)
            _safe_set(client, 'payment_notice_from', end - timedelta(days=NOTICE_DAYS) if end else None, changed_fields)
            _safe_set(client, 'grace_until', end + timedelta(days=GRACE_DAYS) if end else None, changed_fields)
            _safe_set(client, 'billing_status', BILLING_DUE_SOON if days_left is not None and days_left <= NOTICE_DAYS else BILLING_ACTIVE, changed_fields)
            _safe_set(client, 'is_access_enabled', True, changed_fields)
            _safe_set(client, 'blocked_at', None, changed_fields)
            _safe_set(client, 'blocked_reason', None, changed_fields)

    elif payment_status == PAYMENT_PENDING:
        end = getattr(client, 'subscription_until', None) or getattr(client, 'trial_until', None)
        grace_until = getattr(client, 'grace_until', None) or (end + timedelta(days=GRACE_DAYS) if end else now)
        _safe_set(client, 'grace_until', grace_until, changed_fields)
        if grace_until and grace_until > now:
            _safe_set(client, 'billing_status', BILLING_GRACE, changed_fields)
            _safe_set(client, 'is_access_enabled', True, changed_fields)
        else:
            _safe_set(client, 'billing_status', BILLING_BLOCKED, changed_fields)
            _safe_set(client, 'is_access_enabled', False, changed_fields)
            _safe_set(client, 'payment_status', PAYMENT_INACTIVE, changed_fields)
            _safe_set(client, 'blocked_at', getattr(client, 'blocked_at', None) or now, changed_fields)
            _safe_set(client, 'blocked_reason', 'Мʼякий період після дати оплати завершився.', changed_fields)

    else:
        _safe_set(client, 'billing_status', BILLING_BLOCKED, changed_fields)
        _safe_set(client, 'is_access_enabled', False, changed_fields)
        _safe_set(client, 'blocked_at', getattr(client, 'blocked_at', None) or now, changed_fields)
        _safe_set(client, 'blocked_reason', getattr(client, 'blocked_reason', None) or 'Доступ призупинено через несплату.', changed_fields)

    if changed_fields and save:
        changed_fields.add('payment_status')
        changed_fields.add('is_access_enabled')
        client.save(update_fields=list(changed_fields))
    return client


def activate_trial(client):
    now = _now()
    client.trial_started_at = now
    client.trial_until = now + timedelta(days=TRIAL_DAYS)
    client.subscription_started_at = None
    client.subscription_until = None
    client.grace_until = client.trial_until + timedelta(days=GRACE_DAYS) if hasattr(client, 'grace_until') else None
    client.payment_notice_from = client.trial_until - timedelta(days=NOTICE_DAYS) if hasattr(client, 'payment_notice_from') else None
    client.subscription_price = MONTHLY_PRICE if hasattr(client, 'subscription_price') else getattr(client, 'subscription_price', MONTHLY_PRICE)
    client.payment_status = PAYMENT_TRIAL
    client.billing_status = BILLING_TRIAL if hasattr(client, 'billing_status') else PAYMENT_TRIAL
    client.is_access_enabled = True
    if hasattr(client, 'blocked_at'):
        client.blocked_at = None
    if hasattr(client, 'blocked_reason'):
        client.blocked_reason = None
    client.save()
    return client


def renew_client_30_days(client, method='manual'):
    sync_client_subscription(client)
    now = _now()
    current_end = getattr(client, 'subscription_until', None)
    base = current_end if current_end and current_end > now else now
    client.subscription_started_at = now
    client.subscription_until = base + timedelta(days=PAID_DAYS)
    client.grace_until = client.subscription_until + timedelta(days=GRACE_DAYS) if hasattr(client, 'grace_until') else None
    client.payment_notice_from = client.subscription_until - timedelta(days=NOTICE_DAYS) if hasattr(client, 'payment_notice_from') else None
    client.payment_status = PAYMENT_ACTIVE
    client.billing_status = BILLING_ACTIVE if hasattr(client, 'billing_status') else PAYMENT_ACTIVE
    client.subscription_price = MONTHLY_PRICE if hasattr(client, 'subscription_price') else getattr(client, 'subscription_price', MONTHLY_PRICE)
    client.last_payment_at = now if hasattr(client, 'last_payment_at') else getattr(client, 'last_payment_at', None)
    client.last_payment_method = method if hasattr(client, 'last_payment_method') else getattr(client, 'last_payment_method', None)
    client.is_access_enabled = True
    if hasattr(client, 'blocked_at'):
        client.blocked_at = None
    if hasattr(client, 'blocked_reason'):
        client.blocked_reason = None
    client.save()
    return client


def get_billing_status(client):
    if not client:
        return {
            'access_allowed': True,
            'status': 'none',
            'billing_status': 'none',
            'plan_code': PLAN_CODE,
            'plan_name': PLAN_NAME,
            'price': float(MONTHLY_PRICE),
            'currency': CURRENCY,
        }

    sync_client_subscription(client)
    now = _now()
    end = get_subscription_end(client)
    grace_until = getattr(client, 'grace_until', None)
    status = getattr(client, 'billing_status', None) or getattr(client, 'payment_status', None)
    days_left = _ceil_days_until(end) if end else None
    grace_days_left = _ceil_days_until(grace_until) if grace_until and grace_until > now else 0
    overdue_days = _days_overdue(end) if end and end <= now else 0
    access_allowed = bool(getattr(client, 'is_access_enabled', True))

    labels = {
        BILLING_TRIAL: 'Тестовий період',
        BILLING_ACTIVE: 'Активний',
        BILLING_DUE_SOON: 'Оплата скоро',
        BILLING_GRACE: 'Мʼякий доступ',
        BILLING_BLOCKED: 'Доступ призупинено',
        BILLING_MANUAL_FREE: 'Безкоштовний доступ',
    }

    if status == BILLING_TRIAL:
        message = f'Тестовий період: залишилось {days_left} дн.' if days_left is not None else 'Тестовий період активний.'
    elif status == BILLING_DUE_SOON:
        message = f'Оплата {int(MONTHLY_PRICE)} грн/міс через {days_left} дн.' if days_left is not None else 'Потрібна оплата тарифу.'
    elif status == BILLING_GRACE:
        message = f'Оплата прострочена. Мʼякий доступ ще {grace_days_left} дн.'
    elif status == BILLING_BLOCKED:
        message = getattr(client, 'blocked_reason', None) or 'Доступ призупинено через несплату.'
    elif status == BILLING_MANUAL_FREE:
        message = 'Ручний безкоштовний доступ активний.'
    else:
        message = f'Активний до {_date_str(end)}.' if end else 'Доступ активний.'

    return {
        'access_allowed': access_allowed,
        'status': status,
        'billing_status': status,
        'payment_status': getattr(client, 'payment_status', None),
        'label': labels.get(status, 'Активний' if access_allowed else 'Немає доступу'),
        'message': message,
        'plan_code': PLAN_CODE,
        'plan_name': PLAN_NAME,
        'price': float(getattr(client, 'subscription_price', MONTHLY_PRICE) or MONTHLY_PRICE),
        'currency': CURRENCY,
        'trial_days': TRIAL_DAYS,
        'notice_days_before': NOTICE_DAYS,
        'grace_days_after': GRACE_DAYS,
        'subscription_end': end,
        'subscription_end_display': _date_str(end),
        'trial_until': getattr(client, 'trial_until', None),
        'trial_until_display': _date_str(getattr(client, 'trial_until', None)),
        'subscription_until': getattr(client, 'subscription_until', None),
        'subscription_until_display': _date_str(getattr(client, 'subscription_until', None)),
        'payment_notice_from': getattr(client, 'payment_notice_from', None),
        'payment_notice_from_display': _date_str(getattr(client, 'payment_notice_from', None)),
        'grace_until': grace_until,
        'grace_until_display': _date_str(grace_until),
        'days_left': days_left,
        'days_until_subscription_end': days_left,
        'grace_days_left': grace_days_left,
        'overdue_days': overdue_days,
        'subscription_warning': bool(access_allowed and status in [BILLING_DUE_SOON, BILLING_GRACE]),
        'subscription_expired': bool(not access_allowed or status == BILLING_BLOCKED),
        'blocked_at': getattr(client, 'blocked_at', None),
        'blocked_reason': getattr(client, 'blocked_reason', None),
        'last_payment_at': getattr(client, 'last_payment_at', None),
        'last_payment_method': getattr(client, 'last_payment_method', None),
    }


def subscription_payload(client):
    billing = get_billing_status(client)
    return {
        'subscription_end': billing.get('subscription_end'),
        'subscription_end_display': billing.get('subscription_end_display'),
        'days_until_subscription_end': billing.get('days_until_subscription_end'),
        'subscription_warning': billing.get('subscription_warning', False),
        'subscription_expired': billing.get('subscription_expired', False),
        'subscription_label': billing.get('label'),
        'billing': billing,
    }


def sync_queryset_subscriptions(queryset):
    for client in queryset:
        sync_client_subscription(client)
    return queryset


def get_alert_clients(queryset):
    expiring = []
    expired = []
    for client in queryset.select_related('user', 'assigned_owner'):
        billing = get_billing_status(client)
        item = {
            'id': client.id,
            'client_code': client.client_code,
            'client_code_display': f'C{client.client_code}',
            'full_name': client.user.first_name or client.user.username,
            'username': client.user.username,
            'phone': client.phone,
            'subscription_end_display': billing.get('subscription_end_display'),
            'days_until_subscription_end': billing.get('days_until_subscription_end'),
            'payment_status': client.payment_status,
            'billing_status': billing.get('billing_status'),
            'is_access_enabled': client.is_access_enabled,
            'billing_label': billing.get('label'),
            'billing_message': billing.get('message'),
        }
        if billing.get('subscription_warning'):
            expiring.append(item)
        if billing.get('subscription_expired'):
            expired.append(item)
    return {'expiring_soon': expiring, 'expired': expired, 'expiring_count': len(expiring), 'expired_count': len(expired)}
