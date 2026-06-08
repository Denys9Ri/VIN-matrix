from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Базові сутності'

    def ready(self):
        try:
            from .db_repair import repair_database_schema
            repair_database_schema()
        except Exception as exc:
            print(f"DB repair startup error: {exc}")

        try:
            from .db_repair_stock import repair_stock_schema
            repair_stock_schema()
        except Exception as exc:
            print(f"Stock schema check error: {exc}")

        try:
            from .db_repair_payments import repair_payment_schema
            repair_payment_schema()
        except Exception as exc:
            print(f"Payment schema check error: {exc}")

        try:
            from .db_repair_activity import repair_activity_schema
            repair_activity_schema()
        except Exception as exc:
            print(f"Activity schema check error: {exc}")

        try:
            from .db_repair_options import repair_options_schema
            repair_options_schema()
        except Exception as exc:
            print(f"CompanyOption schema check error: {exc}")

        try:
            from .db_repair_crm_legacy import repair_crm_legacy_schema
            repair_crm_legacy_schema()
        except Exception as exc:
            print(f"CRM legacy schema check error: {exc}")

        try:
            from .db_repair_novapost import repair_novapost_schema
            repair_novapost_schema()
        except Exception as exc:
            print(f"NovaPost schema check error: {exc}")

        try:
            from .stock_reservations import attach_stock_workflow
            attach_stock_workflow()
        except Exception as exc:
            print(f"Stock reservation workflow startup error: {exc}")

        try:
            from django.urls import path
            from .client_link_views import AdminClientLinkSettingsView, ClientLinkSettingsView
            from .novapost_views import NovaPostProfileDetailView, NovaPostProfileListCreateView, NovaPostProfileTestView
            import vin_matrix.urls as root_urls
            names = {getattr(item, 'name', None) for item in root_urls.urlpatterns}
            if 'billing-client-link' not in names:
                root_urls.urlpatterns.insert(70, path('api/billing/client-link/', ClientLinkSettingsView.as_view(), name='billing-client-link'))
            if 'billing-admin-client-link' not in names:
                root_urls.urlpatterns.insert(71, path('api/billing/admin/client-link/', AdminClientLinkSettingsView.as_view(), name='billing-admin-client-link'))
            if 'novapost-profile-list' not in names:
                root_urls.urlpatterns.insert(72, path('api/delivery/novapost/profiles/', NovaPostProfileListCreateView.as_view(), name='novapost-profile-list'))
            if 'novapost-profile-detail' not in names:
                root_urls.urlpatterns.insert(73, path('api/delivery/novapost/profiles/<int:pk>/', NovaPostProfileDetailView.as_view(), name='novapost-profile-detail'))
            if 'novapost-profile-test' not in names:
                root_urls.urlpatterns.insert(74, path('api/delivery/novapost/profiles/<int:pk>/test/', NovaPostProfileTestView.as_view(), name='novapost-profile-test'))
        except Exception as exc:
            print(f"Dynamic route attach error: {exc}")