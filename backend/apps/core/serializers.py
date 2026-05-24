from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Company, Employee, Visit, ServiceCatalog, OrderPart, OrderService, Category, InventoryItem, Supplier, PlatformClient
from .subscriptions import subscription_payload

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'email']

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalog
        fields = '__all__'
        read_only_fields = ['company']

class OrderPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPart
        fields = '__all__'
        read_only_fields = ['visit']

class OrderServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderService
        fields = '__all__'
        read_only_fields = ['visit']

class VisitSerializer(serializers.ModelSerializer):
    services = OrderServiceSerializer(many=True, read_only=True)
    parts = OrderPartSerializer(many=True, read_only=True)

    class Meta:
        model = Visit
        fields = '__all__'
        read_only_fields = ['company', 'created_at', 'updated_at']

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ['company']

class InventoryItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ['company']

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['company']


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
        fields = [
            'id', 'user_id', 'client_code', 'client_code_display', 'full_name', 'username', 'email', 'phone',
            'payment_status', 'is_access_enabled', 'assigned_owner_id',
            'assigned_to', 'assigned_partner_code', 'referred_by_name',
            'trial_until', 'subscription_until', 'subscription_end_display', 'days_until_subscription_end',
            'subscription_warning', 'subscription_expired', 'subscription_label', 'created_at'
        ]

    def _subscription(self, obj):
        if not hasattr(obj, '_subscription_payload'):
            obj._subscription_payload = subscription_payload(obj)
        return obj._subscription_payload

    def get_client_code_display(self, obj):
        return f'C{obj.client_code}' if obj.client_code else None

    def get_subscription_end_display(self, obj):
        return self._subscription(obj).get('subscription_end_display')

    def get_days_until_subscription_end(self, obj):
        return self._subscription(obj).get('days_until_subscription_end')

    def get_subscription_warning(self, obj):
        return self._subscription(obj).get('subscription_warning')

    def get_subscription_expired(self, obj):
        return self._subscription(obj).get('subscription_expired')

    def get_subscription_label(self, obj):
        return self._subscription(obj).get('subscription_label')

    def get_assigned_to(self, obj):
        if not obj.assigned_owner:
            return None
        full_name = obj.assigned_owner.first_name.strip() if obj.assigned_owner.first_name else ''
        if full_name:
            return full_name
        return obj.assigned_owner.username

    def get_assigned_partner_code(self, obj):
        try:
            return obj.assigned_owner.employee_profile.partner_code
        except Exception:
            try:
                if obj.assigned_owner.username == 'Denys9Ri':
                    return 'A6000'
            except Exception:
                pass
            return None

    def get_referred_by_name(self, obj):
        if not obj.referred_by:
            return None
        full_name = obj.referred_by.first_name.strip() if obj.referred_by.first_name else ''
        return full_name or obj.referred_by.username
