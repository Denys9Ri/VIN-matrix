from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import get_user_company, repair_legacy_account


class DocumentSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії.'}, status=403)
        return Response({
            'document_requisites': getattr(company, 'document_requisites', '') or '',
            'document_signature': getattr(company, 'document_signature', '') or '',
            'document_warranty_text': getattr(company, 'document_warranty_text', '') or '',
            'document_footer': getattr(company, 'document_footer', '') or '',
        })

    def patch(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії для редагування.'}, status=403)
        for field in ['document_requisites', 'document_signature', 'document_warranty_text', 'document_footer']:
            if field in request.data:
                setattr(company, field, request.data.get(field) or '')
            bracket = f'company[{field}]'
            if bracket in request.data:
                setattr(company, field, request.data.get(bracket) or '')
        company.save()
        return Response({'message': 'Налаштування документів збережено.'})
