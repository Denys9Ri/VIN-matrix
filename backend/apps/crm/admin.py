from django.contrib import admin

from .models import Car, Client, ServiceCatalog, Visit, VisitItem, VisitService


class CarInline(admin.TabularInline):
    model = Car
    extra = 0


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone_number", "company")
    list_display_links = ("full_name",)
    search_fields = ("full_name", "phone_number")
    list_filter = ("company",)
    autocomplete_fields = ("company",)
    inlines = [CarInline]


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ("plate_number", "make", "model", "year", "client")
    search_fields = ("plate_number", "vin_code", "client__full_name", "client__phone_number")
    list_filter = ("client__company", "make")
    autocomplete_fields = ("client",)


class VisitItemInline(admin.TabularInline):
    model = VisitItem
    extra = 0


class VisitServiceInline(admin.TabularInline):
    model = VisitService
    extra = 0


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("id", "car", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("car__plate_number",)
    autocomplete_fields = ("car",)
    inlines = [VisitItemInline, VisitServiceInline]


@admin.register(ServiceCatalog)
class ServiceCatalogAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "default_price", "is_active")
    list_filter = ("company", "is_active")
    search_fields = ("name", "company__name")
    autocomplete_fields = ("company",)
