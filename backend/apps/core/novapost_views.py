import json
import urllib.request

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .db_repair_novapost import repair_novapost_schema
from .partner_views import get_user_company, repair_legacy_account

NOVA_POST_API_URL = 'https://api.novaposhta.ua/v2.0/json/'


def mask_key(value):
    value = str(value or '').strip()
    if not value:
        return ''
    if len(value) <= 8:
        return '••••'
    return f'{value[:4]}••••{value[-4:]}'


def profile_payload(row, include_secret=False):
    data = {
        'id': row[0],
        'company_id': row[1],
        'name': row[2] or 'Нова пошта',
        'api_key_masked': mask_key(row[3]),
        'sender_name': row[4] or '',
        'sender_phone': row[5] or '',
        'sender_city': row[6] or '',
        'sender_city_ref': row[7] or '',
        'sender_warehouse': row[8] or '',
        'sender_warehouse_ref': row[9] or '',
        'is_default': bool(row[10]),
        'is_active': bool(row[11]),
        'created_at': row[12],
        'updated_at': row[13],
    }
    if include_secret:
        data['api_key'] = row[3] or ''
    return data


def fetch_profile(company_id, profile_id, include_secret=False):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT id, company_id, name, api_key, sender_name, sender_phone, sender_city,
                   sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default,
                   is_active, created_at, updated_at
            FROM core_novapostprofile
            WHERE company_id=%s AND id=%s
            LIMIT 1
            ''',
            [company_id, profile_id],
        )
        row = cursor.fetchone()
    return profile_payload(row, include_secret=include_secret) if row else None


def list_profiles(company_id):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT id, company_id, name, api_key, sender_name, sender_phone, sender_city,
                   sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default,
                   is_active, created_at, updated_at
            FROM core_novapostprofile
            WHERE company_id=%s
            ORDER BY is_default DESC, is_active DESC, id DESC
            ''',
            [company_id],
        )
        return [profile_payload(row) for row in cursor.fetchall()]


def bool_value(value, default=False):
    if value is None:
        return default
    if value in [True, 'true', '1', 1, 'yes', 'on']:
        return True
    if value in [False, 'false', '0', 0, 'no', 'off']:
        return False
    return default


def clean(value, limit=None):
    value = str(value or '').strip()
    return value[:limit] if limit else value


def set_default_profile(company_id, profile_id):
    with connection.cursor() as cursor:
        cursor.execute('UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s AND id<>%s', [company_id, profile_id])
        cursor.execute('UPDATE core_novapostprofile SET is_default=true, is_active=true, updated_at=%s WHERE company_id=%s AND id=%s', [timezone.now(), company_id, profile_id])


def test_nova_post_key(api_key):
    api_key = clean(api_key)
    if not api_key:
        return False, 'API-ключ не вказано.', None
    payload = {
        'apiKey': api_key,
        'modelName': 'AddressGeneral',
        'calledMethod': 'getCities',
        'methodProperties': {'Limit': 1},
    }
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            NOVA_POST_API_URL,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read().decode('utf-8')
            result = json.loads(raw or '{}')
        ok = bool(result.get('success'))
        if ok:
            return True, 'API-ключ працює. Підключення до Нової пошти успішне.', result
        errors = result.get('errors') or result.get('warnings') or []
        message = '; '.join([str(x) for x in errors]) if errors else 'Нова пошта не підтвердила API-ключ.'
        return False, message, result
    except Exception as exc:
        return False, f'Не вдалося перевірити API-ключ: {exc}', None


class NovaPostProfileListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        return Response({'results': list_profiles(company.id), 'count': len(list_profiles(company.id))})

    @transaction.atomic
    def post(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        repair_novapost_schema()
        api_key = clean(request.data.get('api_key'))
        if not api_key:
            return Response({'error': 'Вкажіть API-ключ Нової пошти.'}, status=400)
        name = clean(request.data.get('name') or 'Нова пошта', 160)
        now = timezone.now()
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM core_novapostprofile WHERE company_id=%s', [company.id])
            is_first = int(cursor.fetchone()[0] or 0) == 0
            is_default = bool_value(request.data.get('is_default'), default=is_first)
            if is_default:
                cursor.execute('UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s', [company.id])
            cursor.execute(
                '''
                INSERT INTO core_novapostprofile
                (company_id, name, api_key, sender_name, sender_phone, sender_city, sender_city_ref,
                 sender_warehouse, sender_warehouse_ref, is_default, is_active, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                ''',
                [
                    company.id,
                    name,
                    api_key,
                    clean(request.data.get('sender_name'), 255),
                    clean(request.data.get('sender_phone'), 40),
                    clean(request.data.get('sender_city'), 255),
                    clean(request.data.get('sender_city_ref'), 120),
                    clean(request.data.get('sender_warehouse'), 255),
                    clean(request.data.get('sender_warehouse_ref'), 120),
                    is_default,
                    bool_value(request.data.get('is_active'), default=True),
                    now,
                    now,
                ],
            )
            profile_id = cursor.fetchone()[0]
        return Response({'message': 'Профіль Нової пошти додано.', 'profile': fetch_profile(company.id, profile_id)}, status=201)


class NovaPostProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        repair_novapost_schema()
        current = fetch_profile(company.id, pk, include_secret=True)
        if not current:
            return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        api_key = clean(request.data.get('api_key')) if 'api_key' in request.data else current.get('api_key', '')
        is_default = bool_value(request.data.get('is_default'), default=current.get('is_default'))
        now = timezone.now()
        if is_default:
            with connection.cursor() as cursor:
                cursor.execute('UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s AND id<>%s', [company.id, pk])
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE core_novapostprofile
                SET name=%s, api_key=%s, sender_name=%s, sender_phone=%s, sender_city=%s,
                    sender_city_ref=%s, sender_warehouse=%s, sender_warehouse_ref=%s,
                    is_default=%s, is_active=%s, updated_at=%s
                WHERE company_id=%s AND id=%s
                ''',
                [
                    clean(request.data.get('name', current['name']), 160),
                    api_key,
                    clean(request.data.get('sender_name', current['sender_name']), 255),
                    clean(request.data.get('sender_phone', current['sender_phone']), 40),
                    clean(request.data.get('sender_city', current['sender_city']), 255),
                    clean(request.data.get('sender_city_ref', current['sender_city_ref']), 120),
                    clean(request.data.get('sender_warehouse', current['sender_warehouse']), 255),
                    clean(request.data.get('sender_warehouse_ref', current['sender_warehouse_ref']), 120),
                    is_default,
                    bool_value(request.data.get('is_active'), default=current.get('is_active')),
                    now,
                    company.id,
                    pk,
                ],
            )
        return Response({'message': 'Профіль Нової пошти оновлено.', 'profile': fetch_profile(company.id, pk)})

    @transaction.atomic
    def delete(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        current = fetch_profile(company.id, pk)
        if not current:
            return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM core_novapostprofile WHERE company_id=%s AND id=%s', [company.id, pk])
            if current.get('is_default'):
                cursor.execute('SELECT id FROM core_novapostprofile WHERE company_id=%s AND is_active=true ORDER BY id DESC LIMIT 1', [company.id])
                row = cursor.fetchone()
                if row:
                    cursor.execute('UPDATE core_novapostprofile SET is_default=true, updated_at=%s WHERE company_id=%s AND id=%s', [timezone.now(), company.id, row[0]])
        return Response({'message': 'Профіль Нової пошти видалено.'})


class NovaPostProfileTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        profile = fetch_profile(company.id, pk, include_secret=True)
        if not profile:
            return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        ok, message, raw = test_nova_post_key(profile.get('api_key'))
        return Response({
            'ok': ok,
            'message': message,
            'profile_id': pk,
            'profile_name': profile.get('name'),
            'api_key_masked': mask_key(profile.get('api_key')),
            'raw_success': bool(raw.get('success')) if isinstance(raw, dict) else False,
        }, status=200 if ok else 400)
