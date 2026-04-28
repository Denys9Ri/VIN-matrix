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
