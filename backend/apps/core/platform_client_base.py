from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Employee, PlatformClient
from .serializers import PlatformClientSerializer
from .subscriptions import sync_client_subscription


def is_platform_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def is_partner_account(user):
    if not user or not user.is_authenticated:
        return False
    try:
        return user.employee_profile.role == 'partner'
    except (Employee.DoesNotExist, AttributeError):
        return False


class BasePlatformClientViewSet(viewsets.ModelViewSet):
    """Shared database-backed access layer for platform client records."""

    serializer_class = PlatformClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PlatformClient.objects.select_related('user', 'assigned_owner', 'referred_by').order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(client_code__icontains=search)
                | Q(phone__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(assigned_owner__username__icontains=search)
                | Q(assigned_owner__first_name__icontains=search)
            )

        if is_platform_admin_user(self.request.user):
            visible = queryset
        elif is_partner_account(self.request.user):
            visible = queryset.filter(assigned_owner=self.request.user)
        else:
            visible = queryset.filter(user=self.request.user)

        for client in visible:
            sync_client_subscription(client)
        return visible

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        queryset = self.get_queryset()
        return Response({
            'total_clients': queryset.count(),
            'my_clients': queryset.count(),
            'active_clients': queryset.filter(is_access_enabled=True).count(),
        })