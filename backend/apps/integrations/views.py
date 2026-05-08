from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import SupplierConfig, PriceItem

# Якщо в тебе є функція для кросів, імпортуй її. 
# Якщо ні - просто закоментуй цей рядок.
try:
    from .omega_catalog import get_crosses_for_article
except ImportError:
    def get_crosses_for_article(part_number):
        return [] # Заглушка, якщо довідника кросів ще немає

class UnifiedSearchView(APIView):
    """
    Глобальний розумний пошук з урахуванням кросів.
    Шукає ТІЛЬКИ по підключених постачальниках поточного СТО.
    """
    permission_classes = [IsAuthenticated] # Тільки для авторизованих СТО

    def get(self, request):
        part_number = request.GET.get('part_number', '').strip().upper()
        if not part_number:
            return Response({"error": "Введіть артикул для пошуку"}, status=400)

        # 1. ШУКАЄМО АНАЛОГИ (КРОСИ)
        try:
            crosses = get_crosses_for_article(part_number)
            # Переконуємось, що оригінальний артикул теж є в списку пошуку
            if part_number not in crosses:
                crosses.append(part_number)
        except Exception as e:
            # Якщо довідник кросів впав, шукаємо хоча б те, що ввів юзер
            crosses = [part_number]

        results = []
        
        # 2. БЕРЕМО ТІЛЬКИ ПОСТАЧАЛЬНИКІВ ЦЬОГО СТО
        company = request.user.company
        active_suppliers = SupplierConfig.objects.filter(company=company, is_active=True)

        if not active_suppliers.exists():
            return Response({
                "results": [], 
                "message": "У вас не підключено жодного постачальника. Перейдіть у Налаштування."
            })

        # 3. ШУКАЄМО ПО СПИСКУ КРОСІВ У КОЖНОГО ПОСТАЧАЛЬНИКА
        for supplier in active_suppliers:
            
            # Логіка для завантажених прайсів (Excel)
            if supplier.supplier_type == 'EXCEL':
                # Шукаємо всі деталі, артикул яких є в нашому списку кросів
                local_items = PriceItem.objects.filter(
                    supplier=supplier, 
                    part_number__in=crosses
                )
                
                for item in local_items:
                    results.append({
                        "supplier": supplier.name,
                        "brand": item.brand,
                        "part_number": item.part_number,
                        "name": item.name,
                        "price": float(item.price),
                        "delivery_time": item.quantity, # або термін доставки
                        "type": "EXCEL"
                    })
            
            # Логіка для API постачальників (Plug-and-Play)
            elif supplier.supplier_type == 'API':
                # Тут в майбутньому будемо робити запити до API конкретних постачальників
                # використовуючи supplier.api_token та список crosses
                pass

        # 4. СОРТУВАННЯ ТА ВИДАЧА
        # Сортуємо результати за ціною (від найменшої до найбільшої)
        results.sort(key=lambda x: x['price'])
        
        return Response({
            "searched_article": part_number,
            "crosses_found": len(crosses),
            "results": results
        })
