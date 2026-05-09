from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Visit, Company, ServiceCatalog

# Серіалізатор для візитів
class VisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Visit
        fields = '__all__'
        read_only_fields = ['company']

# Серіалізатор для профілю (ім'я, пошта)
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['username']

# Серіалізатор для СТО (додано всі нові поля для налаштувань та акта)
class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id', 
            'name', 
            'logo', 
            'phone', 
            'address', 
            'document_footer', 
            'global_margin_percent'
        ]

# Серіалізатор для каталогу послуг
class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalog
        fields = ['id', 'name', 'price']
