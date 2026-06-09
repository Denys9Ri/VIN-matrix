from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Базові сутності'

    def ready(self):
        try:
            from django.urls import path
            import vin_matrix.urls as root_urls
            from .novapost_views import NovaPostCitiesView, NovaPostDeliveryCreateView, NovaPostDeliveryStatusView, NovaPostDeliveryView, NovaPostProfileDetailView, NovaPostProfileListCreateView, NovaPostProfileTestView, NovaPostWarehousesView