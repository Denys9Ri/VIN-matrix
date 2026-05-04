from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, F
from decimal import Decimal

from apps.crm.models import VisitItem
from apps.core.models import Company

class DashboardStatsView(APIView):
    """
    Ендпоінт для головного екрану (Dashboard).
    Повертає фінансову аналітику та ТОП-артикулів/автомобілів.
    """
    def get(self, request):
        # Знаходимо компанію (поки беремо першу для тесту)
        company = Company.objects.first()
        if not company:
            return Response({"error": "Компанію не знайдено"}, status=404)

        # Беремо всі деталі, які пройшли через це СТО і були встановлені (видані)
        completed_items = VisitItem.objects.filter(
            visit__car__client__company=company,
            logistics_status='INSTALLED'
        )

        # 1. Фінанси (Оберт та Чистий прибуток)
        revenue_data = completed_items.aggregate(
            total_revenue=Sum('sell_price'),
            total_costs=Sum('purchase_price')
        )
        
        total_revenue = revenue_data['total_revenue'] or Decimal('0.00')
        total_costs = revenue_data['total_costs'] or Decimal('0.00')
        net_profit = total_revenue - total_costs

        # Гроші "в дорозі" (заморожені в деталях, які ще не встановлені)
        in_transit_items = VisitItem.objects.filter(
            visit__car__client__company=company,
            logistics_status__in=['ORDERED', 'IN_TRANSIT']
        )
        money_in_transit = in_transit_items.aggregate(Sum('purchase_price'))['purchase_price__sum'] or Decimal('0.00')

        # 2. ТОП-5 найпопулярніших запчастин
        top_parts = completed_items.values('part_number', 'brand', 'name') \
            .annotate(sell_count=Count('id')) \
            .order_by('-sell_count')[:5]

        # 3. Ефективність постачальників (У кого купуємо найчастіше)
        top_suppliers = completed_items.values(supplier_name=F('supplier__name')) \
            .annotate(total_spent=Sum('purchase_price'), orders_count=Count('id')) \
            .order_by('-total_spent')

        return Response({
            "finances": {
                "total_revenue_uah": round(total_revenue, 2),
                "net_profit_uah": round(net_profit, 2),
                "margin_percent": round((net_profit / total_costs * 100), 2) if total_costs > 0 else 0,
                "money_in_transit_uah": round(money_in_transit, 2)
            },
            "top_parts": list(top_parts),
            "suppliers_efficiency": list(top_suppliers)
        })
