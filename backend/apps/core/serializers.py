from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Company, Employee, Visit, ServiceCatalog, OrderPart, OrderService

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
