#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def _run_finance_preflight_for_production_startup():
    """Create/verify Finance tables before production continues to Gunicorn.

    The current production start command runs ``fix_db.py`` and then
    ``manage.py collectstatic``.  Running the Finance migration here makes the
    schema update explicit and synchronous after the legacy repair has
    finished, instead of relying on process-exit hooks.
    """

    if len(sys.argv) < 2 or sys.argv[1] != 'collectstatic':
        return

    import django

    django.setup()

    from apps.finance.startup_migrations import (
        migrate_finance_schema_after_legacy_repair,
    )

    migrate_finance_schema_after_legacy_repair()


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings_growth')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    _run_finance_preflight_for_production_startup()
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
