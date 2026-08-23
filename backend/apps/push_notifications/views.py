from datetime import datetime
from urllib.parse import urlparse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WebPushPreference, WebPushSubscription
from .service import (
    PREFERENCE_FIELDS,
    get_user_push_preferences,
    get_vapid_keypair,
    send_web_push,
    serialize_push_automation,
    serialize_push_preferences,
)


MAX_ENDPOINT_LENGTH = 2048
AUTOMATION_FIELDS = {
    'visit_reminder_minutes',
    'debt_schedule_days',
    'debt_notification_times',
    'crm_reminder_days_before',
    'crm_notification_time',
    'quiet_hours_enabled',
    'quiet_hours_start',
    'quiet_hours_end',
}


def _validated_subscription(data):
    subscription = data.get('subscription') if isinstance(data, dict) else None
    if not isinstance(subscription, dict):
        subscription = data if isinstance(data, dict) else {}

    endpoint = str(subscription.get('endpoint') or '').strip()
    keys = subscription.get('keys') or {}
    p256dh = str(keys.get('p256dh') or '').strip()
    auth = str(keys.get('auth') or '').strip()

    if not endpoint or len(endpoint) > MAX_ENDPOINT_LENGTH:
        raise ValueError('Некоректний endpoint для push-підписки.')
    parsed = urlparse(endpoint)
    if parsed.scheme != 'https' or not parsed.netloc:
        raise ValueError('Push endpoint має використовувати HTTPS.')
    if not p256dh or not auth:
        raise ValueError('Push-підписка не містить криптографічних ключів.')

    expiration_time = subscription.get('expirationTime')
    if expiration_time is not None:
        try:
            expiration_time = int(expiration_time)
        except (TypeError, ValueError):
            expiration_time = None

    return {
        'endpoint': endpoint,
        'p256dh': p256dh,
        'auth': auth,
        'expiration_time': expiration_time,
    }


def _parse_time(value, field_name):
    try:
        return datetime.strptime(str(value), '%H:%M').time()
    except (TypeError, ValueError):
        raise ValueError(f'Поле {field_name} має бути у форматі HH:MM.')


def _apply_automation_patch(preferences, payload):
    changed = []

    if 'visit_reminder_minutes' in payload:
        try:
            value = int(payload['visit_reminder_minutes'])
        except (TypeError, ValueError):
            raise ValueError('Нагадування про запис має бути числом хвилин.')
        if value < 15 or value > 1440:
            raise ValueError('Нагадування про запис можна встановити від 15 хвилин до 24 годин.')
        preferences.visit_reminder_minutes = value
        changed.append('visit_reminder_minutes')

    if 'debt_schedule_days' in payload:
        value = str(payload['debt_schedule_days'] or '')
        if value not in {WebPushPreference.DEBT_DAYS_WEEKDAYS, WebPushPreference.DEBT_DAYS_DAILY}:
            raise ValueError('Некоректний режим днів для нагадувань про борги.')
        preferences.debt_schedule_days = value
        changed.append('debt_schedule_days')

    if 'debt_notification_times' in payload:
        value = payload['debt_notification_times']
        if not isinstance(value, list) or not 1 <= len(value) <= 3:
            raise ValueError('Для боргів потрібно вибрати від 1 до 3 повідомлень на день.')
        normalized = []
        for item in value:
            parsed = _parse_time(item, 'debt_notification_times')
            text = parsed.strftime('%H:%M')
            if text not in normalized:
                normalized.append(text)
        if not normalized:
            raise ValueError('Додайте хоча б один час для повідомлень про борги.')
        preferences.debt_notification_times = sorted(normalized)
        changed.append('debt_notification_times')

    if 'crm_reminder_days_before' in payload:
        try:
            value = int(payload['crm_reminder_days_before'])
        except (TypeError, ValueError):
            raise ValueError('Кількість днів для CRM-нагадування має бути числом.')
        if value < 0 or value > 30:
            raise ValueError('CRM-нагадування можна встановити від 0 до 30 днів наперед.')
        preferences.crm_reminder_days_before = value
        changed.append('crm_reminder_days_before')

    if 'crm_notification_time' in payload:
        preferences.crm_notification_time = _parse_time(payload['crm_notification_time'], 'crm_notification_time')
        changed.append('crm_notification_time')

    if 'quiet_hours_enabled' in payload:
        value = payload['quiet_hours_enabled']
        if not isinstance(value, bool):
            raise ValueError('Поле quiet_hours_enabled має бути true або false.')
        preferences.quiet_hours_enabled = value
        changed.append('quiet_hours_enabled')

    if 'quiet_hours_start' in payload:
        preferences.quiet_hours_start = _parse_time(payload['quiet_hours_start'], 'quiet_hours_start')
        changed.append('quiet_hours_start')

    if 'quiet_hours_end' in payload:
        preferences.quiet_hours_end = _parse_time(payload['quiet_hours_end'], 'quiet_hours_end')
        changed.append('quiet_hours_end')

    return changed


