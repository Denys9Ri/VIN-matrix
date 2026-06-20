from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import is_platform_admin
from .system_health import build_health_report


class SystemHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_platform_admin(request.user):
            raise PermissionDenied('Перевірка стану системи доступна лише адміністратору платформи.')

        report = build_health_report()
        return Response(report, status=200 if report['status'] in {'ok', 'degraded'} else 503)
