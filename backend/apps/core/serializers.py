from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Company, Employee, Visit, ServiceCatalog, OrderPart, OrderService, Category, InventoryItem, Supplier, PlatformClient

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
    # Використовуємо related_name з моделей (переконайся що вони такі)
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
    assigned_to = serializers.SerializerMethodField()
    referred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PlatformClient
        fields = ['id', 'client_code', 'full_name', 'username', 'payment_status', 'is_access_enabled', 'assigned_to', 'referred_by_name', 'created_at']

    def get_assigned_to(self, obj):
        full_name = obj.assigned_owner.first_name.strip() if obj.assigned_owner.first_name else ''
        if full_name:
            return full_name
        if hasattr(obj.assigned_owner, 'company'):
            return 'Адміністратор'
        return obj.assigned_owner.username

    def get_referred_by_name(self, obj):
        if not obj.referred_by:
            return None
        full_name = obj.referred_by.first_name.strip() if obj.referred_by.first_name else ''
        return full_name or obj.referred_by.username
