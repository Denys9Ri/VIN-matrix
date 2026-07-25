from django.core.management.base import BaseCommand

from apps.landing_growth.models import LandingGrowthSettings


class Command(BaseCommand):
    help = 'Створює singleton-конфігурацію Landing Growth Engine і вмикає обраний режим.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mode',
            choices=[
                LandingGrowthSettings.MODE_OBSERVE,
                LandingGrowthSettings.MODE_RECOMMEND,
                LandingGrowthSettings.MODE_SAFE_AUTOPILOT,
            ],
            default=None,
        )
        parser.add_argument('--disable-openai', action='store_true')

    def handle(self, *args, **options):
        settings_obj = LandingGrowthSettings.load()
        update_fields = []
        if options['mode']:
            settings_obj.mode = options['mode']
            update_fields.append('mode')
        if options['disable_openai'] and settings_obj.openai_enabled:
            settings_obj.openai_enabled = False
            update_fields.append('openai_enabled')
        if update_fields:
            settings_obj.save(update_fields=[*update_fields, 'updated_at'])
        self.stdout.write(self.style.SUCCESS(
            f'Landing Growth Engine готовий: mode={settings_obj.mode}, config_version={settings_obj.config_version}'
        ))
