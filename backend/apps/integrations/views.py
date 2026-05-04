from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import SupplierConfig, PriceItem
from .services import fetch_api_price
from .omega_catalog import get_crosses_for_article 

class UnifiedSearchView(APIView):
    """
    Знаходить крос-коди через GOLD-ключ Омеги, 
    а потім шукає ціни по підключених прайсах клієнта (СТО).
    """
    def get(self, request):
        part_number = request.GET.get('part_number', '').strip()
        
        if not part_number:
            return Response({"error": "Введіть артикул для пошуку"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.core.models import Company
        company = Company.objects.first() 
        if not company:
            return Response({"error": "Профіль СТО не знайдено"}, status=status.HTTP_404_NOT_FOUND)

        # 1. ГЕНЕРУЄМО КРОСИ
        search_articles = get_crosses_for_article(part_number)
        
        results = []
        suppliers = SupplierConfig.objects.filter(company=company, is_active=True)

        # 2. ШУКАЄМО ЦІНИ
        for supplier in suppliers:
            if supplier.supplier_type == 'EXCEL':
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

        results.sort(key=lambda x: float(x.get('price', 0)))

        return Response({
            "original_query": part_number,
            "cross_codes_found": len(search_articles) - 1,
            "search_articles": search_articles,
            "total_results": len(results),
            "results": results
        })
