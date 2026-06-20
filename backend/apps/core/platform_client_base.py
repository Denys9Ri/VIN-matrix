from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PlatformClient
from .partner_views import is_partner_user, is_platform_admin, repair_legacy_account
from .serializers import PlatformClientSerializer
from .subscriptions import sync_client_subscription


class BasePlatformClientViewSet(viewsets.ModelViewSet):
    """Shared company-safe access layer for platform client records."""

    serializer_class = PlatformClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        repair_legacy_account(self.request.user)
        queryset = PlatformClient.objects.select_related('user', 'assigned_owner', 'referred_by').order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                client_code__icontains=search
            ) | queryset.filter(
                phone__icontains=search
            ) | queryset.filter(
                user__username__icontains=search
            ) | queryset.filter(
                user__first_name__icontains=search
            ) | queryset.filter(
                user__email__icontains=search
            ) | queryset.filter(
                assigned_owner__username__icontains=search
            ) | queryset.filter(
                assigned_owner__first_name__icontains=search
            )

        if is_platform_admin(self.request.user):
            visible = queryset
        elif is_partner_user(self.request.user):
            visible = queryset.filter(assigned_owner=self.request.user)
        else:
            visible = queryset.filter(user=self.request.user)

        for client in visible:
            sync_client_subscription(client)
        return visible

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        queryset = self.get_queryset()
        if is_platform_admin(request.user):
            return Response({
                'total_clients': queryset.count(),
                'active_clients': queryset.filter(is_access_enabled=True).count(),
                'my_clients': queryset.count(),
            })
        if is_partner_user(request.user):
            return Response({
                'my_clients': queryset.count(),
                'active_clients': queryset.filter(is_access_enabled=True).count(),
            })
        return Response({'my_clients': queryset.count(), 'active_clients': queryset.filter(is_access_enabled=True).count()})
