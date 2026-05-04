from django.db import models
from django.contrib.auth.models import User

class Company(models.Model):
    name = models.CharField(max_length=255, verbose_name="Назва СТО")
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company', verbose_name="Власник")
    
    SUBSCRIPTION_CHOICES = [
        ('FREE', 'Free (10 запитів/день)'),
        ('PREMIUM', 'Premium (Безліміт)'),
    ]
    subscription_tier = models.CharField(max_length=50, choices=SUBSCRIPTION_CHOICES, default='FREE')
    
    # Стандартна націнка для цього СТО (може змінюватись для кожної деталі)
    global_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20.00, verbose_name="Стандартна націнка %")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
        
class Visit(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='visits')
    plate = models.CharField(max_length=20, verbose_name="Держ. номер")
    client = models.CharField(max_length=100, verbose_name="Клієнт / Модель Авто")
    phone = models.CharField(max_length=20, verbose_name="Телефон")
    status = models.CharField(max_length=50, default='SELECTION')
    statusText = models.CharField(max_length=100, default='НОВИЙ ВІЗИТ')
    step = models.CharField(max_length=100, default='Тільки що додано')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.plate} - {self.client}"
