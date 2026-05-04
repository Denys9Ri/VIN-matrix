from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import SupplierConfig, PriceItem
from .services import fetch_api_price
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import SupplierConfigSerializer
from .services import parse_supplier_excel, import_price_to_db
import json

class UnifiedSearchView(APIView):
    """
    Головний ендпоінт для пошуку запчастин по Артикулу.
    Об'єднує дані з підключених API та завантажених прайсів.
    """
    def get(self, request):
        # Отримуємо артикул з рядка пошуку (напр. /api/search/?part_number=05P634)
        part_number = request.GET.get('part_number', '').strip()
        
        if not part_number:
            return Response({"error": "Введіть артикул для пошуку"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Знаходимо компанію поточного користувача (СТО)
        # (Поки аутентифікація не налаштована повністю, беремо першу компанію для тесту)
        from apps.core.models import Company
        company = Company.objects.first() 
        
        if not company:
            return Response({"error": "Профіль СТО не знайдено"}, status=status.HTTP_404_NOT_FOUND)

        # 2. Витягуємо всіх активних постачальників цього СТО
        suppliers = SupplierConfig.objects.filter(company=company, is_active=True)
        
        results = []

        # 3. Обходимо постачальників і збираємо ціни
        for supplier in suppliers:
            if supplier.supplier_type == 'API' and supplier.api_token:
                # Звертаємося до зовнішнього API (напр. Весна)
                # Примітка: api_url треба буде додати в модель SupplierConfig
                api_response = fetch_api_price("https://api.vesna.com/search", supplier.api_token, part_number)
                
                if api_response['status'] == 'success':
                    for item in api_response['data']:
                        results.append({
                            "supplier": supplier.name,
                            "brand": item.get('brand'),
                            "part_number": item.get('part_number'),
                            "price": item.get('price'),
                            "currency": "UAH", # Вже перераховано в сервісі
                            "delivery_time": "1 день",
                            "type": "API"
                        })

            elif supplier.supplier_type == 'EXCEL':
                # Шукаємо в нашій супершвидкій таблиці PriceItem
                # Робимо пошук без врахування регістру (iexact)
                local_items = PriceItem.objects.filter(supplier=supplier, part_number__iexact=part_number)
                
                for item in local_items:
                    results.append({
                        "supplier": supplier.name,
                        "brand": item.brand,
                        "part_number": item.part_number,
                        "price": float(item.price),
                        "currency": "UAH",
                        "delivery_time": item.quantity,
                        "type": "EXCEL"
                    })

        # 4. Золоте правило: сортуємо від найдешевшого до найдорожчого
        results.sort(key=lambda x: float(x.get('price', 0)))

        # 5. Віддаємо JSON на фронтенд
        return Response({
            "query": part_number,
            "total_found": len(results),
            "results": results
        })
        
class UploadSupplierPriceView(APIView):
    """
    Ендпоінт для створення постачальника та завантаження Excel-прайсу.
    """
    parser_classes = (MultiPartParser, FormParser) # Дозволяє приймати файли

    def post(self, request):
        # 1. Створюємо конфігурацію постачальника
        serializer = SupplierConfigSerializer(data=request.data)
        if serializer.is_valid():
            supplier_config = serializer.save()
            
            # 2. Якщо це Excel і користувач передав файл
            if supplier_config.supplier_type == 'EXCEL' and 'excel_file' in request.FILES:
                file_obj = request.FILES['excel_file']
                
                # Зберігаємо файл у модель
                supplier_config.excel_file = file_obj
                supplier_config.save()
                
                # 3. Розбираємо column_mapping (він приходить як JSON-рядок)
                try:
                    mapping = json.loads(request.data.get('column_mapping', '{}'))
                except json.JSONDecodeError:
                    mapping = {}
                
                # 4. Запускаємо наш парсер!
                parsed_result = parse_supplier_excel(
                    supplier_config.excel_file.path, 
                    mapping, 
                    supplier_config.custom_exchange_rate
                )
                
                if parsed_result['status'] == 'success':
                    # 5. Заливаємо в супершвидку базу
                    import_result = import_price_to_db(supplier_config, parsed_result['data'])
                    
                    return Response({
                        "message": "Прайс успішно завантажено та оброблено",
                        "items_imported": import_result.get('imported_count', 0)
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        "error": "Помилка парсингу Excel", 
                        "details": parsed_result['message']
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
            return Response({"message": "Постачальника збережено (API)"}, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
