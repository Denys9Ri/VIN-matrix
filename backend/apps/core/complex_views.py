from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ComplexPartItem, ComplexServiceItem, OrderPart, OrderService, ServiceComplex, Visit
from .serializers import ServiceComplexSerializer
from .safe_crm_views import safe_ensure_company, supplier_badge_class


class ServiceComplexViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceComplexSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = ServiceComplex.objects.filter(company=company).prefetch_related('services', 'parts') if company else ServiceComplex.objects.none()
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення комплексу.')
        serializer.save(company=company)

    @action(detail=True, methods=['post'], url_path='apply-to-visit')
    def apply_to_visit(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=status.HTTP_403_FORBIDDEN)

        complex_obj = self.get_object()
        visit_id = request.data.get('visit') or request.data.get('visit_id')
        if not visit_id:
            return Response({'error': 'Не передано ID візиту.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            visit = Visit.objects.get(id=visit_id, company=company)
        except Visit.DoesNotExist:
            return Response({'error': 'Візит не знайдено або він належить іншому акаунту.'}, status=status.HTTP_404_NOT_FOUND)

        added_services = 0
        added_parts = 0

        for item in complex_obj.services.all():
            OrderService.objects.create(
                visit=visit,
                name=item.name,
                price=item.price,
                status='PENDING',
            )
            added_services += 1

        for item in complex_obj.parts.all():
            supplier = item.supplier or ''
            OrderPart.objects.create(
                visit=visit,
                brand=item.brand or '',
                article=item.article or '',
                name=item.name or item.article or 'Запчастина',
                buy_price=item.buy_price or 0,
                sell_price=item.sell_price or 0,
                supplier=supplier,
                supplier_color=supplier_badge_class(supplier),
                status='WAITING',
            )
            added_parts += 1

        return Response({
            'message': 'Комплекс додано у візит.',
            'added_services': added_services,
            'added_parts': added_parts,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='save-from-visit')
    def save_from_visit(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=status.HTTP_403_FORBIDDEN)

        visit_id = request.data.get('visit') or request.data.get('visit_id')
        name = str(request.data.get('name') or '').strip()
        description = str(request.data.get('description') or '').strip()
        if not visit_id:
            return Response({'error': 'Не передано ID візиту.'}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({'error': 'Вкажіть назву комплексу.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            visit = Visit.objects.prefetch_related('services', 'parts').get(id=visit_id, company=company)
        except Visit.DoesNotExist:
            return Response({'error': 'Візит не знайдено або він належить іншому акаунту.'}, status=status.HTTP_404_NOT_FOUND)

        complex_obj = ServiceComplex.objects.create(company=company, name=name, description=description, is_active=True)

        for service in visit.services.all():
            ComplexServiceItem.objects.create(
                complex=complex_obj,
                name=service.name,
                price=service.price or 0,
                quantity=1,
            )

        for part in visit.parts.all():
            ComplexPartItem.objects.create(
                complex=complex_obj,
                name=part.name,
                brand=part.brand,
                article=part.article,
                buy_price=part.buy_price or 0,
                sell_price=part.sell_price or 0,
                quantity=1,
                supplier=part.supplier,
            )

        return Response(self.get_serializer(complex_obj).data, status=status.HTTP_201_CREATED)
