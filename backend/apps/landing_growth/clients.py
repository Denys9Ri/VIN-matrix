import base64
import json
import logging
import os
from datetime import date, timedelta
from urllib.parse import quote

import requests
from django.conf import settings
from django.utils import timezone
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import credentials as oauth_credentials
from google.oauth2 import service_account

from .models import LandingAIUsage

logger = logging.getLogger('vin_matrix')

SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'


class ExternalServiceError(RuntimeError):
    pass


def _setting(name, default=''):
    return getattr(settings, name, os.getenv(name, default))


def _validate_service_account_info(info):
    if not isinstance(info, dict):
        raise ExternalServiceError('Google credentials JSON має бути об’єктом.')
    if info.get('type') != 'service_account':
        raise ExternalServiceError('Google credentials мають бути JSON-ключем Service Account.')
    missing = [name for name in ('client_email', 'private_key', 'token_uri') if not info.get(name)]
    if missing:
        raise ExternalServiceError(
            'У Google Service Account JSON відсутні поля: ' + ', '.join(missing) + '.'
        )
    return info


def _normalize_credentials_value(raw_value):
    raw = str(raw_value or '').strip()
    prefix = 'GOOGLE_APPLICATION_CREDENTIALS='
    if raw.startswith(prefix):
        raw = raw[len(prefix):].strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'"', "'"}:
        raw = raw[1:-1].strip()
    if raw.lower().startswith('base64:'):
        raw = raw.split(':', 1)[1].strip()
    return raw


def _decode_base64_json(raw):
    compact = ''.join(raw.split())
    if not compact:
        return None
    normalized = compact.replace('-', '+').replace('_', '/')
    normalized += '=' * (-len(normalized) % 4)
    try:
        decoded = base64.b64decode(normalized, validate=True).decode('utf-8-sig')
        return json.loads(decoded)
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _load_service_account_info(raw_value):
    raw = _normalize_credentials_value(raw_value)
    if not raw:
        return None

    if os.path.isfile(raw):
        try:
            with open(raw, 'r', encoding='utf-8-sig') as handle:
                return _validate_service_account_info(json.load(handle))
        except (OSError, json.JSONDecodeError) as exc:
            raise ExternalServiceError(f'Не вдалося прочитати Google credentials файл: {exc}') from exc

    if raw.lstrip().startswith('{'):
        try:
            return _validate_service_account_info(json.loads(raw))
        except json.JSONDecodeError as exc:
            raise ExternalServiceError('GOOGLE_APPLICATION_CREDENTIALS містить невалідний JSON.') from exc

    decoded = _decode_base64_json(raw)
    if decoded is not None:
        return _validate_service_account_info(decoded)

    raise ExternalServiceError(
        'GOOGLE_APPLICATION_CREDENTIALS не розпізнано. Вставте шлях до Service Account JSON, '
        'сам JSON або Base64 від повного JSON-файлу без назви змінної.'
    )


class GoogleAccessTokenProvider:
    def __init__(self, scopes):
        self.scopes = list(scopes)

    def credentials(self):
        raw_credentials = _setting('GOOGLE_APPLICATION_CREDENTIALS', '')
        if raw_credentials:
            info = _load_service_account_info(raw_credentials)
            return service_account.Credentials.from_service_account_info(info, scopes=self.scopes)

        refresh_token = _setting('GOOGLE_OAUTH_REFRESH_TOKEN', '')
        client_id = _setting('GOOGLE_OAUTH_CLIENT_ID', '')
        client_secret = _setting('GOOGLE_OAUTH_CLIENT_SECRET', '')
        if refresh_token and client_id and client_secret:
            return oauth_credentials.Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri='https://oauth2.googleapis.com/token',
                client_id=client_id,
                client_secret=client_secret,
                scopes=self.scopes,
            )

        raise ExternalServiceError(
            'Не налаштовано Google credentials. Додайте GOOGLE_APPLICATION_CREDENTIALS '
            'або OAuth refresh token разом із client id/client secret.'
        )

    def access_token(self):
        credentials = self.credentials()
        if not credentials.valid or not credentials.token:
            credentials.refresh(GoogleAuthRequest())
        return credentials.token


