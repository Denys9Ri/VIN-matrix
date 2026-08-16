import os

from django.core.management import call_command
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder


FINANCE_INITIAL_MIGRATION = '0001_initial'
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


def _existing_tables():
    return set(connection.introspection.table_names())


def migrate_finance_schema_after_legacy_repair():
    """Ensure the Finance schema exists before the application starts.

    The production service still repairs the historical core schema with
    ``fix_db.py`` before running ``manage.py collectstatic`` and Gunicorn.
    Finance is a normal Django app, so its schema must be created by its Django
    migration after that legacy repair has completed.

    ``fake_initial=True`` also makes this safe for an installation where all
    Finance tables already exist but the initial migration marker is missing.
    A stale marker with *no* Finance tables is repaired automatically.  A
    partially existing Finance schema is deliberately rejected instead of
    dropping or overwriting potentially real financial data.
    """

    print('🔧 Перевіряємо міграції модуля Фінанси...', flush=True)

    existing_before = _existing_tables()
    present_before = REQUIRED_FINANCE_TABLES & existing_before
    missing_before = REQUIRED_FINANCE_TABLES - existing_before

    recorder = MigrationRecorder(connection)
    applied = recorder.applied_migrations()
    initial_is_recorded = ('finance', FINANCE_INITIAL_MIGRATION) in applied

    if missing_before and present_before:
        raise RuntimeError(
            'Виявлено частково створену схему Finance. Автоматичний запуск '
            'зупинено, щоб не пошкодити фінансові дані. Є таблиці: '
            + ', '.join(sorted(present_before))
            + '; відсутні: '
            + ', '.join(sorted(missing_before))
        )

    if initial_is_recorded and not present_before:
        # A previous/manual deploy may have left django_migrations saying that
        # Finance was applied even though none of its tables exist.  Removing
        # only this stale marker is safe here because there is no Finance data
        # to preserve, and lets Django create the schema normally below.
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
        FINANCE_INITIAL_MIGRATION,
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

    print('✅ Таблиці модуля Фінанси PostgreSQL ОК', flush=True)
