from django.db import models
from apps.core.models import Company
from apps.integrations.models import SupplierConfig

class Client(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='clients')
    full_name = models.CharField(max_length=255, verbose_name="ПІБ Клієнта")
    phone_number = models.CharField(max_length=20, verbose_name="Телефон")

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"

    class Meta:
        verbose_name = "Клієнт"
        verbose_name_plural = "Клієнти"


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
    
    # Додано поле пробігу для фіксації історії авто
    mileage = models.IntegerField(blank=True, null=True, verbose_name="Пробіг (км)")
    
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


# === НОВИЙ БЛОК: ПОСЛУГИ ТА РОБОТИ ===

class ServiceCatalog(models.Model):
    """Довідник робіт/послуг для конкретної компанії (щоб редагувати в налаштуваннях)"""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255, verbose_name="Назва послуги (роботи)")
    default_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Стандартна ціна (UAH)")
    is_active = models.BooleanField(default=True, verbose_name="Активна")

    def __str__(self):
        return self.name


class VisitService(models.Model):
    """Послуги, які були додані до конкретного візиту"""
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='services')
    # Зв'язок з довідником (може бути пустим, якщо майстер вписав унікальну роботу руками)
    service_catalog = models.ForeignKey(ServiceCatalog, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Послуга з довідника")
    custom_name = models.CharField(max_length=255, blank=True, verbose_name="Ручна назва роботи")
    
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Ціна для клієнта (UAH)")
    quantity = models.DecimalField(max_digits=5, decimal_places=1, default=1.0, verbose_name="Кількість / Нормо-години")

    def __str__(self):
        name = self.service_catalog.name if self.service_catalog else self.custom_name
        return f"{name} - {self.price} UAH"
