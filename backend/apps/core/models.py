from django.db import models
import uuid
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
    payment_link = models.URLField(max_length=500, blank=True, null=True, verbose_name="Payment link")
    payment_requisites = models.TextField(blank=True, null=True, verbose_name="Payment requisites")
    payment_instruction = models.TextField(blank=True, null=True, verbose_name="Payment instruction")
    global_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20.00)
    euro_rate = models.DecimalField(max_digits=6, decimal_places=2, default=42.00)
    business_type = models.CharField(max_length=20, default='sto')
    def __str__(self): return self.name

class Employee(models.Model):
    SALARY_SERVICES_ONLY = 'services_only'
    SALARY_SERVICES_AND_PARTS_PROFIT = 'services_and_parts_profit'
    SALARY_ORDER_PROFIT = 'order_profit'
    SALARY_FIXED = 'fixed'
    SALARY_SCHEME_CHOICES = [
        (SALARY_SERVICES_ONLY, 'Відсоток тільки від робіт'),
        (SALARY_SERVICES_AND_PARTS_PROFIT, 'Відсоток від робіт + маржі запчастин'),
        (SALARY_ORDER_PROFIT, 'Відсоток від прибутку замовлення'),
        (SALARY_FIXED, 'Фіксована сума'),
    ]

    PAYOUT_DAILY = 'daily'
    PAYOUT_WEEKLY = 'weekly'
    PAYOUT_MONTHLY = 'monthly'
    PAYOUT_CUSTOM = 'custom'
    PAYOUT_PERIOD_CHOICES = [
        (PAYOUT_DAILY, 'Щодня'),
        (PAYOUT_WEEKLY, 'Щотижня'),
        (PAYOUT_MONTHLY, 'Щомісяця'),
        (PAYOUT_CUSTOM, 'Довільний період'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees')
    role = models.CharField(max_length=20, default='mechanic')
    can_create_visits = models.BooleanField(default=False)
    can_view_finances = models.BooleanField(default=False)
    partner_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=40.00)
    parts_commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    salary_scheme = models.CharField(max_length=40, choices=SALARY_SCHEME_CHOICES, default=SALARY_SERVICES_ONLY)
    payout_period = models.CharField(max_length=20, choices=PAYOUT_PERIOD_CHOICES, default=PAYOUT_MONTHLY)
    is_salary_active = models.BooleanField(default=True)
    def __str__(self): return f"{self.user.username} - {self.company.name}"



class WorkPost(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='work_posts')
    name = models.CharField(max_length=120)
    number = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'number', 'id']
        indexes = [models.Index(fields=['company', 'is_active', 'sort_order'])]

    def __str__(self):
        return f"{self.company_id}: {self.name}"

