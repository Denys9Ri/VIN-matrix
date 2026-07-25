from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.landing_growth.clients import (
    ExternalServiceError,
    GA4Client,
    GoogleAccessTokenProvider,
    SearchConsoleClient,
    default_collection_window,
)
from apps.landing_growth.models import LandingGrowthSettings


class Command(BaseCommand):
    help = 'Перевіряє конфігурацію, доступ до БД і, за потреби, живий доступ до Google API.'

    def add_arguments(self, parser):
        parser.add_argument('--live-google', action='store_true', help='Зробити read-only запити до Search Console і GA4.')

    def handle(self, *args, **options):
        growth_settings = LandingGrowthSettings.load()
        self.stdout.write(self.style.SUCCESS(
            f'Database: OK · mode={growth_settings.mode} · config_version={growth_settings.config_version}'
        ))

        required = {
            'GOOGLE_SEARCH_CONSOLE_SITE_URL': getattr(settings, 'GOOGLE_SEARCH_CONSOLE_SITE_URL', ''),
            'GA4_PROPERTY_ID': getattr(settings, 'GA4_PROPERTY_ID', ''),
            'GOOGLE_APPLICATION_CREDENTIALS or OAuth refresh token': (
                getattr(settings, 'GOOGLE_APPLICATION_CREDENTIALS', '')
                or (
                    getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
                    and getattr(settings, 'GOOGLE_OAUTH_CLIENT_SECRET', '')
                    and getattr(settings, 'GOOGLE_OAUTH_REFRESH_TOKEN', '')
                )
            ),
            'LANDING_GROWTH_SIGNING_KEY': (
                getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '')
                if getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') != settings.SECRET_KEY
                else ''
            ),
            'DEPLOY_TRIGGER_URL': getattr(settings, 'DEPLOY_TRIGGER_URL', ''),
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            for name in missing:
                self.stderr.write(self.style.ERROR(f'Missing: {name}'))
            raise CommandError('Landing Growth Engine configuration is incomplete.')

        if getattr(settings, 'OPENAI_API_KEY', ''):
            self.stdout.write(self.style.SUCCESS(
                f'OpenAI: configured · model={getattr(settings, "OPENAI_MODEL", "gpt-5-nano")}'
            ))
        else:
            self.stdout.write(self.style.WARNING('OpenAI: key is not configured; deterministic fallback remains active.'))

        try:
            GoogleAccessTokenProvider([
                'https://www.googleapis.com/auth/webmasters.readonly',
                'https://www.googleapis.com/auth/analytics.readonly',
            ]).access_token()
            self.stdout.write(self.style.SUCCESS('Google credentials: OK'))
        except Exception as exc:
            raise CommandError(f'Google credentials failed: {exc}') from exc

        if options['live_google']:
            start_date, end_date = default_collection_window(1)
            try:
                search_rows = SearchConsoleClient().query_main_page(start_date, end_date, row_limit=10)
                ga_report = GA4Client().main_page_events(start_date, end_date)
            except ExternalServiceError as exc:
                raise CommandError(str(exc)) from exc
            self.stdout.write(self.style.SUCCESS(
                f'Live Google API: OK · Search Console rows={len(search_rows)} · GA4 rows={len(ga_report.get("rows") or [])}'
            ))

        self.stdout.write(self.style.SUCCESS('Landing Growth Engine doctor: all required checks passed.'))
