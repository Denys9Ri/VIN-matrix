from django.contrib.auth.models import User
from django.db import connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PlatformClient
from .partner_views import (
    SecurePlatformClientViewSet as BaseSecurePlatformClientViewSet,
    get_default_assigned_owner,
    is_main_admin,
    is_partner_user,
    is_platform_admin,
    repair_legacy_account,
)
from .subscriptions import get_alert_clients, renew_client_30_days, sync_queryset_subscriptions


def resolve_pending_payments_for_client(client, admin_user):
    """When access is renewed manually, old pending requests should stop looking like active problems."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE core_subscriptionpayment
                SET status='confirmed',
                    confirmed_by_id=%s,
                    confirmed_at=%s,
                    period_start=%s,
                    period_end=%s,
                    comment=CASE
                        WHEN comment IS NULL OR comment = '' THEN 'Доступ продовжено адміністратором'
                        ELSE comment || ' · Доступ продовжено адміністратором'
                    END,
                    rejected_reason=NULL
                WHERE platform_client_id=%s AND status='pending'
                ''',
                [
                    admin_user.id if admin_user and admin_user.is_authenticated else None,
                    timezone.now(),
                    client.subscription_started_at,
                    client.subscription_until,
                    client.id,
                ],
            )
    except Exception:
        return 0
    return cursor.rowcount if 'cursor' in locals() else 0


class SecurePlatformClientViewSet(BaseSecurePlatformClientViewSet):
    def get_queryset(self):
        qs = super().get_queryset()
        sync_queryset_subscriptions(qs)
        return qs

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        repair_legacy_account(request.user)
        instance = self.get_object()

        allowed = is_platform_admin(request.user) or (
            is_partner_user(request.user) and instance.assigned_owner_id == request.user.id
        )
        if not allowed:
            return Response({'error': 'Немає прав видаляти цього клієнта.'}, status=status.HTTP_403_FORBIDDEN)

        target_user = instance.user
        if is_main_admin(target_user):
            return Response({'error': 'Головного адміна видаляти не можна.'}, status=status.HTTP_400_BAD_REQUEST)

        target_user_id = target_user.id
        target_username = target_user.username

        try:
            admin_user = get_default_assigned_owner(exclude_user=target_user)
            if admin_user and admin_user.id != target_user.id:
                PlatformClient.objects.filter(assigned_owner=target_user).update(
                    assigned_owner=admin_user,
                    referred_by=admin_user,
                )
                PlatformClient.objects.filter(referred_by=target_user).update(referred_by=admin_user)

            target_user.delete()
        except Exception as exc:
            return Response({'error': 'Не вдалося видалити акаунт.', 'details': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(id=target_user_id).exists():
            return Response({'error': 'Акаунт не видалено.', 'details': 'Користувач залишився у базі після видалення.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': 'Акаунт повністю видалено.', 'deleted_user_id': target_user_id, 'username': target_username}, status=status.HTTP_200_OK)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='renew-30-days')
    def renew_30_days(self, request, pk=None):
        repair_legacy_account(request.user)
        instance = self.get_object()
        allowed = is_platform_admin(request.user) or (
            is_partner_user(request.user) and instance.assigned_owner_id == request.user.id
        )
        if not allowed:
            return Response({'error': 'Немає прав продовжувати підписку цього клієнта.'}, status=403)
        renew_client_30_days(instance)
        resolved_count = resolve_pending_payments_for_client(instance, request.user)
        data = self.get_serializer(instance).data
        data['resolved_pending_payments'] = resolved_count
        return Response(data)

    @action(detail=False, methods=['get'], url_path='subscription-alerts')
    def subscription_alerts(self, request):
        repair_legacy_account(request.user)
        qs = PlatformClient.objects.select_related('user', 'assigned_owner').order_by('subscription_until', 'trial_until')
        if is_platform_admin(request.user):
            return Response(get_alert_clients(qs))
        if is_partner_user(request.user):
            return Response(get_alert_clients(qs.filter(assigned_owner=request.user)))
        return Response({'expiring_soon': [], 'expired': [], 'expiring_count': 0, 'expired_count': 0})
