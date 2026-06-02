from decimal import Decimal

from django.db.models import Q
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, InventoryItem, OrderPart, StockMovement, Supplier
from .safe_crm_views import safe_ensure_company


def to_decimal(value):
    try:
        return Decimal(str(value or 0).replace(',', '.'))
    except Exception:
        return Decimal('0')


def to_int(value):
    try:
        return max(int(float(str(value or 1).replace(',', '.'))), 1)
    except Exception:
        return 1


class StockMovementSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    total_sum = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['company', 'inventory_item', 'created_by', 'created_at']

    def get_total_sum(self, obj):
        return round(float(obj.buy_price or 0) * float(obj.quantity or 0), 2)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        qs = StockMovement.objects.filter(company=company) if company else StockMovement.objects.none()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(brand__icontains=search) | Q(article__icontains=search) | Q(name__icontains=search) | Q(supplier__name__icontains=search))
        return qs.select_related('supplier', 'inventory_item', 'created_by')


class StockReceiveViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='receive')
    def receive(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії'}, status=400)
        data = request.data or {}
        brand = str(data.get('brand') or '').strip().upper()
        article = str(data.get('article') or '').strip().upper()
        name = str(data.get('name') or '').strip()
        if not brand or not article or not name:
            return Response({'error': 'Бренд, артикул і назва обовʼязкові'}, status=400)
        quantity = to_int(data.get('quantity'))
        buy_price = to_decimal(data.get('buy_price'))
        sell_price = to_decimal(data.get('sell_price'))
        supplier = None
        if data.get('supplier'):
            supplier = Supplier.objects.filter(company=company, id=data.get('supplier')).first()
        elif data.get('supplier_name'):
            supplier, _ = Supplier.objects.get_or_create(company=company, name=str(data.get('supplier_name')).strip())
        category = Category.objects.filter(company=company, id=data.get('category')).first() if data.get('category') else None
        order_part = OrderPart.objects.filter(id=data.get('order_part_id'), visit__company=company).first() if data.get('order_part_id') else None
        item = InventoryItem.objects.filter(company=company, brand__iexact=brand, article__iexact=article).first()
        created = False
        if item:
            item.quantity = int(item.quantity or 0) + quantity
            item.name = name
            item.buy_price = buy_price
            item.sell_price = sell_price or item.sell_price
            item.category = category or item.category
            item.supplier = supplier or item.supplier
            item.save()
        else:
            created = True
            item = InventoryItem.objects.create(company=company, category=category, supplier=supplier, brand=brand, article=article, name=name, quantity=quantity, buy_price=buy_price, sell_price=sell_price)
        movement = StockMovement.objects.create(company=company, inventory_item=item, supplier=supplier, source_order_part=order_part, brand=brand, article=article, name=name, quantity=quantity, buy_price=buy_price, sell_price=sell_price, note=data.get('note') or '', created_by=request.user)
        if order_part:
            order_part.status = 'ARRIVED'
            order_part.save(update_fields=['status'])
        return Response({'created': created, 'item_id': item.id, 'quantity': item.quantity, 'movement': StockMovementSerializer(movement).data}, status=status.HTTP_201_CREATED)
