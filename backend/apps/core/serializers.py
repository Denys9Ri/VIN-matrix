from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import connection
from .models import (
    Company, Employee, WorkPost, Visit, ServiceCatalog, OrderPart, OrderService,
    Category, InventoryItem, Supplier, PlatformClient,
    ServiceComplex, ComplexServiceItem, ComplexPartItem, VehicleRecommendation, StockMovement
)
from .subscriptions import subscription_payload

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'email']

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class WorkPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkPost
        fields = '__all__'
        read_only_fields = ['company', 'created_at', 'updated_at']

class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalog
        fields = '__all__'
        read_only_fields = ['company']

class OrderPartSerializer(serializers.ModelSerializer):
    stock_status = serializers.SerializerMethodField()
    inventory_item = serializers.SerializerMethodField()
    inventory_item_label = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()
    class Meta:
        model = OrderPart
        fields = '__all__'
        read_only_fields = ['visit', 'stock_status', 'inventory_item', 'inventory_item_label', 'source_label']
    def _extra(self, obj):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT stock_status, inventory_item_id FROM core_orderpart WHERE id=%s', [obj.id])
                row = cursor.fetchone()
            return row or ('none', None)
        except Exception:
            return ('none', None)
    def get_stock_status(self, obj): return self._extra(obj)[0] or 'none'
    def get_inventory_item(self, obj): return self._extra(obj)[1]
    def get_inventory_item_label(self, obj):
        inventory_id = self._extra(obj)[1]
        if not inventory_id: return None
        try:
            item = InventoryItem.objects.filter(id=inventory_id).first()
            return f'{item.brand} {item.article}' if item else None
        except Exception:
            return None
    def get_source_label(self, obj):
        status, inventory_id = self._extra(obj)
        if inventory_id:
            if status == 'sold': return 'Мій склад — списано'
            if status == 'reserved': return 'Мій склад — резерв'
            if status == 'released': return 'Мій склад — резерв знято'
            return 'Мій склад'
        return obj.supplier or 'Постачальник не вказаний'
    def create(self, validated_data):
        instance = super().create(validated_data)
        try:
            from .stock_reservations import sync_order_part_after_create
            sync_order_part_after_create(instance)
        except Exception as exc:
            print(f'STOCK SYNC: serializer create sync failed for part={getattr(instance, "id", None)}: {exc}')
        return instance

class OrderServiceSerializer(serializers.ModelSerializer):
    mechanic_name = serializers.SerializerMethodField()
    mechanic_username = serializers.SerializerMethodField()
    service_total = serializers.SerializerMethodField()
    commission_label = serializers.SerializerMethodField()

    class Meta:
        model = OrderService
        fields = '__all__'
        read_only_fields = ['visit', 'commission_amount', 'mechanic_name', 'mechanic_username', 'service_total', 'commission_label']

    def get_mechanic_name(self, obj):
        user = getattr(obj, 'mechanic', None)
        if not user:
            return ''
        return user.first_name or user.username

    def get_mechanic_username(self, obj):
        user = getattr(obj, 'mechanic', None)
        return user.username if user else ''

    def get_service_total(self, obj):
        try:
            return round(float(obj.price or 0) * float(obj.quantity or 1), 2)
        except Exception:
            return 0

    def get_commission_label(self, obj):
        if not getattr(obj, 'mechanic_id', None):
            return ''
        try:
            return f"{float(obj.commission_percent or 0):g}% · {float(obj.commission_amount or 0):.2f} ₴"
        except Exception:
            return ''

