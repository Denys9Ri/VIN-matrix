import json

from django.core.management.base import BaseCommand, CommandError

from apps.core.system_health import build_health_report


class Command(BaseCommand):
    help = 'Run VIN-matrix health checks from the server shell.'

    def add_arguments(self, parser):
        parser.add_argument('--json', action='store_true')
        parser.add_argument('--strict', action='store_true')

    def handle(self, *args, **options):
        report = build_health_report()
        overall = report['status']

        if options['json']:
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        else:
            writer = self.style.SUCCESS if overall == 'ok' else self.style.WARNING if overall == 'degraded' else self.style.ERROR
            self.stdout.write(writer(f'VIN-matrix health: {overall.upper()}'))
            self.stdout.write(f"Checked at: {report['checked_at']}")
            for name, check in report['checks'].items():
                self.stdout.write(f"- {name}: {check['status']}")

        if overall == 'down' or (options['strict'] and overall != 'ok'):
            raise CommandError(f'System health status is {overall}.')
