from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Базові сутності'

    def ready(self):
        repair_hooks = [
            ('db_repair', 'repair_database_schema', 'DB repair startup'),
            ('db_repair_stock', 'repair_stock_schema', 'Stock schema check'),
            ('db_repair_payments', 'repair_payment_schema', 'Payment schema check