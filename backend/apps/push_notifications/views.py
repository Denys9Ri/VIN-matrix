from urllib.parse import urlparse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WebPushSubscription
from .service import (
    PREFERENCE_FIELDS,
    get_user_push_preferences,
    get_vapid_keypair,
    send_web_push,
    serialize_push_preferences,
)


MAX_ENDPOINT_LENGTH = 2048


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
            'preferences': serialize_push_preferences(preferences),
        })


class WebPushPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        preferences = get_user_push_preferences(request.user)
        return Response({'preferences': serialize_push_preferences(preferences)})

    def patch(self, request):
        preferences = get_user_push_preferences(request.user)
        payload = request.data.get('preferences') if isinstance(request.data, dict) else None
        if not isinstance(payload, dict):
            payload = request.data if isinstance(request.data, dict) else {}

        changed = []
        for field in PREFERENCE_FIELDS:
            if field not in payload:
                continue
            value = payload[field]
            if not isinstance(value, bool):
                return Response(
                    {'error': f'Поле {field} має бути true або false.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            setattr(preferences, field, value)
            changed.append(field)

        if changed:
            preferences.save(update_fields=[*changed, 'updated_at'])

        return Response({
            'saved': True,
            'preferences': serialize_push_preferences(preferences),
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
