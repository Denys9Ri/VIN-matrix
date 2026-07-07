from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import Company


class AgentCompanySettings(models.Model):
    """Company-level controls for VIN-matrix Agent."""

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_settings',
    )
    is_enabled = models.BooleanField(default=False)
    telegram_enabled = models.BooleanField(default=False)
    viber_enabled = models.BooleanField(default=False)
    allow_voice = models.BooleanField(default=True)
    allow_images = models.BooleanField(default=True)
    require_confirmation_for_writes = models.BooleanField(default=False)
    monthly_action_limit = models.PositiveIntegerField(
        default=0,
        help_text='0 means no product-level limit.',
    )
    default_visit_duration_minutes = models.PositiveIntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Agent settings: {self.company.name}'


class AgentMemberAccess(models.Model):
    """Explicit Agent permissions for each company member.

    Existing CRM permissions are not changed. This model only limits what the
    messenger Agent may expose or execute.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_member_accesses',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_member_accesses',
    )
    is_enabled = models.BooleanField(default=True)
    can_view_all_visits = models.BooleanField(default=False)
    can_view_client_phone = models.BooleanField(default=False)
    can_create_visits = models.BooleanField(default=False)
    can_update_visits = models.BooleanField(default=False)
    can_search_parts = models.BooleanField(default=True)
    can_add_parts = models.BooleanField(default=False)
    can_view_finances = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'user'],
                name='agent_unique_company_member_access',
            ),
        ]
        indexes = [
            models.Index(fields=['company', 'is_enabled']),
        ]

    def __str__(self):
        return f'Agent access: {self.company.name} / {self.user}'


class AgentUserChannel(models.Model):
    CHANNEL_TELEGRAM = 'telegram'
    CHANNEL_VIBER = 'viber'
    CHANNEL_CHOICES = [
        (CHANNEL_TELEGRAM, 'Telegram'),
        (CHANNEL_VIBER, 'Viber'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_channels',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_channels',
    )
    channel_type = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    external_user_id = models.CharField(max_length=120)
    chat_id = models.CharField(max_length=120)
    display_name = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    linked_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['channel_type', 'external_user_id'],
                name='agent_unique_external_user_channel',
            ),
            models.UniqueConstraint(
                fields=['user', 'channel_type'],
                name='agent_unique_user_channel',
            ),
        ]
        indexes = [
            models.Index(fields=['company', 'channel_type', 'is_active']),
            models.Index(fields=['channel_type', 'chat_id']),
        ]

    def touch(self):
        self.last_seen_at = timezone.now()
        self.save(update_fields=['last_seen_at'])

    def __str__(self):
        return f'{self.user} via {self.channel_type}'


class AgentConnectionCode(models.Model):
    """Single-use code generated in the web app to link a messenger account."""

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_connection_codes',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_connection_codes',
    )
    channel_type = models.CharField(
        max_length=20,
        choices=AgentUserChannel.CHANNEL_CHOICES,
    )
    code = models.CharField(max_length=32, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['code', 'expires_at']),
        ]

    @property
    def is_usable(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f'{self.user} / {self.channel_type} / {self.code}'


class AgentConversation(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_conversations',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_conversations',
    )
    channel = models.OneToOneField(
        AgentUserChannel,
        on_delete=models.CASCADE,
        related_name='conversation',
    )
    context = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_message_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['company', 'user', 'last_message_at']),
        ]

    def __str__(self):
        return f'Conversation: {self.channel}'


class AgentInboundMessage(models.Model):
    """Deduplicates retries from messenger providers before a tool is executed."""

    channel = models.ForeignKey(
        AgentUserChannel,
        on_delete=models.CASCADE,
        related_name='inbound_messages',
    )
    external_message_id = models.CharField(max_length=120)
    message_type = models.CharField(max_length=30, default='text')
    text = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['channel', 'external_message_id'],
                name='agent_unique_channel_message',
            ),
        ]
        indexes = [
            models.Index(fields=['received_at']),
        ]

    def __str__(self):
        return f'{self.channel} / {self.external_message_id}'


class AgentPendingAction(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_EXPIRED = 'expired'
    STATUS_FAILED = 'failed'
    STATUS_EXECUTED = 'executed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Очікує підтвердження'),
        (STATUS_CONFIRMED, 'Підтверджено'),
        (STATUS_CANCELLED, 'Скасовано'),
        (STATUS_EXPIRED, 'Прострочено'),
        (STATUS_FAILED, 'Помилка'),
        (STATUS_EXECUTED, 'Виконано'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_pending_actions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agent_pending_actions',
    )
    conversation = models.ForeignKey(
        AgentConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pending_actions',
    )
    action_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    summary_text = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    expires_at = models.DateTimeField()
    confirmed_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['company', 'user', 'status', 'expires_at']),
            models.Index(fields=['status', 'expires_at']),
        ]

    @property
    def is_confirmable(self):
        return self.status == self.STATUS_PENDING and self.expires_at > timezone.now()

    def __str__(self):
        return f'{self.action_type} / {self.status}'


class AgentAuditLog(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='agent_audit_logs',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_audit_logs',
    )
    conversation = models.ForeignKey(
        AgentConversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    request_text = models.TextField(blank=True)
    recognized_intent = models.CharField(max_length=120, blank=True)
    tool_name = models.CharField(max_length=120, blank=True)
    tool_input = models.JSONField(default=dict, blank=True)
    tool_result = models.JSONField(default=dict, blank=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['company', 'created_at']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['tool_name', 'created_at']),
        ]

    def __str__(self):
        return f'{self.company.name}: {self.tool_name or self.recognized_intent}'
