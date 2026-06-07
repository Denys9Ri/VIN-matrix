from django.db import models
from django.contrib.auth.models import User

class Company(models.Model):
    name = models.CharField(max_length=255, verbose_name="Company name")
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company')
    logo = models.ImageField(upload_to='company_logos/', null=True, blank=True, verbose_name="Logo")
    phone = models.CharField(max_length=50, blank=True, null=True, verbose_name="Phone")
    address = models.CharField(max_length=255, blank=True, null=True, verbose_name="Address")
    document_footer = models.TextField(blank=True, null=True, verbose_name="Document footer")
    document_requisites = models.TextField(blank=True, null=True, verbose_name="Document requisites")
    document_signature = models.CharField(max_length=255, blank=True, null=True, verbose_name="Document signature")
    document_warranty_text = models.TextField(blank=True, null=True, verbose_name="Warranty text")
    global_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20.00)
    euro_rate = models.DecimalField(max_digits=6, decimal_places=2, default=42.00)
    business_type = models.CharField(max_length=20, default='sto')
    def __str__(self): return self.name

class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees')
    role = models.CharField(max_length=20, default='mechanic')
    can_create_visits = models.BooleanField(default=False)
    can_view_finances = models.BooleanField(default=False)
    partner_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    def __str__(self): return f"{self.user.username} - {self.company.name}"

class Visit(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='visits')
    plate = models.CharField(max_length=20)
    vin_code = models.CharField(max_length=17, blank=True, null=True)
    client = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=50, default='SELECTION')
    delivery_type = models.CharField(max_length=50, default='pickup', blank=True, null=True)
    delivery_data = models.TextField(blank=True, null=True)
    payment_status = models.CharField(max_length=50, default='unpaid', blank=True, null=True)
    prepayment_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    scheduled_datetime = models.DateTimeField(null=True, blank=True)
    comment = models.TextField(blank=True, null=True)

class ServiceCatalog(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)

class ServiceComplex(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='service_complexes')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']

    def __str__(self):
        return self.name

class ComplexServiceItem(models.Model):
    complex = models.ForeignKey(ServiceComplex, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)

    def __str__(self):
        return self.name

class ComplexPartItem(models.Model):
    complex = models.ForeignKey(ServiceComplex, on_delete=models.CASCADE, related_name='parts')
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=100, blank=True, null=True)
    article = models.CharField(max_length=100, blank=True, null=True)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    supplier = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name

class OrderPart(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='parts')
    brand = models.CharField(max_length=100)
    article = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    supplier = models.CharField(max_length=100)
    supplier_color = models.CharField(max_length=80, blank=True, null=True)
    status = models.CharField(max_length=20, default='WAITING')

class OrderService(models.Model):
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='services')
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    status = models.CharField(max_length=20, default='PENDING')

class VehicleRecommendation(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_DONE = 'done'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [(STATUS_ACTIVE, 'Активна'), (STATUS_DONE, 'Виконана'), (STATUS_CANCELLED, 'Скасована')]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='recommendations')
    visit = models.ForeignKey(Visit, on_delete=models.SET_NULL, null=True, blank=True, related_name='recommendations')
    client = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    plate = models.CharField(max_length=20, blank=True, null=True)
    car = models.CharField(max_length=160, blank=True, null=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(null=True, blank=True)
    due_mileage = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_recommendations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['status', 'due_date', '-created_at']
    def __str__(self): return f"{self.plate or 'Авто'} — {self.title}"

class CRMTask(models.Model):
    STATUS_NEW = 'new'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE = 'done'
    STATUS_OVERDUE = 'overdue'
    STATUS_CHOICES = [(STATUS_NEW, 'Нова'), (STATUS_IN_PROGRESS, 'В роботі'), (STATUS_DONE, 'Виконана'), (STATUS_OVERDUE, 'Прострочена')]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='crm_tasks')
    visit = models.ForeignKey(Visit, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_tasks')
    client = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    plate = models.CharField(max_length=20, blank=True, null=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_crm_tasks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['status', 'due_date', '-created_at']
    def __str__(self): return self.title

class CRMCommunication(models.Model):
    STATUS_CALLED = 'called'
    STATUS_NO_ANSWER = 'no_answer'
    STATUS_CALL_BACK = 'call_back'
    STATUS_REFUSED = 'refused'
    STATUS_THINKING = 'thinking'
    STATUS_AGREED = 'agreed'
    STATUS_CHOICES = [
        (STATUS_CALLED, 'Дзвонили клієнту'),
        (STATUS_NO_ANSWER, 'Клієнт не відповів'),
        (STATUS_CALL_BACK, 'Домовились передзвонити'),
        (STATUS_REFUSED, 'Клієнт відмовився'),
        (STATUS_THINKING, 'Клієнт думає'),
        (STATUS_AGREED, 'Клієнт погодився'),
    ]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='crm_communications')
    visit = models.ForeignKey(Visit, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_communications')
    client = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    plate = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CALLED)
    comment = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_crm_communications')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-created_at', '-id']
    def __str__(self): return f"{self.client or self.plate or 'Клієнт'} — {self.status}"

class CRMClientStatus(models.Model):
    STATUS_NEW = 'new'
    STATUS_ACTIVE = 'active'
    STATUS_REGULAR = 'regular'
    STATUS_SLEEPING = 'sleeping'
    STATUS_PROBLEM = 'problem'
    STATUS_VIP = 'vip'
    STATUS_CHOICES = [
        (STATUS_NEW, 'Новий'),
        (STATUS_ACTIVE, 'Активний'),
        (STATUS_REGULAR, 'Постійний'),
        (STATUS_SLEEPING, 'Сплячий'),
        (STATUS_PROBLEM, 'Проблемний'),
        (STATUS_VIP, 'VIP'),
    ]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='crm_client_statuses')
    client = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    plate = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    note = models.TextField(blank=True, null=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_crm_client_statuses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [models.Index(fields=['company', 'phone', 'plate'])]

    def __str__(self):
        return f"{self.client or self.phone or self.plate or 'Клієнт'} — {self.status}"

class CRMServiceReminder(models.Model):
    TYPE_OIL = 'oil'
    TYPE_FILTERS = 'filters'
    TYPE_BRAKES = 'brakes'
    TYPE_TIRES = 'tires'
    TYPE_MAINTENANCE = 'maintenance'
    TYPE_CHOICES = [
        (TYPE_OIL, 'Заміна масла'),
        (TYPE_FILTERS, 'Фільтри'),
        (TYPE_BRAKES, 'Гальма'),
        (TYPE_TIRES, 'Сезонна заміна шин'),
        (TYPE_MAINTENANCE, 'ТО'),
    ]
    STATUS_ACTIVE = 'active'
