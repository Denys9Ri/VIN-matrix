from rest_framework import serializers
from .models import Company, Visit, ServiceCatalog, Employee, OrderPart, OrderService
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class CompanySerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()
    class Meta:
        model = Company
        fields = '__all__'
    
    def get_logo(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalog
        fields = '__all__'
        read_only_fields = ('company',)

# --- НОВІ СЕРІАЛІЗАТОРИ ДЛЯ ДЕТАЛЕЙ ВІЗИТУ ---
class OrderPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPart
        fields = '__all__'
        read_only_fields = ('visit',)

class OrderServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderService
        fields = '__all__'
        read_only_fields = ('visit',)

class VisitSerializer(serializers.ModelSerializer):
    # Включаємо запчастини та роботи всередину візиту
    parts = OrderPartSerializer(many=True, read_only=True)
    services = OrderServiceSerializer(many=True, read_only=True)

    class Meta:
        model = Visit
        fields = '__all__'
        read_only_fields = ('company',)
