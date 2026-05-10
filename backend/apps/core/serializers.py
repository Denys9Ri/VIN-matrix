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

class OrderPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderPart
        fields = '__all__'

class OrderServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderService
        fields = '__all__'

class VisitSerializer(serializers.ModelSerializer):
    services = OrderServiceSerializer(many=True, read_only=True)
    parts = OrderPartSerializer(many=True, read_only=True)

    class Meta:
        model = Visit
        fields = '__all__'
