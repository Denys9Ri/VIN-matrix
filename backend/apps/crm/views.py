from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from decimal import Decimal

from .models import Car, Visit, VisitItem
from apps.integrations.models import SupplierConfig
from apps.core.models import Company
from .serializers import VisitSerializer
from apps.integrations.services import dispatch_api_order

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

class CheckoutVisitView(APIView):
    """
    Ендпоінт для оформлення замовлення ("Замовити все узгоджене").
    Сортує кошик по постачальниках і розсилає запити.
    """
    def post(self, request, visit_id):
        # 1. Знаходимо візит (Кошик)
        visit = get_object_or_404(Visit, id=visit_id)
        
        # Беремо тільки ті деталі, які ще не замовлені
        pending_items = visit.items.filter(logistics_status='PENDING')
        
        if not pending_items.exists():
            return Response({"message": "Немає деталей для замовлення"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Сортуємо деталі на "купки" по постачальниках
        supplier_groups = {}
        for item in pending_items:
            if item.supplier not in supplier_groups:
                supplier_groups[item.supplier] = []
            supplier_groups[item.supplier].append(item)

        # 3. Обходимо кожну купку
        results = []
        for supplier, items in supplier_groups.items():
            
            # Якщо це API — відправляємо запит через наш Маршрутизатор
            if supplier.supplier_type == 'API':
                order_response = dispatch_api_order(supplier.name, supplier.api_token, items)
                
                if order_response['status'] == 'success':
                    for item in items:
                        item.logistics_status = 'ORDERED'
                        item.save()
                    results.append({"supplier": supplier.name, "status": "Успішно відправлено по API"})
                else:
                    results.append({"supplier": supplier.name, "status": "Помилка API", "error": order_response['message']})
            
            # Якщо це Excel — плануємо ручне замовлення
            elif supplier.supplier_type == 'EXCEL':
                for item in items:
                    item.logistics_status = 'ORDERED' 
                    item.save()
                results.append({"supplier": supplier.name, "status": "Заплановано ручне замовлення"})

        # 4. Оновлюємо статус самого візиту
        visit.status = 'ORDERED'
        visit.save()

        return Response({
            "message": "Обробка кошика завершена",
            "details": results
        }, status=status.HTTP_200_OK)
