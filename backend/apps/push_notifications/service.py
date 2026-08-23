import base64
import json
import logging

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from pywebpush import WebPushException, webpush

from .models import WebPushDispatchLog, WebPushPreference, WebPushSubscription, WebPushVapidKey


logger = logging.getLogger('vin_matrix.push')
User = get_user_model()

PREFERENCE_FIELDS = (
    'visit_reminders',
    'status_updates',
    'payments',
    'inventory',
    'delivery',
    'crm',
)

CATEGORY_TO_PREFERENCE = {
    'visit_reminders': 'visit_reminders',
    'status_updates': 'status_updates',
    'payments': 'payments',
    'inventory': 'inventory',
    'delivery': 'delivery',
    'crm': 'crm',
}


def _b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode('ascii')


def _generate_vapid_pair():
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_der = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return _b64url(private_der), _b64url(public_raw)


def get_vapid_keypair():
    """Return the installation VAPID keypair, creating it only once."""
    try:
        return WebPushVapidKey.objects.get(pk=1)
    except WebPushVapidKey.DoesNotExist:
        private_key, public_key = _generate_vapid_pair()
        try:
            return WebPushVapidKey.objects.create(
                pk=1,
                private_key=private_key,
                public_key=public_key,
            )
        except IntegrityError:
            return WebPushVapidKey.objects.get(pk=1)


def get_user_push_preferences(user):
    preferences, _ = WebPushPreference.objects.get_or_create(user=user)
    return preferences


def serialize_push_preferences(preferences):
    return {field: bool(getattr(preferences, field)) for field in PREFERENCE_FIELDS}


def serialize_push_automation(preferences):
    return {
        'visit_reminder_minutes': int(preferences.visit_reminder_minutes or 60),
        'debt_schedule_days': preferences.debt_schedule_days or WebPushPreference.DEBT_DAYS_WEEKDAYS,
        'debt_notification_times': list(preferences.debt_notification_times or []),
        'crm_reminder_days_before': int(preferences.crm_reminder_days_before or 1),
        'crm_notification_time': preferences.crm_notification_time.strftime('%H:%M'),
        'quiet_hours_enabled': bool(preferences.quiet_hours_enabled),
        'quiet_hours_start': preferences.quiet_hours_start.strftime('%H:%M'),
        'quiet_hours_end': preferences.quiet_hours_end.strftime('%H:%M'),
    }


def category_enabled_for_user(user, category):
    field = CATEGORY_TO_PREFERENCE.get(category)
    if not field:
        return True
    return bool(getattr(get_user_push_preferences(user), field))


def company_push_users(company):
    user_ids = {getattr(company, 'owner_id', None)}
    try:
        user_ids.update(company.employees.values_list('user_id', flat=True))
    except Exception:
        pass
    user_ids.discard(None)
    if not user_ids:
        return User.objects.none()
    active_user_ids = WebPushSubscription.objects.filter(
        user_id__in=user_ids,
        is_active=True,
    ).values_list('user_id', flat=True).distinct()
    return User.objects.filter(id__in=active_user_ids, is_active=True)


def send_web_push(subscription: WebPushSubscription, payload: dict):
    vapid = get_vapid_keypair()
    subscription_info = {
        'endpoint': subscription.endpoint,
        'keys': {
            'p256dh': subscription.p256dh,
            'auth': subscription.auth,
        },
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=vapid.private_key,
            vapid_claims={
                'sub': getattr(settings, 'WEB_PUSH_SUBJECT', 'https://vin-matrix.com'),
            },
        )
    except WebPushException as exc:
        status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
        subscription.last_failure_at = timezone.now()
        subscription.last_error = str(exc)[:500]
        update_fields = ['last_failure_at', 'last_error', 'updated_at']
        if status_code in {404, 410}:
            subscription.is_active = False
            update_fields.append('is_active')
        subscription.save(update_fields=update_fields)
        logger.warning(
            'web_push_failed subscription_id=%s user_id=%s status_code=%s',
            subscription.id,
            subscription.user_id,
            status_code,
        )
        return False, status_code, str(exc)
    except Exception as exc:
        subscription.last_failure_at = timezone.now()
        subscription.last_error = str(exc)[:500]
        subscription.save(update_fields=['last_failure_at', 'last_error', 'updated_at'])
        logger.exception(
            'web_push_unexpected_failure subscription_id=%s user_id=%s',
            subscription.id,
            subscription.user_id,
        )
        return False, None, str(exc)

    subscription.last_success_at = timezone.now()
    subscription.last_error = ''
    subscription.is_active = True
    subscription.save(update_fields=['last_success_at', 'last_error', 'is_active', 'updated_at'])
    return True, None, ''


def send_user_push(user, payload, category=None):
    """Send an operational push to every active device for a user, respecting category preferences."""
    if category and not category_enabled_for_user(user, category):
        return {'delivered': 0, 'failed': 0, 'skipped': True}

    delivered = 0
    failed = 0
    for subscription in WebPushSubscription.objects.filter(user=user, is_active=True):
        ok, _, _ = send_web_push(subscription, payload)
        if ok:
            delivered += 1
        else:
            failed += 1

    return {'delivered': delivered, 'failed': failed, 'skipped': False}


def send_company_push(company, payload, category=None):
    """Send one operational event to every subscribed user of a company."""
    delivered = 0
    failed = 0
    skipped = 0
    for user in company_push_users(company):
        result = send_user_push(user, payload, category=category)
        delivered += result['delivered']
        failed += result['failed']
        skipped += 1 if result.get('skipped') else 0
    return {'delivered': delivered, 'failed': failed, 'skipped_users': skipped}


def send_scheduled_user_push(user, event_key, payload, category):
    """Claim a scheduled event before sending so repeated scheduler runs cannot duplicate it."""
    if category and not category_enabled_for_user(user, category):
        return {'delivered': 0, 'failed': 0, 'skipped': True, 'duplicate': False}

    try:
        # Use an inner savepoint so a duplicate claim rolls back cleanly without
        # poisoning a surrounding request/test transaction.
        with transaction.atomic():
            dispatch = WebPushDispatchLog.objects.create(
                user=user,
                event_key=event_key,
                category=category,
                payload=payload,
            )
    except IntegrityError:
        return {'delivered': 0, 'failed': 0, 'skipped': False, 'duplicate': True}

    result = send_user_push(user, payload, category=category)
    dispatch.delivered = result['delivered']
    dispatch.failed = result['failed']
    dispatch.save(update_fields=['delivered', 'failed'])

    # A transient total failure should be retried by the next scheduler tick.
    if result['delivered'] == 0 and result['failed'] > 0:
        dispatch.delete()

    return {**result, 'duplicate': False}
