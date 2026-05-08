import openpyxl
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated

from .models import SupplierConfig, PriceItem
from .serializers import SupplierConfigSerializer

# Спроба імпортувати каталог кросів (якщо його немає - працюємо без нього)
try:
    from .omega_catalog import get_crosses_for_article
except ImportError:
    def get_crosses_for_article(part_number):
        return []

class SupplierConfigViewSet(viewsets.ModelViewSet):
    """Керування списком постачальників СТО"""
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierConfigSerializer

    def get_queryset(self):
        # Кожне СТО бачить тільки своїх постачальників
        return SupplierConfig.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        # При створенні прив'язуємо постачальника до СТО юзера
        serializer.save(company=self.request.user.company)

class UploadPricesView(APIView):
    """Завантаження Excel прайс-листа"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        supplier_id = request.data.get('supplier_id')
        
        if not file or not supplier_id:
            return Response({"error": "Файл або ID постачальника відсутні"}, status=400)

        try:
            # Перевіряємо, чи цей постачальник належить саме цій СТО
            supplier = SupplierConfig.objects.get(id=supplier_id, company=request.user.company)
            wb = openpyxl.load_workbook(file, data_only=True)
            sheet = wb.active
            
            items_to_create = []
            # Видаляємо старий прайс цього постачальника перед завантаженням нового
            PriceItem.objects.filter(supplier=supplier).delete()

            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not row[1]: continue # пропускаємо, якщо немає артикула
                
                items_to_create.append(PriceItem(
                    supplier=supplier,
                    brand=str(row[0]) if row[0] else "",
                    part_number=str(row[1]).strip().upper(),
                    name=str(row[2]) if row[2] else "",
                    price=float(row[3]) if row[3] else 0.0,
                    quantity=str(row[4]) if row[4] else "В наявності"
                ))

            PriceItem.objects.bulk_create(items_to_create)
            return Response({"status": "success", "count": len(items_to_create)})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class UnifiedSearchView(APIView):
    """
    Глобальний пошук по складах з урахуванням кросів.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        part_number = request.GET.get('part_number', '').strip().upper()
        if not part_number:
            return Response({"error": "Введіть артикул для пошуку"}, status=400)

        # 1. Шукаємо аналоги
        try:
            crosses = get_crosses_for_article(part_number)
            if part_number not in crosses:
                crosses.append(part_number)
        except Exception:
            crosses = [part_number]

        results = []
        
        # 2. Беремо підключених постачальників
        company = request.user.company
        active_suppliers = SupplierConfig.objects.filter(company=company, is_active=True)

        if not active_suppliers.exists():
            return Response({
                "results": [], 
                "message": "У вас не підключено жодного постачальника."
            })

        # 3. Шукаємо по списку кросів
        for supplier in active_suppliers:
            if supplier.supplier_type == 'EXCEL':
                local_items = PriceItem.objects.filter(supplier=supplier, part_number__in=crosses)
                for item in local_items:
                    results.append({
                        "supplier": supplier.name,
                        "brand": item.brand,
                        "part_number": item.part_number,
                        "name": item.name,
                        "price": float(item.price),
                        "delivery_time": item.quantity,
                        "type": "EXCEL"
                    })
            elif supplier.supplier_type == 'API':
                # Заготовка під API квадратики (Omega, BM Parts тощо)
                pass

        results.sort(key=lambda x: x['price'])
        
        return Response({
            "searched_article": part_number,
            "crosses_found": len(crosses),
            "results": results
        })
