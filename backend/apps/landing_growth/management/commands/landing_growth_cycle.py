import json

from django.core.management.base import BaseCommand, CommandError

from apps.landing_growth.engine import run_growth_cycle


class Command(BaseCommand):
    help = 'Збирає Search Console/GA4, оцінює експеримент і запускає наступну безпечну гіпотезу.'

    def add_arguments(self, parser):
        parser.add_argument('--no-collect', action='store_true', help='Не звертатися до Google API.')
        parser.add_argument('--no-propose', action='store_true', help='Не створювати нову гіпотезу.')

    def handle(self, *args, **options):
        try:
            result = run_growth_cycle(
                collect=not options['no_collect'],
                propose=not options['no_propose'],
            )
        except Exception as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(json.dumps(result, ensure_ascii=False, default=str, indent=2)))
