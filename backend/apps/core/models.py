from django.db import models
from django.contrib.auth.models import User

class Company(models.Model):
    name = models.CharField(max_length=255, verbose_name="Назва СТО")
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company')
    
    logo = models.ImageField(upload_to='company_logos/', null=True, blank=True, verbose_name="Логотип")
    phone = models.CharField(max_length=50, blank=True, null=True, verbose_name="Телефон СТО")
    address = models.CharField(max_length=255, blank=True, null=True, verbose_name="Адреса СТО")
    document_footer = models.TextField(blank=True, null=True, verbose_name="Текст для чека (Гарантія тощо)")
    
    global_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20.00, verbose_name="Націнка на запчастини (%)")

    def __str__(self): return self.name

class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees')
    role = models.CharField(max_length=20, default='mechanic')

    def __str__(self): return f"{self.user.username} - {self.company.name}"

class Visit(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='visits')
    plate = models.CharField(max_length=20)
    client = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=50, default='SELECTION')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True) # Для очищення дошки в кінці дня
    scheduled_datetime = models.DateTimeField(null=True, blank=True) # Для запису на час

class ServiceCatalog(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    name = models.CharField(max_length=255) 
    price = models.DecimalField(max_digits=10, decimal_places=2)

class OrderPart(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='parts')
    brand = models.CharField(max_length=100)
    article = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2) 
    sell_price = models.DecimalField(max_digits=10, decimal_places=2) 
    supplier = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='WAITING')

class OrderService(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='PENDING')
