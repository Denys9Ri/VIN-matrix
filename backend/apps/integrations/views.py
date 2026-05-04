import openpyxl
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from .models import SupplierConfig, PriceItem
from .serializers import SupplierConfigSerializer
from .services import fetch_api_price
from .omega_catalog import get_crosses_for_article
from apps.core.models import Company

class SupplierConfigViewSet(viewsets.ModelViewSet):
    """
    Керування списком постачальників (Створення, Видалення, Список)
    """
    queryset = SupplierConfig.objects.all()
    serializer_class = SupplierConfigSerializer

    def perform_create(self, serializer):
        # Шукаємо компанію, якщо немає — створюємо її "на льоту"
        company = request.user.company
        if not company:
            company = request.user.company(
                name="Моє СТО", 
                slug="my-sto"
            )
        serializer.save(company=company)

class UploadPricesView(APIView):
    """
    Завантаження Excel для конкретного постачальника
    """
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        supplier_id = request.data.get('supplier_id')
        
        if not file or not supplier_id:
            return Response({"error": "Файл або ID постачальника відсутні"}, status=400)

        try:
            supplier = SupplierConfig.objects.get(id=supplier_id)
            wb = openpyxl.load_workbook(file, data_only=True)
            sheet = wb.active
            
            items_to_create = []
            PriceItem.objects.filter(supplier=supplier).delete()

            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not row[1]: continue # skip if no part_number
                
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
    # Твій існуючий код пошуку залишається без змін
    def get(self, request):
        part_number = request.GET.get('part_number', '').strip()
        if not part_number:
            return Response({"error": "Введіть артикул"}, status=400)

        search_articles = get_crosses_for_article(part_number)
        results = []
        company = Company.objects.first()
        suppliers = SupplierConfig.objects.filter(company=company, is_active=True)

        for supplier in suppliers:
            if supplier.supplier_type == 'EXCEL':
                local_items = PriceItem.objects.filter(supplier=supplier, part_number__in=search_articles)
                for item in local_items:
                    results.append({
                        "supplier": supplier.name,
                        "brand": item.brand,
                        "part_number": item.part_number,
                        "price": float(item.price),
                        "delivery_time": item.quantity,
                        "type": "EXCEL"
                    })
        
        results.sort(key=lambda x: x['price'])
        return Response({"results": results})
