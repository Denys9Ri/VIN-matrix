from django.conf import settings
from django.db import models


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
    """Per-user choices for which operational push categories VIN Matrix may send."""

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
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Web Push preference'
        verbose_name_plural = 'Web Push preferences'

    def __str__(self):
        return f'Push preferences · user {self.user_id}'
