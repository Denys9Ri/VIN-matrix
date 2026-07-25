import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .defaults import ALLOWED_FIELD_RULES, default_landing_config


class LandingGrowthSettings(models.Model):
    MODE_OBSERVE = 'observe'
    MODE_RECOMMEND = 'recommend'
    MODE_SAFE_AUTOPILOT = 'safe_autopilot'
    MODE_CHOICES = [
        (MODE_OBSERVE, 'Спостереження'),
        (MODE_RECOMMEND, 'Рекомендації'),
        (MODE_SAFE_AUTOPILOT, 'Безпечний автопілот'),
    ]

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    mode = models.CharField(max_length=24, choices=MODE_CHOICES, default=MODE_SAFE_AUTOPILOT)
    active_config = models.JSONField(default=default_landing_config)
    config_version = models.PositiveIntegerField(default=1)
    openai_enabled = models.BooleanField(default=True)
    auto_apply_low_risk = models.BooleanField(default=True)
    auto_apply_seo = models.BooleanField(default=True)
    daily_openai_limit = models.PositiveSmallIntegerField(default=1)
    monthly_openai_limit = models.PositiveSmallIntegerField(default=20)
    min_baseline_sessions = models.PositiveIntegerField(default=120)
    min_sessions_per_arm = models.PositiveIntegerField(default=100)
    min_conversions_total = models.PositiveIntegerField(default=12)
    experiment_max_days = models.PositiveSmallIntegerField(default=21)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Налаштування Growth Engine'
        verbose_name_plural = 'Налаштування Growth Engine'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f'Growth Engine · {self.get_mode_display()} · v{self.config_version}'


class LandingExperiment(models.Model):
    KIND_CONVERSION = 'conversion'
    KIND_SEO = 'seo_sequential'
    KIND_CHOICES = [(KIND_CONVERSION, 'A/B конверсія'), (KIND_SEO, 'Послідовний SEO-тест')]

    STATUS_DRAFT = 'draft'
    STATUS_RUNNING = 'running'
    STATUS_WON = 'won'
    STATUS_LOST = 'lost'
    STATUS_INCONCLUSIVE = 'inconclusive'
    STATUS_PAUSED = 'paused'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Чернетка'),
        (STATUS_RUNNING, 'Виконується'),
        (STATUS_WON, 'Переміг варіант'),
        (STATUS_LOST, 'Переміг контроль'),
        (STATUS_INCONCLUSIVE, 'Недостатньо даних'),
        (STATUS_PAUSED, 'Призупинено'),
    ]

    RISK_LOW = 'low'
    RISK_MEDIUM = 'medium'
    RISK_CHOICES = [(RISK_LOW, 'Низький'), (RISK_MEDIUM, 'Середній')]

    SOURCE_RULE = 'rule'
    SOURCE_OPENAI = 'openai'
    SOURCE_MANUAL = 'manual'
    SOURCE_CHOICES = [(SOURCE_RULE, 'Правило'), (SOURCE_OPENAI, 'OpenAI'), (SOURCE_MANUAL, 'Вручну')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180)
    kind = models.CharField(max_length=24, choices=KIND_CHOICES, default=KIND_CONVERSION)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    block_key = models.CharField(max_length=40)
    field_path = models.CharField(max_length=80)
    metric_name = models.CharField(max_length=64)
    control_value = models.TextField()
    variant_value = models.TextField()
    allocation_percentage = models.PositiveSmallIntegerField(default=50)
    minimum_relative_lift = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.0500'))
    confidence_threshold = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.9500'))
    min_sessions_per_arm = models.PositiveIntegerField(default=100)
    min_conversions_total = models.PositiveIntegerField(default=12)
    max_days = models.PositiveSmallIntegerField(default=21)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_RULE)
    risk_level = models.CharField(max_length=12, choices=RISK_CHOICES, default=RISK_LOW)
    rationale = models.TextField(blank=True)
    baseline = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='lg_exp_status_created'),
            models.Index(fields=['field_path', 'status'], name='lg_exp_field_status'),
        ]

    def clean(self):
        if self.field_path not in ALLOWED_FIELD_RULES:
            raise ValidationError({'field_path': 'Поле не дозволене для автоматичних експериментів.'})
        if not 1 <= self.allocation_percentage <= 99:
            raise ValidationError({'allocation_percentage': 'Розподіл має бути від 1 до 99%.'})
        rule = ALLOWED_FIELD_RULES[self.field_path]
        value = (self.variant_value or '').strip()
        if not rule['min'] <= len(value) <= rule['max']:
            raise ValidationError({'variant_value': f'Довжина має бути {rule["min"]}–{rule["max"]} символів.'})

    def start(self):
        if LandingExperiment.objects.filter(status=self.STATUS_RUNNING).exclude(pk=self.pk).exists():
            raise ValidationError('Одночасно може виконуватися лише один експеримент.')
        self.status = self.STATUS_RUNNING
        self.started_at = timezone.now()
        self.ended_at = None
        self.save(update_fields=['status', 'started_at', 'ended_at', 'updated_at'])

    def __str__(self):
        return f'{self.name} · {self.get_status_display()}'


