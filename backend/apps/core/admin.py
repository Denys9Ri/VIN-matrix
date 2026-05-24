from django.contrib import admin

from .models import Company, Employee, PlatformClient


@admin.register(PlatformClient)
class PlatformClientAdmin(admin.ModelAdmin):
    list_display = ("client_code", "get_full_name", "referred_by", "payment_status", "is_active_status")
    list_filter = ("referred_by", "payment_status")
    search_fields = ("client_code", "user__username")
    list_editable = ("payment_status",)
    actions = ["block_users", "unblock_users"]

    def is_active_status(self, obj):
        return obj.user.is_active
    is_active_status.boolean = True
    is_active_status.short_description = "Активний"

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()
    get_full_name.short_description = "ПІБ"

    @admin.action(description="Заблокувати обраних")
    def block_users(self, request, queryset):
        for client in queryset:
            client.user.is_active = False
            client.user.save(update_fields=["is_active"])

    @admin.action(description="Розблокувати обраних")
    def unblock_users(self, request, queryset):
        for client in queryset:
            client.user.is_active = True
            client.user.save(update_fields=["is_active"])


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "business_type", "phone")
    search_fields = ("name", "owner__username", "phone")
    list_filter = ("business_type",)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "partner_code")
    list_filter = ("role",)
