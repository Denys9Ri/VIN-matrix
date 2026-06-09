from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import is_partner_user, is_platform_admin, repair_legacy_account


DEFAULT_CLIENT_LINK_SETTINGS = {
    'title': 'VIN-matrix subscription',
    'monthly_value': 2000,
    'public_url': '',
    'public_note': '',
    'instruction': 'Enter client code. Example: C6003',
    'is_active': True,
}


class BillingAdminClientLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def has_access(self, request):
        repair_legacy_account(request.user)
        return is_platform_admin(request.user) or is_partner_user(request.user)

    def get(self, request):
        if not self.has_access(request):
            return Response({'error': 'Forbidden.'}, status=403)
        return Response({'client_link_settings': DEFAULT_CLIENT_LINK_SETTINGS})

    def patch(self, request):
        if not self.has_access(request):
            return Response({'error': 'Forbidden.'}, status=403)
        settings = DEFAULT_CLIENT_LINK_SETTINGS.copy()
        for key in settings.keys():
            if key in request.data:
                settings[key] = request.data.get(key)
        settings['is_active'] = bool(settings.get('is_active'))
        return Response({
            'message': 'Client payment link settings saved.',
            'client_link_settings': settings,
        })
