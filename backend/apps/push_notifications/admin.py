from django.contrib import admin

from .models import WebPushPreference, WebPushSubscription


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'is_active', 'last_success_at', 'last_failure_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__username', 'user__email', 'endpoint')
    readonly_fields = ('created_at', 'updated_at', 'last_success_at', 'last_failure_at')


@admin.register(WebPushPreference)
class WebPushPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'visit_reminders',
        'status_updates',
        'payments',
        'inventory',
        'delivery',
        'crm',
        'updated_at',
    )
    list_filter = ('visit_reminders', 'status_updates', 'payments', 'inventory', 'delivery', 'crm')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('updated_at',)