class LandingEvent(models.Model):
    VARIANT_CONTROL = 'control'
    VARIANT_TEST = 'variant'
    VARIANT_NONE = 'none'
    VARIANT_CHOICES = [(VARIANT_CONTROL, 'Контроль'), (VARIANT_TEST, 'Варіант'), (VARIANT_NONE, 'Без експерименту')]

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    session_hash = models.CharField(max_length=64, db_index=True)
    event_name = models.CharField(max_length=64, db_index=True)
    page_path = models.CharField(max_length=200, default='/')
    block_key = models.CharField(max_length=40, blank=True)
    experiment = models.ForeignKey(LandingExperiment, null=True, blank=True, on_delete=models.SET_NULL, related_name='events')
    variant = models.CharField(max_length=12, choices=VARIANT_CHOICES, default=VARIANT_NONE, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']
        indexes = [
            models.Index(fields=['experiment', 'variant', 'event_name'], name='lg_evt_exp_variant_name'),
            models.Index(fields=['occurred_at', 'event_name'], name='lg_evt_time_name'),
        ]

    def __str__(self):
        return f'{self.event_name} · {self.variant} · {self.occurred_at:%Y-%m-%d %H:%M}'


class LandingSearchMetric(models.Model):
    date = models.DateField(db_index=True)
    query = models.CharField(max_length=500, blank=True)
    page = models.URLField(max_length=600)
    device = models.CharField(max_length=24, blank=True)
    clicks = models.FloatField(default=0)
    impressions = models.FloatField(default=0)
    ctr = models.FloatField(default=0)
    position = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['date', 'query', 'page', 'device'], name='lg_unique_search_metric')]
        indexes = [models.Index(fields=['page', 'date'], name='lg_search_page_date')]

    def __str__(self):
        return f'{self.date} · {self.query or "(all)"} · {self.impressions:.0f} impressions'


class LandingAnalyticsMetric(models.Model):
    date = models.DateField(db_index=True)
    event_name = models.CharField(max_length=80)
    source_medium = models.CharField(max_length=200, blank=True)
    event_count = models.FloatField(default=0)
    total_users = models.FloatField(default=0)
    sessions = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['date', 'event_name', 'source_medium'], name='lg_unique_analytics_metric')]
        indexes = [models.Index(fields=['event_name', 'date'], name='lg_analytics_event_date')]

    def __str__(self):
        return f'{self.date} · {self.event_name} · {self.event_count:.0f}'


class LandingProposal(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_EXPERIMENT = 'experiment_created'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [(STATUS_PENDING, 'Очікує'), (STATUS_EXPERIMENT, 'Експеримент створено'), (STATUS_REJECTED, 'Відхилено')]

    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    field_path = models.CharField(max_length=80)
    proposed_value = models.TextField()
    metric_name = models.CharField(max_length=64)
    rationale = models.TextField()
    evidence = models.JSONField(default=dict, blank=True)
    source = models.CharField(max_length=20, choices=LandingExperiment.SOURCE_CHOICES)
    risk_level = models.CharField(max_length=12, choices=LandingExperiment.RISK_CHOICES)
    ai_model = models.CharField(max_length=80, blank=True)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    rejection_reason = models.TextField(blank=True)
    experiment = models.ForeignKey(LandingExperiment, null=True, blank=True, on_delete=models.SET_NULL, related_name='proposals')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.field_path} · {self.get_status_display()}'


class LandingChangeLog(models.Model):
    ACTION_APPLY = 'apply'
    ACTION_ROLLBACK = 'rollback'
    ACTION_DEPLOY = 'deploy'
    ACTION_CHOICES = [(ACTION_APPLY, 'Застосовано'), (ACTION_ROLLBACK, 'Відкочено'), (ACTION_DEPLOY, 'Deploy')]

    action = models.CharField(max_length=16, choices=ACTION_CHOICES)
    field_path = models.CharField(max_length=80, blank=True)
    before_value = models.TextField(blank=True)
    after_value = models.TextField(blank=True)
    config_version = models.PositiveIntegerField(default=1)
    experiment = models.ForeignKey(LandingExperiment, null=True, blank=True, on_delete=models.SET_NULL)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_action_display()} · {self.field_path or "system"} · v{self.config_version}'


class LandingSyncRun(models.Model):
    SOURCE_SEARCH_CONSOLE = 'search_console'
    SOURCE_GA4 = 'ga4'
    SOURCE_INTERNAL = 'internal'
    SOURCE_ENGINE = 'engine'
    SOURCE_DEPLOY = 'deploy'
    SOURCE_CHOICES = [
        (SOURCE_SEARCH_CONSOLE, 'Search Console'),
        (SOURCE_GA4, 'GA4'),
        (SOURCE_INTERNAL, 'Внутрішні події'),
        (SOURCE_ENGINE, 'Growth Engine'),
        (SOURCE_DEPLOY, 'Deploy'),
    ]
    STATUS_RUNNING = 'running'
    STATUS_SUCCESS = 'success'
    STATUS_SKIPPED = 'skipped'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [(STATUS_RUNNING, 'Виконується'), (STATUS_SUCCESS, 'Успішно'), (STATUS_SKIPPED, 'Пропущено'), (STATUS_FAILED, 'Помилка')]

    source = models.CharField(max_length=24, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_RUNNING)
    records_processed = models.PositiveIntegerField(default=0)
    details = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def finish(self, status, *, records=0, details=None, error=''):
        self.status = status
        self.records_processed = records
        self.details = details or {}
        self.error = error
        self.finished_at = timezone.now()
        self.save(update_fields=['status', 'records_processed', 'details', 'error', 'finished_at'])

    def __str__(self):
        return f'{self.get_source_display()} · {self.get_status_display()}'


class LandingAIUsage(models.Model):
    date = models.DateField(unique=True)
    calls = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.date} · {self.calls} calls'
