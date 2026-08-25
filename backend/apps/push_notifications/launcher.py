import os
import subprocess
import sys
import time
from pathlib import Path


TRUE_VALUES = {'1', 'true', 'yes', 'on'}
FALSE_VALUES = {'0', 'false', 'no', 'off'}


def _env_enabled(name, default=True):
    raw = os.getenv(name)
    if raw is None:
        return default
    value = str(raw).strip().lower()
    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False
    return default


def start_push_scheduler_background():
    """Start the time-based push scheduler from the Coolify bootstrap path.

    Coolify runs ``python fix_db.py`` before Gunicorn in production. Starting the
    scheduler here makes timed visit/debt/CRM pushes independent of which web
    start command Coolify uses. The scheduler command itself owns a process lock,
    so a second launcher in the same container exits harmlessly.
    """
    if not _env_enabled('VIN_MATRIX_PUSH_SCHEDULER_AUTOSTART', True):
        return {'started': False, 'already_running': False, 'disabled': True, 'pid': None}

    try:
        interval = max(30, int(os.getenv('VIN_MATRIX_PUSH_SCHEDULER_INTERVAL', '60')))
    except (TypeError, ValueError):
        interval = 60

    backend_dir = Path(__file__).resolve().parents[2]
    command = [
        sys.executable,
        str(backend_dir / 'manage.py'),
        'run_push_scheduler',
        '--interval',
        str(interval),
    ]

    process = subprocess.Popen(
        command,
        cwd=str(backend_dir),
        env=os.environ.copy(),
        start_new_session=True,
    )

    # Catch configuration/import failures during deployment instead of silently
    # reporting a healthy web process while timed notifications are dead.
    time.sleep(0.5)
    return_code = process.poll()
    if return_code is None:
        return {'started': True, 'already_running': False, 'disabled': False, 'pid': process.pid}
    if return_code == 0:
        # The scheduler exits cleanly when the per-container lock is already
        # owned, which means another healthy scheduler is already running.
        return {'started': False, 'already_running': True, 'disabled': False, 'pid': None}

    raise RuntimeError(f'Push scheduler failed to start (exit code {return_code}).')