def _preferences_payload(preferences):
    return {
        'preferences': serialize_push_preferences(preferences),
        'automation': serialize_push_automation(preferences),
    }


class WebPushStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vapid = get_vapid_keypair()
        active_count = WebPushSubscription.objects.filter(
            user=request.user,
            is_active=True,
        ).count()
        preferences = get_user_push_preferences(request.user)
        return Response({
            'server_ready': True,
            'public_key': vapid.public_key,
            'active_subscriptions': active_count,
            **_preferences_payload(preferences),
        })


class WebPushPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preferences = get_user_push_preferences(request.user)
        return Response(_preferences_payload(preferences))

    def patch(self, request):
        preferences = get_user_push_preferences(request.user)
        category_payload = request.data.get('preferences') if isinstance(request.data, dict) else None
        automation_payload = request.data.get('automation') if isinstance(request.data, dict) else None
        if category_payload is None:
            category_payload = {}
        if automation_payload is None:
            automation_payload = {}
        if not isinstance(category_payload, dict) or not isinstance(automation_payload, dict):
            return Response({'error': 'Некоректний формат налаштувань.'}, status=status.HTTP_400_BAD_REQUEST)

        changed = []
        for field in PREFERENCE_FIELDS:
            if field not in category_payload:
                continue
            value = category_payload[field]
            if not isinstance(value, bool):
                return Response(
                    {'error': f'Поле {field} має бути true або false.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            setattr(preferences, field, value)
            changed.append(field)

        unknown_automation = set(automation_payload) - AUTOMATION_FIELDS
        if unknown_automation:
            return Response({'error': 'Невідоме налаштування автоматизації.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            changed.extend(_apply_automation_patch(preferences, automation_payload))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if changed:
            preferences.save(update_fields=[*sorted(set(changed)), 'updated_at'])

        return Response({
            'saved': True,
            **_preferences_payload(preferences),
        })


class WebPushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            payload = _validated_subscription(request.data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        subscription, created = WebPushSubscription.objects.update_or_create(
            endpoint=payload['endpoint'],
            defaults={
                'user': request.user,
                'p256dh': payload['p256dh'],
                'auth': payload['auth'],
                'expiration_time': payload['expiration_time'],
                'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:512],
                'is_active': True,
                'last_error': '',
            },
        )
        get_user_push_preferences(request.user)
        return Response({
            'subscribed': True,
            'created': created,
            'subscription_id': subscription.id,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class WebPushUnsubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = str(request.data.get('endpoint') or '').strip()
        if not endpoint:
            return Response({'error': 'Не передано endpoint підписки.'}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = WebPushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint,
        ).delete()
        return Response({'unsubscribed': True, 'removed': bool(deleted)})


class WebPushTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = str(request.data.get('endpoint') or '').strip()
        if not endpoint:
            return Response(
                {'error': 'Спочатку увімкніть сповіщення на цьому пристрої.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subscription = WebPushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint,
            is_active=True,
        ).first()
        if not subscription:
            return Response(
                {'error': 'Активну push-підписку для цього пристрою не знайдено.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = {
            'title': 'VIN Matrix',
            'body': 'Сповіщення на цьому пристрої працюють ✅',
            'url': '/settings/notifications',
            'tag': 'vin-matrix-diagnostic',
        }
        delivered, status_code, _ = send_web_push(subscription, payload)
        if not delivered:
            if status_code in {404, 410}:
                return Response(
                    {'error': 'Підписка на цьому пристрої застаріла. Увімкніть сповіщення ще раз.'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {'error': 'Не вдалося доставити перевірочне сповіщення. Спробуйте ще раз.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'sent': True, 'message': 'Перевірочне сповіщення відправлено.'})
