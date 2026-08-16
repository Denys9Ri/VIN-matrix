from django.conf import settings
from django.db import models


class LegalEntity(models.Model):
    TYPE_FOP = 'fop'
    TYPE_TOV = 'tov'
    TYPE_OTHER = 'other'
    TYPE_CHOICES = [
        (TYPE_FOP, 'ФОП'),
        (TYPE_TOV, 'ТОВ'),
        (TYPE_OTHER, 'Інша юрособа'),
    ]

    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_legal_entities')
    entity_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_FOP)
    name = models.CharField(max_length=255)
    tax_id = models.CharField(max_length=32, blank=True, default='')
    registration_code = models.CharField(max_length=32, blank=True, default='')
    iban = models.CharField(max_length=64, blank=True, default='')
    bank_name = models.CharField(max_length=255, blank=True, default='')
    requisites = models.TextField(blank=True, default='')
    is_primary = models.BooleanField(default=False)
    is_default_for_parts = models.BooleanField(default=False)
    is_default_for_services = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-is_primary', 'name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['company', 'name'], name='finance_entity_company_name_uniq'),
        ]
        indexes = [
            models.Index(fields=['company', 'is_active', 'sort_order'], name='finance_entity_active_idx'),
            models.Index(fields=['company', 'is_primary'], name='finance_entity_primary_idx'),
        ]

    def __str__(self):
        return f'{self.get_entity_type_display()} {self.name}'


class SupplierAccountBinding(models.Model):
    """Maps a supplier API/login account to the legal entity that owns it.

    SupplierAccount remains a technical connection in the core app.  The FOP/TOV
    ownership is finance data and therefore lives here instead of duplicating
    legal entities in supplier settings.
    """

    company = models.ForeignKey(
        'core.Company',
        on_delete=models.CASCADE,
        related_name='finance_supplier_account_bindings',
    )
    supplier = models.ForeignKey(
        'core.Supplier',
        on_delete=models.CASCADE,
        related_name='finance_account_bindings',
    )
    supplier_account = models.OneToOneField(
        'core.SupplierAccount',
        on_delete=models.CASCADE,
        related_name='finance_binding',
    )
    legal_entity = models.ForeignKey(
        LegalEntity,
        on_delete=models.CASCADE,
        related_name='supplier_account_bindings',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['supplier_id', 'legal_entity_id', 'supplier_account_id']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'supplier', 'legal_entity'],
                name='finance_supplier_entity_account_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['company', 'supplier', 'legal_entity'],
                name='finance_supacc_binding_lookup_idx',
            ),
        ]

    def __str__(self):
        return f'{self.supplier} · {self.legal_entity} → {self.supplier_account}'


class FinanceAccount(models.Model):
    TYPE_CASH = 'cash'
    TYPE_BANK = 'bank'
    TYPE_CARD = 'card'
    TYPE_TERMINAL = 'terminal'
    TYPE_OTHER = 'other'
    TYPE_CHOICES = [
        (TYPE_CASH, 'Готівка / каса'),
        (TYPE_BANK, 'Банківський рахунок'),
        (TYPE_CARD, 'Картка'),
        (TYPE_TERMINAL, 'Термінал'),
        (TYPE_OTHER, 'Інше'),
    ]

    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_accounts')
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.SET_NULL, null=True, blank=True, related_name='accounts')
    name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_CASH)
    currency = models.CharField(max_length=8, default='UAH')
    iban = models.CharField(max_length=64, blank=True, default='')
    bank_name = models.CharField(max_length=255, blank=True, default='')
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-is_primary', 'name', 'id']
        constraints = [
            models.UniqueConstraint(fields=['company', 'legal_entity', 'name'], name='finance_account_scope_name_uniq'),
        ]
        indexes = [
            models.Index(fields=['company', 'is_active', 'account_type'], name='finance_account_active_idx'),
            models.Index(fields=['legal_entity', 'is_active'], name='finance_account_entity_idx'),
        ]

    def __str__(self):
        owner = self.legal_entity.name if self.legal_entity_id else self.company.name
        return f'{owner} — {self.name}'


class VisitFinanceAssignment(models.Model):
    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_visit_assignments')
    visit = models.OneToOneField('core.Visit', on_delete=models.CASCADE, related_name='finance_assignment')
    parts_legal_entity = models.ForeignKey(
        LegalEntity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parts_visit_assignments',
    )
    services_legal_entity = models.ForeignKey(
        LegalEntity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='services_visit_assignments',
    )
    note = models.TextField(blank=True, default='')
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_finance_visit_assignments',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [models.Index(fields=['company', 'updated_at'], name='finance_visit_assign_idx')]

    def __str__(self):
        return f'Візит #{self.visit_id}'


