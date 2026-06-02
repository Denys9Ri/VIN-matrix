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
