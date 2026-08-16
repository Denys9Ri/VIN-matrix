from unittest.mock import patch

from django.test import SimpleTestCase

from apps.finance.startup_migrations import (
    REQUIRED_FINANCE_TABLES,
    is_legacy_fix_db_process,
    migrate_finance_schema_after_legacy_repair,
)


class FinanceStartupMigrationTests(SimpleTestCase):
    def test_detects_legacy_fix_db_process_only(self):
        self.assertTrue(is_legacy_fix_db_process('/app/fix_db.py'))
        self.assertTrue(is_legacy_fix_db_process('fix_db.py'))
        self.assertFalse(is_legacy_fix_db_process('/app/manage.py'))
        self.assertFalse(is_legacy_fix_db_process('gunicorn'))

    @patch('apps.finance.startup_migrations.connection')
    @patch('apps.finance.startup_migrations.call_command')
    def test_runs_finance_migration_and_verifies_required_tables(self, call_command, connection):
        connection.introspection.table_names.return_value = sorted(REQUIRED_FINANCE_TABLES)

        migrate_finance_schema_after_legacy_repair()

        call_command.assert_called_once_with('migrate', 'finance', interactive=False, verbosity=1)
        connection.introspection.table_names.assert_called_once_with()

    @patch('apps.finance.startup_migrations.connection')
    @patch('apps.finance.startup_migrations.call_command')
    def test_fails_startup_when_finance_tables_are_still_missing(self, call_command, connection):
        connection.introspection.table_names.return_value = ['finance_legalentity']

        with self.assertRaises(RuntimeError):
            migrate_finance_schema_after_legacy_repair()

        call_command.assert_called_once_with('migrate', 'finance', interactive=False, verbosity=1)
