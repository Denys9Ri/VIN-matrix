from rest_framework import serializers
from .models import SupplierConfig

class SupplierConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierConfig
        fields = ['id', 'company', 'name', 'supplier_type', 'api_token', 
                  'column_mapping', 'currency', 'custom_exchange_rate', 'is_active']
