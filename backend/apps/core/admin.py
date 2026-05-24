from django.contrib import admin

from .models import Company, Employee, PlatformClient


@admin.register(PlatformClient)
class PlatformClientAdmin(admin.ModelAdmin):
    """Операційна адмінка для керування клієнтами, оплатами та партнерами."""

    list_display = (
        "user",
        "client_code",
        "assigned_owner",
        "referred_by",
        "payment_status",
        "is_access_enabled",
        "created_at",
    )
    list_filter = ("payment_status", "is_access_enabled", "referred_by", "assigned_owner")
    search_fields = ("user__username", "user__email", "client_code")
    autocomplete_fields = ("user", "assigned_owner", "referred_by")
    list_editable = ("payment_status", "is_access_enabled")
    ordering = ("-created_at",)
    list_select_related = ("user", "assigned_owner", "referred_by")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "business_type", "phone")
    search_fields = ("name", "owner__username", "phone")
    list_filter = ("business_type",)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "company",
        "role",
        "partner_code",
        "can_create_visits",
        "can_view_finances",
    )
    list_filter = ("role", "can_create_visits", "can_view_finances", "company")
    search_fields = ("user__username", "partner_code", "company__name")
    autocomplete_fields = ("user", "company")
