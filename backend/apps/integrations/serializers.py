from rest_framework import serializers
from .models import SupplierConfig

class SupplierConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierConfig
        # company робимо read_only, щоб фронтенд не мусив його надсилати
        fields = ['id', 'company', 'name', 'supplier_type', 'api_token', 
                  'column_mapping', 'currency', 'custom_exchange_rate', 'is_active']
        read_only_fields = ['company']
