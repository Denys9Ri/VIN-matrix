import os

from django.core.management import call_command
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder


FINANCE_INITIAL_MIGRATION = '0001_initial'
FINANCE_LATEST_MIGRATION = '0002_supplier_account_binding'
CORE_SUPPORT_ACCESS_MIGRATION = '0007_supportaccesssession'
CORE_COMPANY_PHONES_MIGRATION = '0008_company_phones'
CORE_SUPPLIER_ACCOUNTS_MIGRATION = '0009_supplier_accounts'
INITIAL_FINANCE_TABLES = {
    'finance_legalentity',
    'finance_financeaccount',
    'finance_visitfinanceassignment',
    'finance_financetransaction',
    'finance_financesourceallocation',
    'finance_financechangelog',
}
REQUIRED_FINANCE_TABLES = {
    *INITIAL_FINANCE_TABLES,
    'finance_supplieraccountbinding',
}


def is_legacy_fix_db_process(argv0):
    return os.path.basename(str(argv0 or '')) == 'fix_db.py'


def _existing_tables():
    return set(connection.introspection.table_names())


def _table_columns(table_name):
    with connection.cursor() as cursor:
        return {
            column.name
            for column in connection.introspection.get_table_description(cursor, table_name)
        }


def _repair_legacy_core_migration_history(recorder, applied, existing_tables):
    """Repair one known legacy migration-history gap without touching data.

    ``fix_db.py`` historically created the schema introduced by
    core.0008/core.0009 itself and later inserted the core.0009 migration
    marker. Some production databases therefore have 0009 recorded while its
    dependency 0008 is missing from django_migrations. Django correctly
    refuses to run any later migration in that state.

    Restore the missing 0008 marker only when all safety conditions prove that
    0008 is physically present: its dependency 0007 is already recorded,
    core_company exists, and the ``phones`` column created by 0008 exists.
    No table, column, or business data is modified here.
    """

    migration_0007 = ('core', CORE_SUPPORT_ACCESS_MIGRATION)
    migration_0008 = ('core', CORE_COMPANY_PHONES_MIGRATION)
    migration_0009 = ('core', CORE_SUPPLIER_ACCOUNTS_MIGRATION)

    if migration_0009 not in applied or migration_0008 in applied:
        return applied

    if migration_0007 not in applied:
        raise RuntimeError(
            'Історія міграцій core пошкоджена: core.0009 позначена як '
            'виконана, але відсутні core.0008 та її залежність core.0007. '
            'Автоматичне виправлення зупинено.'
        )

    if 'core_company' not in existing_tables:
        raise RuntimeError(
            'Не можна відновити marker core.0008_company_phones: '
            'таблиця core_company відсутня.'
        )

    company_columns = _table_columns('core_company')
    if 'phones' not in company_columns:
        raise RuntimeError(
            'Не можна відновити marker core.0008_company_phones: '
            'у core_company немає колонки phones.'
        )

    recorder.record_applied('core', CORE_COMPANY_PHONES_MIGRATION)
    print(
        '✅ Відновлено пропущений marker core.0008_company_phones '
        '(структура PostgreSQL вже існувала)',
        flush=True,
    )
    return {*applied, migration_0008}


def migrate_finance_schema_after_legacy_repair():
    """Ensure every Finance migration exists before the application starts."""

    print('🔧 Перевіряємо міграції модуля Фінанси...', flush=True)

    existing_before = _existing_tables()
    initial_present = INITIAL_FINANCE_TABLES & existing_before
    initial_missing = INITIAL_FINANCE_TABLES - existing_before

    # A normal upgrade from 0001 to 0002 has all initial tables and only the
    # new binding table missing.  Reject only a genuinely partial 0001 schema.
    if initial_missing and initial_present:
        raise RuntimeError(
            'Виявлено частково створену початкову схему Finance. '
            'Автоматичний запуск зупинено, щоб не пошкодити фінансові дані. '
            'Є таблиці: '
            + ', '.join(sorted(initial_present))
            + '; відсутні: '
            + ', '.join(sorted(initial_missing))
        )

    if 'finance_supplieraccountbinding' in existing_before and not initial_present:
        raise RuntimeError(
            'Виявлено таблицю привʼязок постачальників без початкової схеми '
            'Finance. Автоматичне виправлення зупинено.'
        )

    recorder = MigrationRecorder(connection)
    applied = recorder.applied_migrations()
    applied = _repair_legacy_core_migration_history(
        recorder,
        applied,
        existing_before,
    )
    initial_is_recorded = ('finance', FINANCE_INITIAL_MIGRATION) in applied

    if initial_is_recorded and not initial_present:
        print(
            '⚠️ Знайдено запис finance.0001_initial без таблиць. '
            'Відновлюємо стан міграцій...',
            flush=True,
        )
        recorder.migration_qs.filter(
            app='finance',
            name=FINANCE_INITIAL_MIGRATION,
        ).delete()

    call_command(
        'migrate',
        'finance',
        FINANCE_LATEST_MIGRATION,
        interactive=False,
        verbosity=1,
        fake_initial=True,
    )

    existing_after = _existing_tables()
    missing_after = sorted(REQUIRED_FINANCE_TABLES - existing_after)
    if missing_after:
        raise RuntimeError(
            'Finance migration завершилась, але відсутні таблиці: '
            + ', '.join(missing_after)
        )

    # The old runtime repair can recreate a renamed/deleted «Основний акаунт».
    # Remove only exact credential duplicates; a sole legacy account is kept.
    from .supplier_bindings import cleanup_runtime_legacy_supplier_account_duplicates
    cleanup_runtime_legacy_supplier_account_duplicates()

    print('✅ Таблиці модуля Фінанси PostgreSQL ОК', flush=True)
