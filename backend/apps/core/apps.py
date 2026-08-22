from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'

    def ready(self):
        # Register small cross-model automations only after Django has loaded
        # all models. Importing the module is enough to connect its signals.
        from . import service_catalog_sync  # noqa: F401
