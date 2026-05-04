from rest_framework import serializers
from .models import Client, Car, Visit, VisitItem

class VisitItemSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = VisitItem
        fields = ['id', 'visit', 'supplier', 'supplier_name', 'part_number', 'brand', 'name', 
                  'purchase_price', 'margin_value', 'is_margin_percent', 'sell_price', 'logistics_status']

class VisitSerializer(serializers.ModelSerializer):
    items = VisitItemSerializer(many=True, read_only=True)
    car_plate = serializers.CharField(source='car.plate_number', read_only=True)

    class Meta:
        model = Visit
        fields = ['id', 'car', 'car_plate', 'status', 'created_at', 'items']
