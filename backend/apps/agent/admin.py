from django.contrib import admin

from .models import (
    AgentAuditLog,
    AgentCompanySettings,
    AgentConnectionCode,
    AgentConversation,
    AgentInboundMessage,
    AgentMemberAccess,
    AgentPendingAction,
    AgentUserChannel,
)


@admin.register(AgentCompanySettings)
class AgentCompanySettingsAdmin(admin.ModelAdmin):
    list_display = (
        'company',
        'is_enabled',
        'telegram_enabled',
        'viber_enabled',
        'allow_voice',
        'allow_images',
        'updated_at',
    )
    list_filter = ('is_enabled', 'telegram_enabled', 'viber_enabled')
    search_fields = ('company__name', 'company__owner__username')


@admin.register(AgentMemberAccess)
class AgentMemberAccessAdmin(admin.ModelAdmin):
    list_display = (
        'company',
        'user',
        'is_enabled',
        'can_view_all_visits',
        'can_search_parts',
        'can_add_parts',
        'can_view_finances',
        'updated_at',
    )
    list_filter = ('is_enabled', 'can_view_all_visits', 'can_search_parts', 'can_add_parts', 'can_view_finances')
    search_fields = ('company__name', 'user__username', 'user__first_name', 'user__last_name')


@admin.register(AgentUserChannel)
class AgentUserChannelAdmin(admin.ModelAdmin):
    list_display = (
        'company',
        'user',
        'channel_type',
        'display_name',
        'is_active',
        'linked_at',
        'last_seen_at',
    )
    list_filter = ('channel_type', 'is_active')
    search_fields = ('company__name', 'user__username', 'display_name', 'external_user_id', 'chat_id')


@admin.register(AgentConnectionCode)
class AgentConnectionCodeAdmin(admin.ModelAdmin):
    list_display = ('company', 'user', 'channel_type', 'code', 'expires_at', 'used_at')
    list_filter = ('channel_type',)
    search_fields = ('code', 'user__username')
    readonly_fields = ('created_at',)


@admin.register(AgentConversation)
class AgentConversationAdmin(admin.ModelAdmin):
    list_display = ('company', 'user', 'channel', 'last_message_at', 'expires_at')
    search_fields = ('company__name', 'user__username')
    readonly_fields = ('created_at', 'last_message_at')


@admin.register(AgentInboundMessage)
class AgentInboundMessageAdmin(admin.ModelAdmin):
    list_display = ('channel', 'external_message_id', 'message_type', 'received_at', 'processed_at')
    list_filter = ('message_type',)
    search_fields = ('external_message_id', 'text', 'channel__user__username')
    readonly_fields = ('channel', 'external_message_id', 'message_type', 'text', 'payload', 'received_at', 'processed_at')


@admin.register(AgentPendingAction)
class AgentPendingActionAdmin(admin.ModelAdmin):
    list_display = ('id', 'company', 'user', 'action_type', 'status', 'expires_at', 'created_at')
    list_filter = ('status', 'action_type')
    search_fields = ('company__name', 'user__username', 'summary_text')
    readonly_fields = ('created_at', 'confirmed_at', 'executed_at')


@admin.register(AgentAuditLog)
class AgentAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'company', 'user', 'recognized_intent', 'tool_name', 'success', 'created_at')
    list_filter = ('success', 'tool_name')
    search_fields = ('company__name', 'user__username', 'request_text', 'recognized_intent', 'tool_name')
    readonly_fields = (
        'company', 'user', 'conversation', 'request_text', 'recognized_intent',
        'tool_name', 'tool_input', 'tool_result', 'success', 'error_message', 'created_at',
    )
