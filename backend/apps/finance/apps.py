import atexit
import sys

from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finance'
    verbose_name = 'Фінанси'

    def ready(self):
        # The production service still uses the legacy ``python fix_db.py``
        # startup command.  Register the Finance migration for the end of that
        # repair process so core repair/markers are completed first and the
        # next command (collectstatic/gunicorn) never starts with missing
        # finance_* tables.
        from .startup_migrations import (
            is_legacy_fix_db_process,
            migrate_finance_schema_after_legacy_repair,
        )

        if is_legacy_fix_db_process(sys.argv[0] if sys.argv else ''):
            atexit.register(migrate_finance_schema_after_legacy_repair)
