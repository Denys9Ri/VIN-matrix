from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.finance.startup_migrations import (
    FINANCE_INITIAL_MIGRATION,
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

    @patch('apps.finance.startup_migrations.MigrationRecorder')
    @patch('apps.finance.startup_migrations._existing_tables')
    @patch('apps.finance.startup_migrations.call_command')
    def test_runs_finance_migration_and_verifies_required_tables(
        self,
        call_command,
        existing_tables,
        recorder_cls,
    ):
        existing_tables.side_effect = [set(), set(REQUIRED_FINANCE_TABLES)]
        recorder_cls.return_value.applied_migrations.return_value = set()

        migrate_finance_schema_after_legacy_repair()

        call_command.assert_called_once_with(
            'migrate',
            'finance',
            FINANCE_INITIAL_MIGRATION,
            interactive=False,
            verbosity=1,
            fake_initial=True,
        )

    @patch('apps.finance.startup_migrations.MigrationRecorder')
    @patch('apps.finance.startup_migrations._existing_tables')
    @patch('apps.finance.startup_migrations.call_command')
    def test_repairs_stale_migration_marker_when_no_finance_tables_exist(
        self,
        call_command,
        existing_tables,
        recorder_cls,
    ):
        existing_tables.side_effect = [set(), set(REQUIRED_FINANCE_TABLES)]
        recorder = recorder_cls.return_value
        recorder.applied_migrations.return_value = {('finance', FINANCE_INITIAL_MIGRATION)}
        filtered = MagicMock()
        recorder.migration_qs.filter.return_value = filtered

        migrate_finance_schema_after_legacy_repair()

        recorder.migration_qs.filter.assert_called_once_with(
            app='finance',
            name=FINANCE_INITIAL_MIGRATION,
        )
        filtered.delete.assert_called_once_with()
        call_command.assert_called_once()

    @patch('apps.finance.startup_migrations.MigrationRecorder')
    @patch('apps.finance.startup_migrations._existing_tables')
    @patch('apps.finance.startup_migrations.call_command')
    def test_rejects_partial_finance_schema_instead_of_overwriting_data(
        self,
        call_command,
        existing_tables,
        recorder_cls,
    ):
        existing_tables.return_value = {'finance_legalentity'}

        with self.assertRaisesRegex(RuntimeError, 'частково створену схему'):
            migrate_finance_schema_after_legacy_repair()

        recorder_cls.assert_not_called()
        call_command.assert_not_called()

    @patch('apps.finance.startup_migrations.MigrationRecorder')
    @patch('apps.finance.startup_migrations._existing_tables')
    @patch('apps.finance.startup_migrations.call_command')
    def test_fails_when_tables_are_missing_after_migration(
        self,
        call_command,
        existing_tables,
        recorder_cls,
    ):
        existing_tables.side_effect = [set(), set()]
        recorder_cls.return_value.applied_migrations.return_value = set()

        with self.assertRaisesRegex(RuntimeError, 'відсутні таблиці'):
            migrate_finance_schema_after_legacy_repair()

        call_command.assert_called_once()

    def test_manage_collectstatic_runs_finance_preflight_before_django_command(self):
        backend_root = Path(__file__).resolve().parents[3]
        source = (backend_root / 'manage.py').read_text(encoding='utf-8')

        self.assertIn("sys.argv[1] != 'collectstatic'", source)
        self.assertIn('migrate_finance_schema_after_legacy_repair()', source)
        self.assertLess(
            source.index('_run_finance_preflight_for_production_startup()'),
            source.index('execute_from_command_line(sys.argv)'),
        )