class StoExpense(models.Model):
    CATEGORY_RENT = 'rent'
    CATEGORY_UTILITIES = 'utilities'
    CATEGORY_ADMIN_SALARY = 'admin_salary'
    CATEGORY_TOOLS = 'tools'
    CATEGORY_EQUIPMENT = 'equipment'
    CATEGORY_EQUIPMENT_REPAIR = 'equipment_repair'
    CATEGORY_CONSUMABLES = 'consumables'
    CATEGORY_MARKETING = 'marketing'
    CATEGORY_TAXES = 'taxes'
    CATEGORY_BANK_FEES = 'bank_fees'
    CATEGORY_DELIVERY = 'delivery'
    CATEGORY_FUEL = 'fuel'
    CATEGORY_SOFTWARE = 'software'
    CATEGORY_CLEANING = 'cleaning'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_RENT, 'Оренда'),
        (CATEGORY_UTILITIES, 'Комунальні'),
        (CATEGORY_ADMIN_SALARY, 'Зарплата адміністратора / персоналу'),
        (CATEGORY_TOOLS, 'Інструмент'),
        (CATEGORY_EQUIPMENT, 'Обладнання'),
        (CATEGORY_EQUIPMENT_REPAIR, 'Ремонт обладнання'),
        (CATEGORY_CONSUMABLES, 'Витратні матеріали'),
        (CATEGORY_MARKETING, 'Маркетинг / реклама'),
        (CATEGORY_TAXES, 'Податки'),
        (CATEGORY_BANK_FEES, 'Банківські комісії'),
        (CATEGORY_DELIVERY, 'Доставка / логістика'),
        (CATEGORY_FUEL, 'Пальне'),
        (CATEGORY_SOFTWARE, 'Програми / підписки'),
        (CATEGORY_CLEANING, 'Прибирання / господарські витрати'),
        (CATEGORY_OTHER, 'Інше'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_CARD = 'card'
    PAYMENT_BANK = 'bank'
    PAYMENT_OTHER = 'other'
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Готівка'),
        (PAYMENT_CARD, 'Картка'),
        (PAYMENT_BANK, 'Рахунок / банк'),
        (PAYMENT_OTHER, 'Інше'),
    ]

    RECURRING_NONE = 'none'
    RECURRING_MONTHLY = 'monthly'
    RECURRING_WEEKLY = 'weekly'
    RECURRING_YEARLY = 'yearly'
    RECURRING_CHOICES = [
        (RECURRING_NONE, 'Разова витрата'),
        (RECURRING_WEEKLY, 'Щотижня'),
        (RECURRING_MONTHLY, 'Щомісяця'),
        (RECURRING_YEARLY, 'Щороку'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='sto_expenses')
    date = models.DateField()
    category = models.CharField(max_length=60, choices=CATEGORY_CHOICES, default=CATEGORY_OTHER)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=40, choices=PAYMENT_METHOD_CHOICES, default=PAYMENT_CASH)
    comment = models.TextField(blank=True, null=True)
    is_recurring = models.BooleanField(default=False)
    recurring_period = models.CharField(max_length=20, choices=RECURRING_CHOICES, default=RECURRING_NONE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sto_expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']
        indexes = [
            models.Index(fields=['company', 'date']),
            models.Index(fields=['company', 'category', 'date']),
        ]

    def __str__(self):
        return f"{self.company_id}: {self.date} — {self.title} — {self.amount}"


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
    work_post = models.ForeignKey(WorkPost, on_delete=models.SET_NULL, null=True, blank=True, related_name='visits')
    responsible_mechanic = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='responsible_visits')

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
    COMMISSION_SERVICES_ONLY = 'services_only'
    COMMISSION_SERVICES_AND_PARTS_PROFIT = 'services_and_parts_profit'
    COMMISSION_ORDER_PROFIT = 'order_profit'
    COMMISSION_FIXED = 'fixed'
    COMMISSION_BASE_CHOICES = [
        (COMMISSION_SERVICES_ONLY, 'Тільки роботи'),
        (COMMISSION_SERVICES_AND_PARTS_PROFIT, 'Роботи + маржа запчастин'),
        (COMMISSION_ORDER_PROFIT, 'Прибуток замовлення'),
        (COMMISSION_FIXED, 'Фіксована сума'),
    ]

    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name='services')
    mechanic = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='performed_services')
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    commission_base = models.CharField(max_length=40, choices=COMMISSION_BASE_CHOICES, default=COMMISSION_SERVICES_ONLY)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
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
    STATUS_CHOICES = [(STATUS_CALLED, 'Дзвонили клієнту'), (STATUS_NO_ANSWER, 'Клієнт не відповів'), (STATUS_CALL_BACK, 'Домовились передзвонити'), (STATUS_REFUSED, 'Клієнт відмовився'), (STATUS_THINKING, 'Клієнт думає'), (STATUS_AGREED, 'Клієнт погодився')]
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
    STATUS_CHOICES = [(STATUS_NEW, 'Новий'), (STATUS_ACTIVE, 'Активний'), (STATUS_REGULAR, 'Постійний'), (STATUS_SLEEPING, 'Сплячий'), (STATUS_PROBLEM, 'Проблемний'), (STATUS_VIP, 'VIP')]
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
    def __str__(self): return f"{self.client or self.phone or self.plate or 'Клієнт'} — {self.status}"

