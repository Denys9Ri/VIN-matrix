from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
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


class SecurePlatformClientViewSet(BaseSecurePlatformClientViewSet):
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
