import openpyxl
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser

from .models import SupplierConfig, PriceItem
from .services import fetch_api_price
from .omega_catalog import get_crosses_for_article
from apps.core.models import Company

class UnifiedSearchView(APIView):
    """
    Знаходить крос-коди через GOLD-ключ Омеги, 
    а потім шукає ціни по підключених прайсах клієнта (СТО).
    """
    def get(self, request):
        part_number = request.GET.get('part_number', '').strip()
        
        if not part_number:
            return Response({"error": "Введіть артикул для пошуку"}, status=status.HTTP_400_BAD_REQUEST)

        company = Company.objects.first() 
        if not company:
            return Response({"error": "Профіль СТО не знайдено"}, status=status.HTTP_404_NOT_FOUND)

        # 1. ГЕНЕРУЄМО КРОСИ ЧЕРЕЗ ОМЕГУ
        search_articles = get_crosses_for_article(part_number)
        
        results = []
        suppliers = SupplierConfig.objects.filter(company=company, is_active=True)

        # 2. ШУКАЄМО ЦІНИ В ЗАВАНТАЖЕНИХ ПРАЙСАХ ТА API
        for supplier in suppliers:
            if supplier.supplier_type == 'EXCEL':
                # Шукаємо всі артикули зі списку кросів у базі PriceItem
                local_items = PriceItem.objects.filter(
                    supplier=supplier, 
                    part_number__in=search_articles
                )
                
                for item in local_items:
                    results.append({
                        "supplier": supplier.name,
                        "brand": item.brand,
                        "part_number": item.part_number,
                        "price": float(item.price),
                        "currency": "UAH",
                        "delivery_time": item.quantity,
                        "type": "EXCEL",
                        "is_cross": item.part_number.upper() != part_number.upper() 
                    })
                    
            elif supplier.supplier_type == 'API' and supplier.api_token:
                # Тимчасовий приклад запиту до стороннього API
                api_response = fetch_api_price("https://api.vesna.com/search", supplier.api_token, part_number)
                
                if api_response['status'] == 'success':
                    for item in api_response['data']:
                        results.append({
                            "supplier": supplier.name,
                            "brand": item.get('brand'),
                            "part_number": item.get('part_number'),
                            "price": item.get('price'),
                            "currency": "UAH",
                            "delivery_time": "1 день",
                            "type": "API",
                            "is_cross": False
                        })

        # Сортування: від найдешевшого до найдорожчого
        results.sort(key=lambda x: float(x.get('price', 0)))

        return Response({
            "original_query": part_number,
            "cross_codes_found": len(search_articles) - 1,
            "search_articles": search_articles,
            "total_results": len(results),
            "results": results
        })

class UploadPricesView(APIView):
    """
    Приймає Excel файл, зчитує його та зберігає позиції в PriceItem.
    """
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        company = Company.objects.first()
        
        # Знаходимо конфігурацію для Excel постачальника
        supplier = SupplierConfig.objects.filter(company=company, supplier_type='EXCEL').first()

        if not file:
            return Response({"error": "Файл не завантажено"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not supplier:
            return Response({"error": "Налаштування для EXCEL постачальника не знайдено в базі"}, status=status.HTTP_404_NOT_FOUND)

        try:
            # Відкриваємо Excel
            wb = openpyxl.load_workbook(file, data_only=True)
            sheet = wb.active
            
            items_to_create = []
            
            # Видаляємо старі записи перед завантаженням нових
            PriceItem.objects.filter(supplier=supplier).delete()

            # Читаємо рядки: A:Бренд, B:Артикул, C:Назва, D:Ціна, E:Залишок
            for row in sheet.iter_rows(min_row=2, values_only=True):
                brand_val = row[0]
                articul_val = row[1]
                name_val = row[2]
                price_val = row[3]
                qty_val = row[4]

                if not articul_val:
                    continue
                
                items_to_create.append(PriceItem(
                    supplier=supplier,
                    brand=str(brand_val).strip() if brand_val else "",
                    part_number=str(articul_val).strip().upper(),
                    name=str(name_val).strip() if name_val else "",
                    price=float(price_val) if price_val else 0.0,
                    quantity=str(qty_val).strip() if qty_val else "В наявності"
                ))

            # Масове створення записів для швидкості
            PriceItem.objects.bulk_create(items_to_create)

            return Response({
                "status": "success", 
                "message": f"Оброблено рядків: {len(items_to_create)}"
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Помилка файлу: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
