import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.push_notifications.scheduler import process_scheduled_pushes


class Command(BaseCommand):
    help = 'Continuously process scheduled VIN Matrix push notifications.'

    def add_arguments(self, parser):
        parser.add_argument('--interval', type=int, default=60)

    def handle(self, *args, **options):
        interval = max(30, int(options.get('interval') or 60))
        self.stdout.write(self.style.SUCCESS(f'Push scheduler started. Interval: {interval}s'))
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
