import importlib

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class Command(BaseCommand):
    help = 'Verify support-access production readiness: migration state, DB table, and loaded code paths.'

    def handle(self, *args, **options):
        from apps.core.models import SupportAccessSession
        from apps.core import support_access_views, support_authentication

        migration_0007 = importlib.import_module('apps.core.migrations.0007_supportaccesssession')

        executor = MigrationExecutor(connection)
        applied = executor.loader.applied_migrations
        migration_applied = ('core', '0007_supportaccesssession') in applied
        table_name = SupportAccessSession._meta.db_table
        existing_tables = connection.introspection.table_names()
        table_exists = table_name in existing_tables

        self.stdout.write(f'core.0007_supportaccesssession: {"[X]" if migration_applied else "[ ]"}')
        self.stdout.write(f'{table_name}: {"exists" if table_exists else "missing"}')
        self.stdout.write(f'support_access_views: {support_access_views.__file__}')
        self.stdout.write(f'support_authentication: {support_authentication.__file__}')
        self.stdout.write(f'0007_supportaccesssession: {migration_0007.__file__}')

        if not migration_applied or not table_exists:
            raise SystemExit(1)
