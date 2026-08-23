from django.contrib import admin

from .models import WebPushSubscription, WebPushVapidKey


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'is_active', 'last_success_at', 'last_failure_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__username', 'user__email', 'endpoint')
    readonly_fields = ('created_at', 'updated_at', 'last_success_at', 'last_failure_at')


@admin.register(WebPushVapidKey)
class WebPushVapidKeyAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'updated_at')
    readonly_fields = ('private_key', 'public_key', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return not WebPushVapidKey.objects.exists()