def _visit_payment_rows(visit_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id, amount, payment_type, payment_purpose, comment, created_at FROM core_visitpayment WHERE visit_id=%s ORDER BY created_at DESC, id DESC', [visit_id])
            rows = cursor.fetchall()
        return [{'id': r[0], 'amount': float(r[1] or 0), 'payment_type': r[2], 'payment_purpose': r[3], 'comment': r[4] or '', 'created_at': r[5]} for r in rows]
    except Exception:
        return []

def _visit_finance(obj):
    try:
        parts_total = sum(float(p.sell_price or 0) * float(p.quantity or 1) for p in obj.parts.all())
        parts_cost = sum(float(p.buy_price or 0) * float(p.quantity or 1) for p in obj.parts.all())
        services_total = sum(float(s.price or 0) * float(s.quantity or 1) for s in obj.services.all())
        mechanic_commission_total = sum(float(getattr(s, 'commission_amount', 0) or 0) for s in obj.services.all())
        with connection.cursor() as cursor:
            cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM core_visitpayment WHERE visit_id=%s', [obj.id])
            paid = float(cursor.fetchone()[0] or 0)
    except Exception:
        parts_total = parts_cost = services_total = mechanic_commission_total = 0
        paid = float(obj.prepayment_amount or 0)
    if paid <= 0:
        paid = float(obj.prepayment_amount or 0)
    total = parts_total + services_total
    debt = max(total - paid, 0)
    profit = parts_total - parts_cost + services_total
    profit_after_mechanics = profit - mechanic_commission_total
    return {'parts_total': round(parts_total, 2), 'services_total': round(services_total, 2), 'grand_total': round(total, 2), 'paid_amount': round(paid, 2), 'debt_amount': round(debt, 2), 'profit': round(profit, 2), 'mechanic_commission_total': round(mechanic_commission_total, 2), 'profit_after_mechanics': round(profit_after_mechanics, 2), 'margin': round((profit / total * 100) if total else 0, 1)}

class VisitSerializer(serializers.ModelSerializer):
    services = OrderServiceSerializer(many=True, read_only=True)
    parts = OrderPartSerializer(many=True, read_only=True)
    finance = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    debt_amount = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()
    work_post_name = serializers.SerializerMethodField()
    responsible_mechanic_name = serializers.SerializerMethodField()
    responsible_mechanic_username = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = '__all__'
        read_only_fields = ['company', 'created_at', 'updated_at', 'finance', 'payments', 'paid_amount', 'debt_amount', 'grand_total', 'work_post_name', 'responsible_mechanic_name', 'responsible_mechanic_username']
    def get_finance(self, obj): return _visit_finance(obj)
    def get_payments(self, obj): return _visit_payment_rows(obj.id)
    def get_paid_amount(self, obj): return _visit_finance(obj)['paid_amount']
    def get_debt_amount(self, obj): return _visit_finance(obj)['debt_amount']
    def get_grand_total(self, obj): return _visit_finance(obj)['grand_total']
    def get_work_post_name(self, obj): return obj.work_post.name if getattr(obj, 'work_post_id', None) and obj.work_post else ''
    def get_responsible_mechanic_name(self, obj):
        user = getattr(obj, 'responsible_mechanic', None)
        return (user.first_name or user.username) if user else ''
    def get_responsible_mechanic_username(self, obj):
        user = getattr(obj, 'responsible_mechanic', None)
        return user.username if user else ''

class ComplexServiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplexServiceItem
        fields = ['id', 'name', 'price', 'quantity']
        read_only_fields = ['id']

class ComplexPartItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplexPartItem
        fields = ['id', 'name', 'brand', 'article', 'buy_price', 'sell_price', 'quantity', 'supplier']
        read_only_fields = ['id']

class ServiceComplexSerializer(serializers.ModelSerializer):
    services = ComplexServiceItemSerializer(many=True, required=False)
    parts = ComplexPartItemSerializer(many=True, required=False)
    services_count = serializers.SerializerMethodField()
    parts_count = serializers.SerializerMethodField()
    total_sum = serializers.SerializerMethodField()

    class Meta:
        model = ServiceComplex
        fields = ['id', 'name', 'description', 'is_active', 'services', 'parts', 'services_count', 'parts_count', 'total_sum', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_services_count(self, obj): return obj.services.count()
    def get_parts_count(self, obj): return obj.parts.count()
    def get_total_sum(self, obj):
        services_total = sum(float(item.price or 0) * float(item.quantity or 1) for item in obj.services.all())
        parts_total = sum(float(item.sell_price or 0) * float(item.quantity or 1) for item in obj.parts.all())
        return round(services_total + parts_total, 2)

    def create(self, validated_data):
        services_data = validated_data.pop('services', [])
        parts_data = validated_data.pop('parts', [])
        complex_obj = ServiceComplex.objects.create(**validated_data)
        self._replace_items(complex_obj, services_data, parts_data)
        return complex_obj

    def update(self, instance, validated_data):
        services_data = validated_data.pop('services', None)
        parts_data = validated_data.pop('parts', None)
        for attr, value in validated_data.items(): setattr(instance, attr, value)
        instance.save()
        if services_data is not None or parts_data is not None: self._replace_items(instance, services_data or [], parts_data or [])
        return instance

    def _replace_items(self, complex_obj, services_data, parts_data):
        complex_obj.services.all().delete(); complex_obj.parts.all().delete()
        for item in services_data:
            if item.get('name'): ComplexServiceItem.objects.create(complex=complex_obj, **item)
        for item in parts_data:
            if item.get('name') or item.get('article'): ComplexPartItem.objects.create(complex=complex_obj, **item)

class VehicleRecommendationSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField(); state_label = serializers.SerializerMethodField(); days_left = serializers.SerializerMethodField()
    class Meta:
        model = VehicleRecommendation
        fields = ['id', 'visit', 'client', 'phone', 'plate', 'car', 'title', 'description', 'due_date', 'due_mileage', 'status', 'state', 'state_label', 'days_left', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    def _days_left(self, obj): return None if not obj.due_date else (obj.due_date - timezone.localdate()).days
    def get_days_left(self, obj): return self._days_left(obj)
    def get_state(self, obj):
        if obj.status == VehicleRecommendation.STATUS_DONE: return 'done'
        if obj.status == VehicleRecommendation.STATUS_CANCELLED: return 'cancelled'
        days = self._days_left(obj)
        if days is not None and days < 0: return 'overdue'
        if days is not None and days <= 7: return 'soon'
        return 'active'
    def get_state_label(self, obj): return {'done':'Виконано','cancelled':'Скасовано','overdue':'Прострочено','soon':'Скоро','active':'Активна'}.get(self.get_state(obj), 'Активна')

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['company']

def _mask_secret(value):
    value = str(value or '')
    if not value:
        return ''
    return f'{value[:4]}••••••{value[-4:]}' if len(value) > 8 else '••••••'


class SupplierSerializer(serializers.ModelSerializer):
    api_key_masked = serializers.SerializerMethodField()
    api_key_set = serializers.SerializerMethodField()
    api_password_set = serializers.SerializerMethodField()
    api_token_set = serializers.SerializerMethodField()
    connection_label = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'api_type',
            'api_key',
            'api_key_masked',
            'api_key_set',
            'api_login',
            'api_password',
            'api_password_set',
            'api_token_set',
            'browser_fingerprint',
            'price_file',
            'warehouse_prefs',
            'is_active',
            'connection_label',
        ]
        read_only_fields = [
            'id',
            'api_key_masked',
            'api_key_set',
            'api_password_set',
            'api_token_set',
            'connection_label',
        ]
        extra_kwargs = {
            'api_key': {'write_only': True, 'required': False, 'allow_blank': True, 'allow_null': True},
            'api_password': {'write_only': True, 'required': False, 'allow_blank': True, 'allow_null': True},
            'api_login': {'required': False, 'allow_blank': True, 'allow_null': True},
            'browser_fingerprint': {'required': False, 'allow_blank': True, 'allow_null': True},
            'api_type': {'required': False},
            'is_active': {'required': False},
            'price_file': {'required': False, 'allow_null': True},
            'warehouse_prefs': {'required': False},
        }

    def get_api_key_masked(self, obj):
        return _mask_secret(getattr(obj, 'api_key', ''))

    def get_api_key_set(self, obj):
        return bool(getattr(obj, 'api_key', None))

    def get_api_password_set(self, obj):
        return bool(getattr(obj, 'api_password', None))

    def get_api_token_set(self, obj):
        return bool(getattr(obj, 'api_token', None) or getattr(obj, 'api_refresh_token', None))

    def get_connection_label(self, obj):
        api_type = getattr(obj, 'api_type', 'custom') or 'custom'
        if api_type == 'utr':
            return 'Логін/пароль' if getattr(obj, 'api_login', '') and getattr(obj, 'api_password', '') else 'Потрібен логін/пароль'
        if api_type == 'custom':
            return 'Файл прайсу / ручний'
        return 'API ключ' if getattr(obj, 'api_key', '') else 'Потрібен API ключ'

    def _clean_empty_secrets(self, validated_data):
        # Не стираємо існуючий ключ або пароль, якщо користувач залишив поле пустим.
        for field in ['api_key', 'api_password', 'api_token', 'api_refresh_token']:
            if field in validated_data and validated_data.get(field) in [None, '']:
                validated_data.pop(field)
        return validated_data

    def create(self, validated_data):
        return super().create(self._clean_empty_secrets(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._clean_empty_secrets(validated_data))

class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    reserved_quantity = serializers.SerializerMethodField()
    min_quantity = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()
    needs_restock = serializers.SerializerMethodField()
    total_buy_value = serializers.SerializerMethodField()
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['company', 'updated_at', 'reserved_quantity', 'min_quantity', 'available_quantity', 'needs_restock', 'total_buy_value']
    def _extra(self, obj):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT reserved_quantity, min_quantity FROM core_inventoryitem WHERE id=%s', [obj.id])
                row = cursor.fetchone()
            return row or (0, 0)
        except Exception:
            return (0, 0)
    def get_reserved_quantity(self, obj): return int(self._extra(obj)[0] or 0)
    def get_min_quantity(self, obj): return int(self._extra(obj)[1] or 0)
    def get_available_quantity(self, obj): return max(int(obj.quantity or 0) - self.get_reserved_quantity(obj), 0)
    def get_needs_restock(self, obj): return self.get_available_quantity(obj) <= self.get_min_quantity(obj)
    def get_total_buy_value(self, obj):
        try: return round(float(obj.buy_price or 0) * float(obj.quantity or 0), 2)
        except Exception: return 0

class StockMovementSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    category_name = serializers.CharField(source='inventory_item.category.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.first_name', read_only=True)
    total_sum = serializers.SerializerMethodField()
    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['company', 'inventory_item', 'created_by', 'created_at', 'total_sum']
    def get_total_sum(self, obj):
        try: return round(float(obj.buy_price or 0) * float(obj.quantity or 0), 2)
        except Exception: return 0

class PlatformClientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.first_name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    assigned_owner_id = serializers.IntegerField(read_only=True)
    client_code_display = serializers.SerializerMethodField()
    assigned_to = serializers.SerializerMethodField()
    assigned_partner_code = serializers.SerializerMethodField()
    referred_by_name = serializers.SerializerMethodField()
    subscription_end_display = serializers.SerializerMethodField()
    days_until_subscription_end = serializers.SerializerMethodField()
    subscription_warning = serializers.SerializerMethodField()
    subscription_expired = serializers.SerializerMethodField()
    subscription_label = serializers.SerializerMethodField()
    class Meta:
        model = PlatformClient
        fields = ['id', 'user_id', 'client_code', 'client_code_display', 'full_name', 'username', 'email', 'phone', 'payment_status', 'is_access_enabled', 'assigned_owner_id', 'assigned_to', 'assigned_partner_code', 'referred_by_name', 'trial_until', 'subscription_until', 'subscription_end_display', 'days_until_subscription_end', 'subscription_warning', 'subscription_expired', 'subscription_label', 'created_at']
    def _subscription(self, obj):
        if not hasattr(obj, '_subscription_payload'): obj._subscription_payload = subscription_payload(obj)
        return obj._subscription_payload
    def get_client_code_display(self, obj): return f'C{obj.client_code}' if obj.client_code else None
    def get_assigned_to(self, obj):
        user = getattr(obj, 'assigned_owner', None)
        if not user: return None
        return user.first_name or user.username
    def get_assigned_partner_code(self, obj):
        user = getattr(obj, 'assigned_owner', None)
        if not user: return None
        if user.username == 'Denys9Ri' or user.is_staff or user.is_superuser: return 'A6000'
        try:
            emp = user.employee_profile
            return emp.partner_code if emp and emp.role == 'partner' else None
        except Exception:
            return None
    def get_referred_by_name(self, obj):
        user = getattr(obj, 'referred_by', None)
        if not user: return None
        return user.first_name or user.username
    def get_subscription_end_display(self, obj): return self._subscription(obj).get('subscription_end_display')
    def get_days_until_subscription_end(self, obj): return self._subscription(obj).get('days_until_subscription_end')
    def get_subscription_warning(self, obj): return self._subscription(obj).get('subscription_warning')
    def get_subscription_expired(self, obj): return self._subscription(obj).get('subscription_expired')
    def get_subscription_label(self, obj): return self._subscription(obj).get('subscription_label')
