from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Базові сутності'

    def ready(self):
        try:
            from django.urls import path
            import vin_matrix.urls as u
            from .novapost_views import NovaPostDeliveryCreateView
            names = {getattr(x, 'name', None) for x in u.urlpatterns}
            if 'novapost-del