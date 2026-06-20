import os
import time
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from .models import Company, InventoryItem, PlatformClient, Visit


RAW_NOVAPOST_TABLES = ('core_novapostprofile', 'core_delivery')


def _now():
    return datetime.now(dt_timezone.utc).isoformat().replace('+00:00', 'Z')


def _ok(**payload):
    return {'status': 'ok', **payload}


def _warning(**payload):
    return {'status': 'warning', **payload}


def _error(**payload):
    return {'status': 'error', **payload}


def check_database():
    started = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        return _ok(vendor=connection.vendor, latency_ms=int((time.monotonic() - started) * 1000))
    except Exception as exc:
        return _error(message='Database connection failed', exception=exc.__class__.__name__)


def check_tables():
    required = {
        'companies': Company._meta.db_table,
        'visits': Visit._meta.db_table,
        'inventory': InventoryItem._meta.db_table,
        'billing_clients': PlatformClient._meta.db_table,
        'novapost_profiles': RAW_NOVAPOST_TABLES[0],
        'novapost_deliveries': RAW_NOVAPOST_TABLES[1],
    }
    try:
        existing = set(connection.introspection.table_names())
        missing = {key: table for key, table in required.items() if table not in existing}
        if missing:
            return _error(required=required, missing=missing)
        return _ok(required=required, missing={})
    except Exception as exc:
        return _error(message='Unable to inspect database tables', exception=exc.__class__.__name__)


def check_migrations():
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        pending = [f'{migration.app_label}.{migration.name}' for migration, _ in plan]
        if pending:
            return _warning(pending_count=len(pending), pending=pending[:20])
        return _ok(pending_count=0, pending=[])
    except Exception as exc:
        return _warning(message='Unable to verify migrations', exception=exc.__class__.__name__)


def check_billing(tables_ok):
    if PlatformClient._meta.db_table not in tables_ok:
        return _error(message='Billing table is missing')
    try:
        return _ok(client_count=PlatformClient.objects.count())
    except Exception as exc:
        return _error(message='Billing check failed', exception=exc.__class__.__name__)


def _scalar_query(sql):
    with connection.cursor() as cursor:
        cursor.execute(sql)
        row = cursor.fetchone()
    return int(row[0] or 0) if row else 0


def check_novapost(tables_ok):
    profile_table, delivery_table = RAW_NOVAPOST_TABLES
    missing = [name for name in RAW_NOVAPOST_TABLES if name not in tables_ok]
    if missing:
        return _error(message='Nova Poshta tables are missing', missing_tables=missing)

    try:
        profiles = _scalar_query(f'SELECT COUNT(*) FROM {profile_table}')
        active_profiles = _scalar_query(f'SELECT COUNT(*) FROM {profile_table} WHERE is_active=true')
        deliveries = _scalar_query(f'SELECT COUNT(*) FROM {delivery_table}')
        return _ok(
            external_api_checked=False,
            note='External Nova Poshta API is not called by health-check.',
            profiles=profiles,
            active_profiles=active_profiles,
            deliveries=deliveries,
            configuration='configured' if active_profiles else 'no_active_profile',
        )
    except Exception as exc:
        return _error(message='Nova Poshta storage check failed', exception=exc.__class__.__name__)


def check_backup_configuration():
    backup_dir = str(os.getenv('BACKUP_DIR') or os.getenv('POSTGRES_BACKUP_DIR') or '').strip()
    if not backup_dir:
        return _warning(configured=False, message='BACKUP_DIR is not configured')
    return _ok(configured=True, directory_configured=True)


def check_security():
    warnings = []
    if settings.DEBUG:
        warnings.append('DEBUG is enabled')
    if not settings.ALLOWED_HOSTS:
        warnings.append('ALLOWED_HOSTS is empty')
    return (_warning(warnings=warnings) if warnings else _ok(warnings=[]))


def build_health_report():
    database = check_database()
    tables = check_tables() if database['status'] == 'ok' else _error(message='Skipped because database is unavailable')
    existing_tables = set()
    if tables['status'] != 'error':
        try:
            existing_tables = set(connection.introspection.table_names())
        except Exception:
            existing_tables = set()

    checks = {
        'database': database,
        'tables': tables,
        'migrations': check_migrations() if database['status'] == 'ok' else _error(message='Skipped because database is unavailable'),
        'billing': check_billing(existing_tables) if database['status'] == 'ok' else _error(message='Skipped because database is unavailable'),
        'novapost': check_novapost(existing_tables) if database['status'] == 'ok' else _error(message='Skipped because database is unavailable'),
        'backup': check_backup_configuration(),
        'security': check_security(),
    }

    statuses = [check['status'] for check in checks.values()]
    overall = 'down' if 'error' in statuses else ('degraded' if 'warning' in statuses else 'ok')

    return {
        'status': overall,
        'checked_at': _now(),
        'version': os.getenv('APP_VERSION', 'unknown'),
        'checks': checks,
    }
