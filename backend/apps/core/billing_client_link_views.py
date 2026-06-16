import json

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import is_partner_user, is_platform_admin, repair_legacy_account


BILLING_CONFIG_KEY = 'client_payment_link'

DEFAULT_CLIENT_LINK_SETTINGS = {
    'title': 'VIN-matrix subscription',
    'monthly_value': 2000,
    'public_url': '',
    'public_note': '',
    'instruction': 'Enter client code. Example: C6003',
    'is_active': True,
}


def ensure_billing_config_table():
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_billingconfig (
                    key varchar(80) PRIMARY KEY,
                    value text NOT NULL DEFAULT '{}',
                    updated_at timestamp with time zone NULL
                )
                '''
            )
        else:
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_billingconfig (
                    key varchar(80) PRIMARY KEY,
                    value text NOT NULL DEFAULT '{}',
                    updated_at datetime NULL
                )
                '''
            )


def normalize_link_settings(value):
    settings = DEFAULT_CLIENT_LINK_SETTINGS.copy()
    if isinstance(value, dict):
        for key in settings.keys():
            if key in value:
                settings[key] = value.get(key)
    try:
        settings['monthly_value'] = int(float(str(settings.get('monthly_value') or 2000).replace(',', '.')))
    except Exception:
        settings['monthly_value'] = 2000
    settings['public_url'] = str(settings.get('public_url') or '').strip()
    settings['public_note'] = str(settings.get('public_note') or '').strip()
    settings['instruction'] = str(settings.get('instruction') or DEFAULT_CLIENT_LINK_SETTINGS['instruction']).strip()
    settings['title'] = str(settings.get('title') or DEFAULT_CLIENT_LINK_SETTINGS['title']).strip()
    settings['is_active'] = str(settings.get('is_active')).lower() not in {'0', 'false', 'no', 'off'}
    return settings


def get_client_link_settings():
    ensure_billing_config_table()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT value FROM core_billingconfig WHERE key=%s', [BILLING_CONFIG_KEY])
            row = cursor.fetchone()
        if not row:
            return DEFAULT_CLIENT_LINK_SETTINGS.copy()
        return normalize_link_settings(json.loads(row[0] or '{}'))
    except Exception:
        return DEFAULT_CLIENT_LINK_SETTINGS.copy()


def save_client_link_settings(data):
    ensure_billing_config_table()
    settings = normalize_link_settings(data)
    payload = json.dumps(settings, ensure_ascii=False)
    now = timezone.now()
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                '''
                INSERT INTO core_billingconfig (key, value, updated_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at
                ''',
                [BILLING_CONFIG_KEY, payload, now],
            )
        else:
            cursor.execute(
                '''
                INSERT OR REPLACE INTO core_billingconfig (key, value, updated_at)
                VALUES (%s, %s, %s)
                ''',
                [BILLING_CONFIG_KEY, payload, now],
            )
    return settings


class BillingAdminClientLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def has_access(self, request):
        repair_legacy_account(request.user)
        return is_platform_admin(request.user) or is_partner_user(request.user)

    def get(self, request):
        if not self.has_access(request):
            return Response({'error': 'Forbidden.'}, status=403)
        return Response({'client_link_settings': get_client_link_settings()})

    def patch(self, request):
        if not self.has_access(request):
            return Response({'error': 'Forbidden.'}, status=403)
        return Response({
            'message': 'Налаштування оплати для клієнтів збережено.',
            'client_link_settings': save_client_link_settings(request.data),
        })
