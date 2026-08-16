import os

from django.core.management import call_command
from django.db import connection


REQUIRED_FINANCE_TABLES = {
    'finance_legalentity',
    'finance_financeaccount',
    'finance_visitfinanceassignment',
    'finance_financetransaction',
    'finance_financesourceallocation',
    'finance_financechangelog',
}


def is_legacy_fix_db_process(argv0):
    return os.path.basename(str(argv0 or '')) == 'fix_db.py'


def migrate_finance_schema_after_legacy_repair():
    """Apply Finance migrations for the legacy production startup path.

    Production currently runs ``python fix_db.py`` before Gunicorn.  That
    legacy repair script predates the Finance Django app, so without this
    hook the code can be deployed while the ``finance_*`` tables are absent.

    This function intentionally runs *after* fix_db.py has finished (it is
    registered through ``atexit`` in FinanceConfig.ready), so the existing
    core schema repair and migration markers are in place before Django
    applies the Finance migration.
    """

    print('🔧 Перевіряємо міграції модуля Фінанси...', flush=True)
    call_command('migrate', 'finance', interactive=False, verbosity=1)

    existing_tables = set(connection.introspection.table_names())
    missing_tables = sorted(REQUIRED_FINANCE_TABLES - existing_tables)
    if missing_tables:
        raise RuntimeError(
            'Finance migration завершилась, але відсутні таблиці: '
            + ', '.join(missing_tables)
        )

    print('✅ Таблиці модуля Фінанси PostgreSQL ОК', flush=True)
