import os
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.landing_growth.engine import run_growth_cycle


class Command(BaseCommand):
    help = 'Безперервно запускає Landing Growth Engine з безпечним інтервалом.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=int(os.getenv('LANDING_GROWTH_INTERVAL_SECONDS', '21600')),
            help='Інтервал між циклами у секундах (типово 6 годин).',
        )
        parser.add_argument(
            '--initial-delay',
            type=int,
            default=int(os.getenv('LANDING_GROWTH_INITIAL_DELAY_SECONDS', '120')),
            help='Затримка перед першим циклом.',
        )
        parser.add_argument('--once', action='store_true')

    def handle(self, *args, **options):
        interval = max(3600, int(options['interval']))
        initial_delay = max(0, int(options['initial_delay']))
        if initial_delay and not options['once']:
            self.stdout.write(f'Landing Growth daemon: перший запуск через {initial_delay} с.')
            time.sleep(initial_delay)

        while True:
            close_old_connections()
            try:
                result = run_growth_cycle(collect=True, propose=True)
                self.stdout.write(self.style.SUCCESS(f'Landing Growth cycle completed: {result}'))
            except Exception as exc:  # The daemon must survive transient Google/OpenAI/network failures.
                self.stderr.write(self.style.ERROR(f'Landing Growth cycle failed: {exc}'))
            finally:
                close_old_connections()

            if options['once']:
                break
            time.sleep(interval)
