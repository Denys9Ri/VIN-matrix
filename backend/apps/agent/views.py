from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import company_for_user, company_settings


class AgentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = company_for_user(request.user)
        config = company_settings(company)
        return Response({
            'company_id': company.id,
            'enabled': config.is_enabled,
            'telegram_enabled': config.telegram_enabled,
            'viber_enabled': config.viber_enabled,
            'allow_voice': config.allow_voice,
            'allow_images': config.allow_images,
            'write_confirmation_required': config.require_confirmation_for_writes,
        })
