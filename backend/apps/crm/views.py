from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from decimal import Decimal
from django.http import HttpResponse

from .models import Car, Visit, VisitItem, ServiceCatalog, VisitService
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


class UpdateItemStatusView(APIView):
    """
    Ендпоінт для зміни логістичного статусу конкретної деталі (Світлофор).
    """
    def patch(self, request, item_id):
        item = get_object_or_404(VisitItem, id=item_id)
        new_status = request.data.get('logistics_status')
        
        valid_statuses = [choice[0] for choice in VisitItem.LOGISTICS_CHOICES]
        if new_status not in valid_statuses:
            return Response({"error": "Невірний статус логістики"}, status=status.HTTP_400_BAD_REQUEST)
        
        item.logistics_status = new_status
        item.save()
        
        return Response({
            "message": "Статус успішно оновлено",
            "new_status": item.get_logistics_status_display()
        }, status=status.HTTP_200_OK)


class AddServiceToVisitView(APIView):
    """
    Ендпоінт для додавання послуги (роботи) до наряд-замовлення з довідника або вручну.
    """
    def post(self, request):
        data = request.data
        visit_id = data.get('visit_id')
        service_catalog_id = data.get('service_catalog_id')
        custom_name = data.get('custom_name', '')
        price = data.get('price')
        quantity = data.get('quantity', 1.0)

        visit = get_object_or_404(Visit, id=visit_id)
        service_item = None

        if service_catalog_id:
            service_item = get_object_or_404(ServiceCatalog, id=service_catalog_id)
            if not price:
                price = service_item.default_price
            if not custom_name:
                custom_name = service_item.name

        if not price:
            return Response({"error": "Не вказано вартість послуги"}, status=status.HTTP_400_BAD_REQUEST)

        VisitService.objects.create(
            visit=visit,
            service_catalog=service_item,
            custom_name=custom_name,
            price=Decimal(str(price)),
            quantity=Decimal(str(quantity))
        )

        serializer = VisitSerializer(visit)
        return Response({
            "message": "Роботу успішно додано",
            "visit": serializer.data
        }, status=status.HTTP_201_CREATED)


class ExportVisitPDFView(APIView):
    """
    Ендпоінт для генерації друкованої форми наряд-замовлення.
    Повертає чистий HTML-документ, оптимізований під миттєвий друк або збереження в PDF в один клік.
    """
    def get(self, request, visit_id):
        visit = get_object_or_404(Visit, id=visit_id)
        
        html_content = f"""
        <html>
        <head>
            <meta charset="utf-8">
            <title>Наряд-замовлення №{visit.id}</title>
            <style>
                body {{ font-family: 'Arial', sans-serif; margin: 30px; color: #222; font-size: 14px; }}
                .header {{ text-align: center; margin-bottom: 25px; line-height: 1.5; }}
                .info-table {{ width: 100%; margin-bottom: 25px; border-collapse: collapse; }}
                .info-table td {{ padding: 8px; border: 1px solid #bbb; }}
                .items-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
                .items-table th, .items-table td {{ padding: 10px; border: 1px solid #999; text-align: left; }}
                .items-table th {{ background-color: #f2f2f2; font-weight: bold; }}
                .total {{ text-align: right; margin-top: 30px; font-size: 18px; font-weight: bold; color: #000; }}
                .signatures {{ margin-top: 60px; width: 100%; }}
                .signatures td {{ border: none; padding: 10px; }}
            </style>
        </head>
        <body onload="window.print()">
            <div class="header">
                <h2>НАРЯД-ЗАМОВЛЕННЯ № {visit.id}</h2>
                <p>Дата відкриття: {visit.created_at.strftime('%d.%m.%Y %H:%M')}</p>
            </div>
            
            <table class="info-table">
                <tr>
                    <td><strong>Автомобіль:</strong> {visit.car.make} {visit.car.model} ({visit.car.year or '-'})</td>
                    <td><strong>Держ. номер:</strong> {visit.car.plate_number}</td>
                </tr>
                <tr>
                    <td><strong>VIN-код:</strong> {visit.car.vin_code or '-'}</td>
                    <td><strong>Пробіг:</strong> {getattr(visit, 'mileage', '-') or '-'} км</td>
                </tr>
                <tr>
                    <td colspan="2"><strong>Власник (Клієнт):</strong> {visit.car.client.full_name} | Тел: {visit.car.client.phone_number}</td>
                </tr>
            </table>

            <h3>1. Виконані роботи та послуги автосервісу</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Назва роботи (послуги)</th>
                        <th>К-сть / Нормо-години</th>
                        <th>Ціна за од. (UAH)</th>
                        <th>Сума (UAH)</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        total_amount = Decimal('0.00')
        services = visit.services.all() if hasattr(visit, 'services') else []
        
        if services:
            for s in services:
                name = s.service_catalog.name if s.service_catalog else s.custom_name
                subtotal = s.price * s.quantity
                total_amount += subtotal
                html_content += f"""
                    <tr>
                        <td>{name}</td>
                        <td>{s.quantity}</td>
                        <td>{s.price} UAH</td>
                        <td>{subtotal} UAH</td>
                    </tr>
                """
        else:
            html_content += "<tr><td colspan='4' style='text-align:center; color:#777;'>Послуги відсутні</td></tr>"

        html_content += """
                </tbody>
            </table>

            <h3>2. Використані автозапчастини та розхідні матеріали</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Виробник (Бренд)</th>
                        <th>Артикул деталі</th>
                        <th>Найменування</th>
                        <th>Сума (UAH)</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        items = visit.items.all()
        if items.exists():
            for item in items:
                total_amount += item.sell_price
                html_content += f"""
                    <tr>
                        <td>{item.brand}</td>
                        <td>{item.part_number}</td>
                        <td>{item.name}</td>
                        <td>{item.sell_price} UAH</td>
                    </tr>
                """
        else:
            html_content += "<tr><td colspan='4' style='text-align:center; color:#777;'>Запчастини не додавалися</td></tr>"

        html_content += f"""
                </tbody>
            </table>

            <div class="total">Загальна вартість замовлення: {total_amount} UAH</div>
            
            <table class="signatures">
                <tr>
                    <td>Майстер-приймальник: _________________</td>
                    <td style="text-align: right;">З об'ємом робіт згоден (Клієнт): _________________</td>
                </tr>
            </table>
        </body>
        </html>
        """
        response = HttpResponse(html_content, content_type='text/html; charset=utf-8')
        return response