class FinanceSourceAllocation(models.Model):
    SOURCE_VISIT_PAYMENT = 'visit_payment'
    SOURCE_EXPENSE = 'expense'
    SOURCE_CHOICES = [
        (SOURCE_VISIT_PAYMENT, 'Оплата замовлення'),
        (SOURCE_EXPENSE, 'Витрата СТО'),
    ]

    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_source_allocations')
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES)
    source_id = models.BigIntegerField()
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.PROTECT, related_name='source_allocations')
    account = models.ForeignKey(FinanceAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_allocations')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_finance_source_allocations',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_finance_source_allocations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['source_type', 'source_id', 'id']
        indexes = [
            models.Index(fields=['company', 'source_type', 'source_id'], name='finance_source_lookup_idx'),
            models.Index(fields=['company', 'legal_entity'], name='finance_source_entity_idx'),
            models.Index(fields=['company', 'account'], name='finance_source_account_idx'),
        ]

    def __str__(self):
        return f'{self.source_type}:{self.source_id} — {self.amount}'


class FinanceTransaction(models.Model):
    KIND_INCOME = 'income'
    KIND_EXPENSE = 'expense'
    KIND_TRANSFER = 'transfer'
    KIND_CHOICES = [
        (KIND_INCOME, 'Надходження'),
        (KIND_EXPENSE, 'Витрата'),
        (KIND_TRANSFER, 'Переказ'),
    ]

    SOURCE_MANUAL = 'manual'
    SOURCE_SALARY = 'salary'
    SOURCE_SUPPLIER = 'supplier'
    SOURCE_REFUND = 'refund'
    SOURCE_OWNER = 'owner'
    SOURCE_TAX = 'tax'
    SOURCE_ADJUSTMENT = 'adjustment'
    SOURCE_OTHER = 'other'
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, 'Ручна операція'),
        (SOURCE_SALARY, 'Виплата зарплати'),
        (SOURCE_SUPPLIER, 'Оплата постачальнику'),
        (SOURCE_REFUND, 'Повернення'),
        (SOURCE_OWNER, 'Внесення / вилучення власника'),
        (SOURCE_TAX, 'Податки'),
        (SOURCE_ADJUSTMENT, 'Коригування'),
        (SOURCE_OTHER, 'Інше'),
    ]

    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_transactions')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    source_type = models.CharField(max_length=30, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    occurred_at = models.DateTimeField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    account = models.ForeignKey(FinanceAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    target_account = models.ForeignKey(
        FinanceAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incoming_transfers',
    )
    category = models.CharField(max_length=80, blank=True, default='other')
    title = models.CharField(max_length=255)
    counterparty = models.CharField(max_length=255, blank=True, default='')
    employee = models.ForeignKey('core.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='finance_payouts')
    supplier = models.ForeignKey('core.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='finance_payments')
    payment_method = models.CharField(max_length=40, blank=True, default='')
    comment = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_finance_transactions',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_finance_transactions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        indexes = [
            models.Index(fields=['company', 'occurred_at'], name='finance_tx_company_date_idx'),
            models.Index(fields=['company', 'kind', 'occurred_at'], name='finance_tx_kind_date_idx'),
            models.Index(fields=['company', 'legal_entity', 'occurred_at'], name='finance_tx_entity_date_idx'),
            models.Index(fields=['company', 'account', 'occurred_at'], name='finance_tx_account_date_idx'),
            models.Index(fields=['company', 'source_type', 'occurred_at'], name='finance_tx_source_date_idx'),
        ]

    def __str__(self):
        return f'{self.get_kind_display()} — {self.title} — {self.amount}'


class FinanceChangeLog(models.Model):
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_DELETE = 'delete'
    ACTION_CHOICES = [
        (ACTION_CREATE, 'Створено'),
        (ACTION_UPDATE, 'Змінено'),
        (ACTION_DELETE, 'Видалено / деактивовано'),
    ]

    company = models.ForeignKey('core.Company', on_delete=models.CASCADE, related_name='finance_change_log')
    object_type = models.CharField(max_length=50)
    object_id = models.CharField(max_length=80)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True, default='')
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finance_changes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['company', 'created_at'], name='finance_change_company_idx'),
            models.Index(fields=['company', 'object_type', 'object_id'], name='finance_change_object_idx'),
        ]

    def __str__(self):
        return f'{self.object_type}:{self.object_id} — {self.action}'