class SearchConsoleClient:
    endpoint = 'https://www.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query'

    def __init__(self):
        self.site_url = str(_setting('GOOGLE_SEARCH_CONSOLE_SITE_URL', '')).strip()
        if not self.site_url:
            raise ExternalServiceError('GOOGLE_SEARCH_CONSOLE_SITE_URL не налаштовано.')
        self.token_provider = GoogleAccessTokenProvider([SEARCH_CONSOLE_SCOPE])

    def query_main_page(self, start_date, end_date, row_limit=25000):
        page_url = str(_setting('LANDING_GROWTH_CANONICAL_URL', 'https://vin-matrix.com/')).strip()
        payload = {
            'startDate': start_date.isoformat(),
            'endDate': end_date.isoformat(),
            'dimensions': ['date', 'query', 'page', 'device'],
            'type': 'web',
            'aggregationType': 'auto',
            'rowLimit': min(int(row_limit), 25000),
            'dimensionFilterGroups': [
                {
                    'groupType': 'and',
                    'filters': [
                        {'dimension': 'page', 'operator': 'equals', 'expression': page_url},
                    ],
                }
            ],
        }
        response = requests.post(
            self.endpoint.format(site=quote(self.site_url, safe='')),
            headers={
                'Authorization': f'Bearer {self.token_provider.access_token()}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=45,
        )
        if response.status_code >= 400:
            raise ExternalServiceError(
                f'Search Console API {response.status_code}: {response.text[:500]}'
            )
        return response.json().get('rows', [])


class GA4Client:
    endpoint = 'https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport'

    def __init__(self):
        self.property_id = str(_setting('GA4_PROPERTY_ID', '')).strip()
        if self.property_id.startswith('properties/'):
            self.property_id = self.property_id.split('/', 1)[1]
        if not self.property_id:
            raise ExternalServiceError('GA4_PROPERTY_ID не налаштовано.')
        self.token_provider = GoogleAccessTokenProvider([ANALYTICS_SCOPE])

    def _run(self, payload):
        response = requests.post(
            self.endpoint.format(property_id=self.property_id),
            headers={
                'Authorization': f'Bearer {self.token_provider.access_token()}',
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=45,
        )
        if response.status_code >= 400:
            raise ExternalServiceError(f'GA4 Data API {response.status_code}: {response.text[:500]}')
        return response.json()

    def main_page_events(self, start_date, end_date):
        payload = {
            'dateRanges': [{'startDate': start_date.isoformat(), 'endDate': end_date.isoformat()}],
            'dimensions': [
                {'name': 'date'},
                {'name': 'eventName'},
                {'name': 'sessionSourceMedium'},
            ],
            'metrics': [
                {'name': 'eventCount'},
                {'name': 'totalUsers'},
                {'name': 'sessions'},
            ],
            'dimensionFilter': {
                'filter': {
                    'fieldName': 'pagePath',
                    'stringFilter': {'matchType': 'EXACT', 'value': '/', 'caseSensitive': False},
                }
            },
            'limit': '100000',
            'keepEmptyRows': False,
        }
        return self._run(payload)


class OpenAIProposalClient:
    endpoint = 'https://api.openai.com/v1/responses'

    def __init__(self):
        self.api_key = str(_setting('OPENAI_API_KEY', '')).strip()
        self.model = str(_setting('OPENAI_MODEL', 'gpt-5-nano')).strip() or 'gpt-5-nano'
        self.timeout = int(_setting('OPENAI_TIMEOUT_SECONDS', 60) or 60)
        self.max_output_tokens = int(_setting('OPENAI_MAX_OUTPUT_TOKENS', 600) or 600)

    def _within_budget(self, growth_settings):
        today = timezone.localdate()
        today_usage, _ = LandingAIUsage.objects.get_or_create(date=today)
        if today_usage.calls >= growth_settings.daily_openai_limit:
            return False, 'Досягнуто денний ліміт OpenAI.'
        month_calls = LandingAIUsage.objects.filter(
            date__gte=today.replace(day=1),
            date__lte=today,
        ).aggregate(total=models_sum('calls'))['total'] or 0
        if month_calls >= growth_settings.monthly_openai_limit:
            return False, 'Досягнуто місячний ліміт OpenAI.'
        return True, ''

    def generate(self, *, growth_settings, current_config, evidence, allowed_fields):
        if not self.api_key:
            raise ExternalServiceError('OPENAI_API_KEY не налаштовано.')
        allowed, reason = self._within_budget(growth_settings)
        if not allowed:
            raise ExternalServiceError(reason)

        schema = {
            'type': 'object',
            'additionalProperties': False,
            'required': ['field_path', 'proposed_value', 'metric_name', 'rationale'],
            'properties': {
                'field_path': {'type': 'string', 'enum': sorted(allowed_fields)},
                'proposed_value': {'type': 'string'},
                'metric_name': {
                    'type': 'string',
                    'enum': [
                        'hero_register_click',
                        'hero_demo_click',
                        'pricing_register_click',
                        'final_register_click',
                        'register_complete',
                        'search_ctr',
                    ],
                },
                'rationale': {'type': 'string'},
            },
        }
        prompt = {
            'product': 'VIN-matrix — CRM/SaaS для СТО, шиномонтажу та магазину автозапчастин',
            'goal': 'Запропонувати рівно одну контрольовану зміну для наступного експерименту.',
            'rules': [
                'Пиши українською.',
                'Не вигадуй функції, цифри, відгуки, гарантії або перевагу №1.',
                'Не змінюй ціну, тривалість trial або юридичні умови.',
                'Не додавай HTML, URL, ключові слова списком або прихований текст.',
                'Зміна має бути корисною людині та відповідати фактичним даним.',
                'Запропонуй лише одне поле з allowed_fields.',
            ],
            'allowed_fields': allowed_fields,
            'current_config': current_config,
            'evidence': evidence,
        }
        payload = {
            'model': self.model,
            'store': False,
            'max_output_tokens': self.max_output_tokens,
            'instructions': (
                'Ти обережний growth-аналітик SaaS. Поверни тільки структурований результат, '
                'який можна безпечно перевірити A/B або послідовним SEO-тестом.'
            ),
            'input': json.dumps(prompt, ensure_ascii=False),
            'text': {
                'format': {
                    'type': 'json_schema',
                    'name': 'landing_growth_proposal',
                    'strict': True,
                    'schema': schema,
                }
            },
        }
        response = requests.post(
            self.endpoint,
            headers={'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=self.timeout,
        )
        if response.status_code >= 400:
            raise ExternalServiceError(f'OpenAI API {response.status_code}: {response.text[:500]}')
        data = response.json()
        output_text = data.get('output_text') or self._extract_output_text(data)
        if not output_text:
            raise ExternalServiceError('OpenAI не повернув текстовий результат.')
        try:
            proposal = json.loads(output_text)
        except json.JSONDecodeError as exc:
            raise ExternalServiceError('OpenAI повернув невалідний JSON.') from exc

        usage = data.get('usage') or {}
        input_tokens = int(usage.get('input_tokens') or 0)
        output_tokens = int(usage.get('output_tokens') or 0)
        today_usage, _ = LandingAIUsage.objects.get_or_create(date=timezone.localdate())
        today_usage.calls += 1
        today_usage.input_tokens += input_tokens
        today_usage.output_tokens += output_tokens
        today_usage.save(update_fields=['calls', 'input_tokens', 'output_tokens', 'updated_at'])
        return proposal, {
            'model': self.model,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'response_id': data.get('id', ''),
        }

    @staticmethod
    def _extract_output_text(data):
        chunks = []
        for item in data.get('output') or []:
            for content in item.get('content') or []:
                if content.get('type') in {'output_text', 'text'} and content.get('text'):
                    chunks.append(content['text'])
        return ''.join(chunks)


def models_sum(field_name):
    # Import lazily so clients.py stays importable in tooling that initializes Django partially.
    from django.db.models import Sum

    return Sum(field_name)


def default_collection_window(days=3):
    end_date = date.today() - timedelta(days=2)
    start_date = end_date - timedelta(days=max(1, days) - 1)
    return start_date, end_date
