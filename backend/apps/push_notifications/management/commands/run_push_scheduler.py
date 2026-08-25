import os
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.push_notifications.scheduler import process_scheduled_pushes


LOCK_FILE = os.getenv('VIN_MATRIX_PUSH_SCHEDULER_LOCK_FILE', '/tmp/vin-matrix-push-scheduler.lock')


def acquire_scheduler_lock():
    """Acquire a best-effort per-container lock for the long-running scheduler."""
    try:
        import fcntl
    except ImportError:
        return None, True

    handle = open(LOCK_FILE, 'a+', encoding='utf-8')
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        return None, False

    handle.seek(0)
    handle.truncate()
    handle.write(str(os.getpid()))
    handle.flush()
    return handle, True


class Command(BaseCommand):
    help = 'Continuously process scheduled VIN Matrix push notifications.'

    def add_arguments(self, parser):
        parser.add_argument('--interval', type=int, default=60)

    def handle(self, *args, **options):
        lock_handle, acquired = acquire_scheduler_lock()
        if not acquired:
            self.stdout.write('Push scheduler already running in this container.')
            return

        interval = max(30, int(options.get('interval') or 60))
        self.stdout.write(self.style.SUCCESS(f'Push scheduler started. Interval: {interval}s'))
        try:
            while True:
                try:
                    close_old_connections()
                    process_scheduled_pushes()
                except KeyboardInterrupt:
                    self.stdout.write('Push scheduler stopped.')
                    return
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f'Push scheduler tick failed: {exc}'))
                finally:
                    close_old_connections()
                time.sleep(interval)
        finally:
            if lock_handle is not None:
                try:
                    lock_handle.close()
                except Exception:
                    pass
