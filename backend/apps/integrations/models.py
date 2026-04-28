from django.db import models
from apps.core.models import Company

class SupplierConfig(models.Model):
    TYPE_CHOICES = [
        ('API', 'API Підключення'),
        ('EXCEL', 'Excel/CSV Прайс')
    ]
    CURRENCY_CHOICES = [
        ('UAH', 'Гривня'),
        ('EUR', 'Євро'),
        ('USD', 'Долар')
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='suppliers')
    name = models.CharField(max_length=100, verbose_name="Назва постачальника (напр. Омега)")
    supplier_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    
    # Дані для API
    api_token = models.CharField(max_length=255, blank=True, null=True, verbose_name="Ключ API")
    
    # Дані для завантажених прайсів
    excel_file = models.FileField(upload_to='suppliers_prices/', blank=True, null=True, verbose_name="Файл прайсу")
    column_mapping = models.JSONField(blank=True, null=True, help_text='{"articul": "Код", "price": "Ціна"}')
    
    # Валюта та перерахунок
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='UAH')
    custom_exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0, verbose_name="Ручний курс до UAH")
    
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.company.name})"
