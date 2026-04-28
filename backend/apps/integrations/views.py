from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import SupplierConfig
from .services import fetch_api_price

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
                # ВАЖЛИВО: Ми не парсимо файл на кожен запит! Це "покладе" сервер.
                # Ми будемо шукати в локальній таблиці PriceItem, куди прайс був імпортований раніше.
                # Поки залишаємо заглушку для тестів:
                results.append({
                    "supplier": supplier.name,
                    "brand": "TEST_BRAND",
                    "part_number": part_number,
                    "price": 1500.00,
                    "currency": "UAH",
                    "delivery_time": "В наявності",
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
