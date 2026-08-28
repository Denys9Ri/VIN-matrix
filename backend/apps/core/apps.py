from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'

    def ready(self):
        # Register small cross-model automations only after Django has loaded
        # all models. Importing the modules is enough to connect their signals.
        from . import service_catalog_sync  # noqa: F401
        from . import payroll_commissions  # noqa: F401
        from . import visit_part_status_sync  # noqa: F401
