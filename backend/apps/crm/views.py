from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from decimal import Decimal

from .models import Car, Visit, VisitItem
from apps.integrations.models import SupplierConfig
from apps.core.models import Company
from .serializers import VisitSerializer

class AddToCartView(APIView):
    """
    Ендпоінт для додавання знайденої запчастини в кошик (Візит) автомобіля.
    """
    def post(self, request):
        data = request.data
        
        car_id = data.get('car_id')
        supplier_id = data.get('supplier_id')
        
        # 1. Знаходимо авто
        car = get_object_or_404(Car, id=car_id)
        supplier = get_object_or_404(SupplierConfig, id=supplier_id)
        company = car.client.company
        
        # 2. Шукаємо відкритий візит (DRAFT) для цього авто, або створюємо новий
        visit, created = Visit.objects.get_or_create(
            car=car,
            status='DRAFT'
        )
        
        # 3. Рахуємо націнку (Беремо стандартну націнку СТО, наприклад 20%)
        purchase_price = Decimal(str(data.get('purchase_price', 0)))
        margin_percent = company.global_margin_percent
        
        sell_price = purchase_price + (purchase_price * (margin_percent / Decimal('100.0')))
        
        # 4. Створюємо запис у кошику
        item = VisitItem.objects.create(
            visit=visit,
            supplier=supplier,
            part_number=data.get('part_number'),
            brand=data.get('brand'),
            name=data.get('name', 'Автозапчастина'),
            purchase_price=purchase_price,
            margin_value=margin_percent,
            is_margin_percent=True,
            sell_price=round(sell_price, 2),
            logistics_status='PENDING'
        )
        
        # 5. Повертаємо оновлений кошик на фронтенд
        serializer = VisitSerializer(visit)
        return Response({
            "message": "Деталь успішно додано",
            "visit": serializer.data
        }, status=status.HTTP_201_CREATED)
