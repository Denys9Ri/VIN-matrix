from django.db import models
from apps.core.models import Company
from apps.integrations.models import SupplierConfig

class Client(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='clients')
    full_name = models.CharField(max_length=255, verbose_name="ПІБ Клієнта")
    phone_number = models.CharField(max_length=20, verbose_name="Телефон")

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"

class Car(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='cars')
    plate_number = models.CharField(max_length=20, verbose_name="Держ. номер")
    vin_code = models.CharField(max_length=17, blank=True, null=True, verbose_name="VIN-код")
    make = models.CharField(max_length=100, verbose_name="Марка", blank=True)
    model = models.CharField(max_length=100, verbose_name="Модель", blank=True)
    year = models.IntegerField(blank=True, null=True, verbose_name="Рік випуску")

    def __str__(self):
        return f"{self.plate_number} ({self.make} {self.model})"

class Visit(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Підбір / Узгодження'),
        ('ORDERED', 'Замовлено'),
        ('COMPLETED', 'Готово (Видано)'),
        ('CANCELED', 'Скасовано'),
    ]
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='visits')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Візит {self.car.plate_number} ({self.get_status_display()})"

class VisitItem(models.Model):
    LOGISTICS_CHOICES = [
        ('PENDING', 'Очікує ручного замовлення'),
        ('ORDERED', 'Замовлено (в процесі)'),
        ('IN_TRANSIT', 'В дорозі'),
        ('IN_STOCK', 'На складі (Приїхало)'),
        ('INSTALLED', 'Встановлено (Видано)'),
    ]
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='items')
    supplier = models.ForeignKey(SupplierConfig, on_delete=models.SET_NULL, null=True, verbose_name="Постачальник")
    
    part_number = models.CharField(max_length=100, verbose_name="Артикул")
    brand = models.CharField(max_length=100, verbose_name="Бренд")
    name = models.CharField(max_length=255, verbose_name="Назва деталі")
    
    # Фінанси
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Ціна закупівлі (UAH)")
    margin_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Націнка")
    is_margin_percent = models.BooleanField(default=True, verbose_name="Націнка у відсотках?")
    sell_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Фінальна ціна клієнту")
    
    # Світлофор замовлення
    logistics_status = models.CharField(max_length=20, choices=LOGISTICS_CHOICES, default='PENDING')

    def __str__(self):
        return f"{self.brand} {self.part_number} - {self.get_logistics_status_display()}"
