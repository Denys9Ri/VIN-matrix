from django.contrib import admin

from .models import Company, Employee, PlatformClient


@admin.register(PlatformClient)
class PlatformClientAdmin(admin.ModelAdmin):
    list_display = ("client_code", "user", "referred_by", "payment_status", "is_access_enabled")
    list_filter = ("referred_by", "payment_status", "is_access_enabled")
    search_fields = ("client_code", "user__username")
    list_editable = ("is_access_enabled",)
    actions = ["enable_access", "disable_access"]

    @admin.action(description="Надати доступ вибраним")
    def enable_access(self, request, queryset):
        queryset.update(is_access_enabled=True)

    @admin.action(description="Закрити доступ вибраним")
    def disable_access(self, request, queryset):
        queryset.update(is_access_enabled=False)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "business_type", "phone")
    search_fields = ("name", "owner__username", "phone")
    list_filter = ("business_type",)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "partner_code")
    list_filter = ("role",)
