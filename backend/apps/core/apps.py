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
            from .db_repair_crm_legacy import repair_crm_legacy_schema
            repair_crm_legacy_schema()
        except Exception as exc:
            print(f"CRM legacy schema check error: {exc}")

        try:
            from .stock_reservations import attach_stock_workflow
            attach_stock_workflow()
        except Exception as exc:
            print(f"Stock reservation workflow startup error: {exc}")