class CRMServiceReminder(models.Model):
    TYPE_OIL = 'oil'
    TYPE_FILTERS = 'filters'
    TYPE_BRAKES = 'brakes'
    TYPE_TIRES = 'tires'
    TYPE_MAINTENANCE = 'maintenance'
    TYPE_CHOICES = [(TYPE_OIL, 'Заміна масла'), (TYPE_FILTERS, 'Фільтри'), (TYPE_BRAKES, 'Гальма'), (TYPE_TIRES, 'Сезонна заміна шин'), (TYPE_MAINTENANCE, 'ТО')]
    STATUS_ACTIVE = 'active'
    STATUS_DONE = 'done'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [(STATUS_ACTIVE, 'Активне'), (STATUS_DONE, 'Виконано'), (STATUS_CANCELLED, 'Скасовано')]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='crm_service_reminders')
    visit = models.ForeignKey(Visit, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_service_reminders')
    client = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    plate = models.CharField(max_length=20, blank=True, null=True)
    reminder_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_MAINTENANCE)
    title = models.CharField(max_length=255, blank=True, null=True)
    due_date = models.DateField(null=True, blank=True)
    due_mileage = models.PositiveIntegerField(null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_crm_service_reminders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['status', 'due_date', 'due_mileage', '-created_at']
        indexes = [models.Index(fields=['company', 'phone', 'plate', 'status'])]
    def __str__(self): return f"{self.client or self.phone or self.plate or 'Клієнт'} — {self.title or self.reminder_type}"

class CompanyOption(models.Model):
    MODE_STORE = 'store'
    MODE_STO = 'sto'
    MODE_BOTH = 'both'
    MODE_SYSTEM = 'system'
    MODE_CHOICES = [(MODE_STORE, 'Магазин'), (MODE_STO, 'СТО'), (MODE_BOTH, 'Обидва режими'), (MODE_SYSTEM, 'Система')]
    GROUP_STORE_ORDER_STATUS = 'store_order_status'
    GROUP_STO_VISIT_STATUS = 'sto_visit_status'
    GROUP_PART_STATUS = 'part_status'
    GROUP_PAYMENT_TYPE = 'payment_type'
    GROUP_ORDER_SOURCE = 'order_source'
    GROUP_CANCEL_REASON = 'cancel_reason'
    GROUP_PRODUCT_CATEGORY = 'product_category'
    GROUP_CLIENT_STATUS = 'client_status'

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='options')
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_BOTH)
    group = models.CharField(max_length=60)
    key = models.CharField(max_length=80)
    label = models.CharField(max_length=120)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=30, default='slate')
    icon = models.CharField(max_length=40, blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    semantic_role = models.CharField(max_length=60, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['group', 'sort_order', 'id']
        unique_together = ('company', 'group', 'key')
        indexes = [
            models.Index(fields=['company', 'group', 'is_active']),
            models.Index(fields=['company', 'mode', 'group']),
            models.Index(fields=['company', 'semantic_role']),
        ]

    def __str__(self):
        return f"{self.company_id}:{self.group}:{self.key} — {self.label}"

class Category(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    def __str__(self): return self.name

class Supplier(models.Model):
    API_CUSTOM = 'custom'
    API_VESNA = 'vesna'
    API_OMEGA = 'omega'
    API_TEHNOMIR = 'tehnomir'
    API_BM = 'bm'
    API_UTR = 'utr'
    API_TYPE_CHOICES = [
        (API_CUSTOM, 'Інший / Excel'),
        (API_VESNA, 'Vesna-auto'),
        (API_OMEGA, 'Omega'),
        (API_TEHNOMIR, 'Техномир'),
        (API_BM, 'BM Parts'),
        (API_UTR, 'Юнік Трейд'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    api_type = models.CharField(max_length=30, choices=API_TYPE_CHOICES, default=API_CUSTOM)
    api_key = models.CharField(max_length=255, blank=True, null=True)
    api_login = models.CharField(max_length=255, blank=True, null=True)
    api_password = models.CharField(max_length=255, blank=True, null=True)
    api_token = models.TextField(blank=True, null=True)
    api_refresh_token = models.TextField(blank=True, null=True)
    api_token_expires_at = models.DateTimeField(null=True, blank=True)
    browser_fingerprint = models.CharField(max_length=128, blank=True, null=True)
    price_file = models.FileField(upload_to='supplier_prices/', null=True, blank=True)
    warehouse_prefs = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class InventoryItem(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_items')
    brand = models.CharField(max_length=100)
    article = models.CharField(max_length=100)
    name = models.TextField()
    quantity = models.IntegerField(default=0)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        indexes = [models.Index(fields=['company', 'brand', 'article'])]
    def __str__(self): return f"{self.brand} {self.article}"

class StockMovement(models.Model):
    TYPE_RECEIPT = 'receipt'
    TYPE_ADJUSTMENT = 'adjustment'
    TYPE_CHOICES = [(TYPE_RECEIPT, 'Прихід'), (TYPE_ADJUSTMENT, 'Корекція')]
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='stock_movements')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_RECEIPT)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    source_order_part = models.ForeignKey(OrderPart, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    brand = models.CharField(max_length=100)
    article = models.CharField(max_length=100)
    name = models.TextField()
    quantity = models.IntegerField(default=1)
    buy_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sell_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    note = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_stock_movements')
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [models.Index(fields=['company', 'created_at'])]
    def __str__(self): return f"{self.brand} {self.article} +{self.quantity}"

class PlatformClient(models.Model):
    PAYMENT_PENDING = 'pending'
    PAYMENT_TRIAL = 'trial'
    PAYMENT_ACTIVE = 'active'
    PAYMENT_INACTIVE = 'inactive'
    PAYMENT_STATUS_CHOICES = [(PAYMENT_PENDING, 'Pending'), (PAYMENT_TRIAL, 'Trial'), (PAYMENT_ACTIVE, 'Active'), (PAYMENT_INACTIVE, 'Inactive')]

    BILLING_TRIAL = 'trial'
    BILLING_ACTIVE = 'active'
    BILLING_DUE_SOON = 'payment_due_soon'
    BILLING_GRACE = 'grace'
    BILLING_BLOCKED = 'blocked'
    BILLING_MANUAL_FREE = 'manual_free'
    BILLING_CHOICES = [
        (BILLING_TRIAL, 'Trial'),
        (BILLING_ACTIVE, 'Active'),
        (BILLING_DUE_SOON, 'Payment due soon'),
        (BILLING_GRACE, 'Grace period'),
        (BILLING_BLOCKED, 'Blocked'),
        (BILLING_MANUAL_FREE, 'Manual free access'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='platform_client_profile')
    client_code = models.PositiveIntegerField(unique=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    assigned_owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_platform_clients')
    referred_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='referred_platform_clients')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_TRIAL)
    billing_status = models.CharField(max_length=30, choices=BILLING_CHOICES, default=BILLING_TRIAL)
    is_access_enabled = models.BooleanField(default=True)
    subscription_price = models.DecimalField(max_digits=10, decimal_places=2, default=2000)
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_until = models.DateTimeField(null=True, blank=True)
    subscription_started_at = models.DateTimeField(null=True, blank=True)
    subscription_until = models.DateTimeField(null=True, blank=True)
    grace_until = models.DateTimeField(null=True, blank=True)
    payment_notice_from = models.DateTimeField(null=True, blank=True)
    blocked_at = models.DateTimeField(null=True, blank=True)
    blocked_reason = models.CharField(max_length=255, blank=True, null=True)
    last_payment_at = models.DateTimeField(null=True, blank=True)
    last_payment_method = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f"{self.client_code} - {self.user.username}"


class SupportAccessSession(models.Model):
    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    admin_user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='started_support_sessions')
    platform_client = models.ForeignKey(PlatformClient, on_delete=models.CASCADE, related_name='support_sessions')
    target_user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='targeted_support_sessions')
    reason = models.TextField()
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.CharField(max_length=255, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at', '-id']
        indexes = [
            models.Index(fields=['ended_at', 'expires_at'], name='support_active_idx'),
            models.Index(fields=['admin_user', '-started_at'], name='support_admin_recent_idx'),
            models.Index(fields=['platform_client', '-started_at'], name='support_client_recent_idx'),
            models.Index(fields=['target_user', '-started_at'], name='support_target_recent_idx'),
        ]

    def __str__(self):
        return f"Support {self.admin_user} → {self.platform_client} ({self.started_at:%Y-%m-%d %H:%M})"
