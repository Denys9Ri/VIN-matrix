from datetime import time

from django.conf import settings
from django.db import models


def default_debt_notification_times():
    return ['10:00']


class WebPushVapidKey(models.Model):
    """Single persistent VAPID keypair for the whole VIN Matrix installation."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    private_key = models.TextField()
    public_key = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Web Push VAPID key'
        verbose_name_plural = 'Web Push VAPID keys'

    def __str__(self):
        return 'VIN Matrix Web Push VAPID key'


class WebPushSubscription(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='web_push_subscriptions',
    )
    endpoint = models.URLField(max_length=2048, unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    expiration_time = models.BigIntegerField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default='')
    is_active = models.BooleanField(default=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]
        verbose_name = 'Web Push subscription'
        verbose_name_plural = 'Web Push subscriptions'

    def __str__(self):
        state = 'active' if self.is_active else 'inactive'
        return f'{self.user_id} · {state} · {self.endpoint[:80]}'


class WebPushPreference(models.Model):
    """Per-user choices for operational push categories and delivery schedule."""

    DEBT_DAYS_WEEKDAYS = 'weekdays'
    DEBT_DAYS_DAILY = 'daily'
    DEBT_DAYS_CHOICES = [
        (DEBT_DAYS_WEEKDAYS, 'Понеділок–пʼятниця'),
        (DEBT_DAYS_DAILY, 'Щодня'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='web_push_preferences',
    )
    visit_reminders = models.BooleanField(default=True)
    status_updates = models.BooleanField(default=True)
    payments = models.BooleanField(default=True)
    inventory = models.BooleanField(default=True)
    delivery = models.BooleanField(default=True)
    crm = models.BooleanField(default=True)

    visit_reminder_minutes = models.PositiveSmallIntegerField(default=60)
    debt_schedule_days = models.CharField(max_length=20, choices=DEBT_DAYS_CHOICES, default=DEBT_DAYS_WEEKDAYS)
    debt_notification_times = models.JSONField(default=default_debt_notification_times, blank=True)
    crm_reminder_days_before = models.PositiveSmallIntegerField(default=1)
    crm_notification_time = models.TimeField(default=time(10, 0))
    quiet_hours_enabled = models.BooleanField(default=True)
    quiet_hours_start = models.TimeField(default=time(20, 0))
    quiet_hours_end = models.TimeField(default=time(8, 0))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Web Push preference'
        verbose_name_plural = 'Web Push preferences'

    def __str__(self):
        return f'Push preferences · user {self.user_id}'


class WebPushDispatchLog(models.Model):
    """A durable claim for a scheduled notification so it cannot be sent twice."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='web_push_dispatches',
    )
    event_key = models.CharField(max_length=255)
    category = models.CharField(max_length=40)
    payload = models.JSONField(default=dict, blank=True)
    delivered = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(fields=['user', 'event_key'], name='push_dispatch_user_event_uniq'),
        ]
        indexes = [
            models.Index(fields=['category', 'created_at'], name='push_dispatch_category_idx'),
        ]
        verbose_name = 'Web Push dispatch log'
        verbose_name_plural = 'Web Push dispatch logs'

    def __str__(self):
        return f'{self.user_id} · {self.category} · {self.event_key}'
