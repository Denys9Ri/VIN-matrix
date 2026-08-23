from django.contrib import admin

from .models import WebPushSubscription


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'is_active', 'last_success_at', 'last_failure_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__username', 'user__email', 'endpoint')
    readonly_fields = ('created_at', 'updated_at', 'last_success_at', 'last_failure_at')
