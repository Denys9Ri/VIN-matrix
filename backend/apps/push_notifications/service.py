import base64
import json
import logging

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from pywebpush import WebPushException, webpush

from .models import WebPushPreference, WebPushSubscription, WebPushVapidKey


logger = logging.getLogger('vin_matrix.push')

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


def category_enabled_for_user(user, category):
    field = CATEGORY_TO_PREFERENCE.get(category)
    if not field:
        return True
    return bool(getattr(get_user_push_preferences(user), field))


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
