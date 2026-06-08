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
        'id': row[0], 'company_id': row[1], 'name': row[2] or 'Нова пошта', 'api_key_masked': mask_key(row[3]),
        'sender_name': row[4] or '', 'sender_phone': row[5] or '', 'sender_city': row[6] or '', 'sender_city_ref': row[7] or '',
        'sender_warehouse': row[8] or '', 'sender_warehouse_ref': row[9] or '', 'is_default': bool(row[10]), 'is_active': bool(row[11]),
        'created_at': row[12], 'updated_at': row[13],
    }
    if include_secret:
        data['api_key'] = row[3] or ''
    return data


def fetch_profile(company_id, profile_id, include_secret=False):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute('''SELECT id, company_id, name, api_key, sender_name, sender_phone, sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default, is_active, created_at, updated_at FROM core_novapostprofile WHERE company_id=%s AND id=%s LIMIT 1''', [company_id, profile_id])
        row = cursor.fetchone()
    return profile_payload(row, include_secret=include_secret) if row else None


def get_default_profile(company_id, include_secret=False):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute('''SELECT id, company_id, name, api_key, sender_name, sender_phone, sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default, is_active, created_at, updated_at FROM core_novapostprofile WHERE company_id=%s AND is_active=true ORDER BY is_default DESC, id DESC LIMIT 1''', [company_id])
        row = cursor.fetchone()
    return profile_payload(row, include_secret=include_secret) if row else None


def list_profiles(company_id):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute('''SELECT id, company_id, name, api_key, sender_name, sender_phone, sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default, is_active, created_at, updated_at FROM core_novapostprofile WHERE company_id=%s ORDER BY is_default DESC, is_active DESC, id DESC''', [company_id])
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


def nova_post_request(api_key, model_name, called_method, method_properties=None, timeout=12):
    payload = {'apiKey': clean(api_key), 'modelName': model_name, 'calledMethod': called_method, 'methodProperties': method_properties or {}}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(NOVA_POST_API_URL, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read().decode('utf-8')
        return json.loads(raw or '{}')


def active_api_key(company_id, profile_id=None):
    profile = fetch_profile(company_id, profile_id, include_secret=True) if profile_id else get_default_profile(company_id, include_secret=True)
    if not profile:
        return None, None
    return profile.get('api_key'), profile


def test_nova_post_key(api_key):
    api_key = clean(api_key)
    if not api_key:
        return False, 'API-ключ не вказано.', None
    try:
        result = nova_post_request(api_key, 'AddressGeneral', 'getCities', {'Limit': 1})
        if result.get('success'):
            return True, 'API-ключ працює. Підключення до Нової пошти успішне.', result
        errors = result.get('errors') or result.get('warnings') or []
        return False, '; '.join([str(x) for x in errors]) if errors else 'Нова пошта не підтвердила API-ключ.', result
    except Exception as exc:
        return False, f'Не вдалося перевірити API-ключ: {exc}', None


def city_payload(item):
    return {'ref': item.get('Ref') or '', 'description': item.get('Description') or '', 'description_ru': item.get('DescriptionRu') or '', 'area': item.get('AreaDescription') or item.get('Area') or '', 'settlement_type': item.get('SettlementTypeDescription') or '', 'raw': item}


def warehouse_payload(item):
    return {'ref': item.get('Ref') or '', 'description': item.get('Description') or '', 'description_ru': item.get('DescriptionRu') or '', 'number': item.get('Number') or '', 'short_address': item.get('ShortAddress') or '', 'city_ref': item.get('CityRef') or '', 'category': item.get('CategoryOfWarehouse') or '', 'raw': item}


def normalize_np_status(raw_item):
    text = raw_item.get('Status') or raw_item.get('StatusDescription') or raw_item.get('DocumentStatus') or 'Статус не визначено'
    code = str(raw_item.get('StatusCode') or raw_item.get('DocumentStatus') or '').lower()
    lowered = text.lower()
    if 'отрим' in lowered or code in ['9', '10', '11']:
        status = 'received'
    elif 'повер' in lowered or 'відмов' in lowered or code in ['102', '103', '106']:
        status = 'returned'
    elif 'прибул' in lowered or 'відділен' in lowered:
        status = 'arrived'
    elif 'дороз' in lowered or 'пряму' in lowered:
        status = 'in_transit'
    else:
        status = 'tracking'
    return status, text


def delivery_payload(row):
    tracking = row[22] or {}
    if isinstance(tracking, str):
        try:
            tracking = json.loads(tracking)
        except Exception:
            tracking = {}
    return {
        'id': row[0], 'company_id': row[1], 'visit_id': row[2], 'novapost_profile_id': row[3], 'service': row[4], 'ttn': row[5] or '',
        'status': row[6] or 'draft', 'status_text': row[7] or '', 'recipient_name': row[8] or '', 'recipient_phone': row[9] or '',
        'recipient_city': row[10] or '', 'recipient_city_ref': row[11] or '', 'recipient_warehouse': row[12] or '', 'recipient_warehouse_ref': row[13] or '',
        'payer_type': row[14] or 'recipient', 'payment_method': row[15] or 'cash', 'cod_enabled': bool(row[16]), 'cod_amount': float(row[17] or 0),
        'declared_value': float(row[18] or 0), 'weight': float(row[19] or 1), 'seats_amount': row[20] or 1, 'tracking_data': tracking,
        'created_at': row[23], 'updated_at': row[24], 'last_checked_at': row[25],
    }


def fetch_delivery(company_id, visit_id):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute('''SELECT id, company_id, visit_id, novapost_profile_id, service, ttn, status, status_text, recipient_name, recipient_phone, recipient_city, recipient_city_ref, recipient_warehouse, recipient_warehouse_ref, payer_type, payment_method, cod_enabled, cod_amount, declared_value, weight, seats_amount, tracking_data, created_at, updated_at, last_checked_at FROM core_delivery WHERE company_id=%s AND visit_id=%s AND service='nova_post' ORDER BY id DESC LIMIT 1''', [company_id, visit_id])
        row = cursor.fetchone()
    return delivery_payload(row) if row else None


def upsert_delivery(company_id, visit_id, data):
    repair_novapost_schema()
    existing = fetch_delivery(company_id, visit_id)
    now = timezone.now()
    with connection.cursor() as cursor:
        if existing:
            cursor.execute('''UPDATE core_delivery SET novapost_profile_id=%s, ttn=%s, status=%s, status_text=%s, recipient_name=%s, recipient_phone=%s, recipient_city=%s, recipient_city_ref=%s, recipient_warehouse=%s, recipient_warehouse_ref=%s, payer_type=%s, payment_method=%s, cod_enabled=%s, cod_amount=%s, declared_value=%s, weight=%s, seats_amount=%s, tracking_data=%s, updated_at=%s WHERE id=%s''', [data.get('novapost_profile_id'), clean(data.get('ttn'), 80), data.get('status') or existing.get('status') or 'draft', data.get('status_text') or existing.get('status_text') or '', clean(data.get('recipient_name'), 255), clean(data.get('recipient_phone'), 40), clean(data.get('recipient_city'), 255), clean(data.get('recipient_city_ref'), 120), clean(data.get('recipient_warehouse'), 255), clean(data.get('recipient_warehouse_ref'), 120), data.get('payer_type') or 'recipient', data.get('payment_method') or 'cash', bool_value(data.get('cod_enabled'), False), data.get('cod_amount') or 0, data.get('declared_value') or 0, data.get('weight') or 1, data.get('seats_amount') or 1, json.dumps(data.get('tracking_data') or existing.get('tracking_data') or {}), now, existing['id']])
            delivery_id = existing['id']
        else:
            cursor.execute('''INSERT INTO core_delivery (company_id, visit_id, novapost_profile_id, service, ttn, status, status_text, recipient_name, recipient_phone, recipient_city, recipient_city_ref, recipient_warehouse, recipient_warehouse_ref, payer_type, payment_method, cod_enabled, cod_amount, declared_value, weight, seats_amount, tracking_data, created_at, updated_at) VALUES (%s,%s,%s,'nova_post',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id''', [company_id, visit_id, data.get('novapost_profile_id'), clean(data.get('ttn'), 80), data.get('status') or 'manual', data.get('status_text') or 'ТТН внесено вручну', clean(data.get('recipient_name'), 255), clean(data.get('recipient_phone'), 40), clean(data.get('recipient_city'), 255), clean(data.get('recipient_city_ref'), 120), clean(data.get('recipient_warehouse'), 255), clean(data.get('recipient_warehouse_ref'), 120), data.get('payer_type') or 'recipient', data.get('payment_method') or 'cash', bool_value(data.get('cod_enabled'), False), data.get('cod_amount') or 0, data.get('declared_value') or 0, data.get('weight') or 1, data.get('seats_amount') or 1, json.dumps(data.get('tracking_data') or {}), now, now])
            delivery_id = cursor.fetchone()[0]
    return fetch_delivery(company_id, visit_id)


class NovaPostProfileListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        rows = list_profiles(company.id); return Response({'results': rows, 'count': len(rows)})
    @transaction.atomic
    def post(self, request):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        repair_novapost_schema(); api_key = clean(request.data.get('api_key'))
        if not api_key: return Response({'error': 'Вкажіть API-ключ Нової пошти.'}, status=400)
        name = clean(request.data.get('name') or 'Нова пошта', 160); now = timezone.now()
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM core_novapostprofile WHERE company_id=%s', [company.id]); is_first = int(cursor.fetchone()[0] or 0) == 0
            is_default = bool_value(request.data.get('is_default'), default=is_first)
            if is_default: cursor.execute('UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s', [company.id])
            cursor.execute('''INSERT INTO core_novapostprofile (company_id, name, api_key, sender_name, sender_phone, sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref, is_default, is_active, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id''', [company.id, name, api_key, clean(request.data.get('sender_name'), 255), clean(request.data.get('sender_phone'), 40), clean(request.data.get('sender_city'), 255), clean(request.data.get('sender_city_ref'), 120), clean(request.data.get('sender_warehouse'), 255), clean(request.data.get('sender_warehouse_ref'), 120), is_default, bool_value(request.data.get('is_active'), default=True), now, now])
            profile_id = cursor.fetchone()[0]
        return Response({'message': 'Профіль Нової пошти додано.', 'profile': fetch_profile(company.id, profile_id)}, status=201)


class NovaPostProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def patch(self, request, pk):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        current = fetch_profile(company.id, pk, include_secret=True)
        if not current: return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        api_key = clean(request.data.get('api_key')) if 'api_key' in request.data else current.get('api_key', '')
        is_default = bool_value(request.data.get('is_default'), default=current.get('is_default')); now = timezone.now()
        if is_default:
            with connection.cursor() as cursor: cursor.execute('UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s AND id<>%s', [company.id, pk])
        with connection.cursor() as cursor:
            cursor.execute('''UPDATE core_novapostprofile SET name=%s, api_key=%s, sender_name=%s, sender_phone=%s, sender_city=%s, sender_city_ref=%s, sender_warehouse=%s, sender_warehouse_ref=%s, is_default=%s, is_active=%s, updated_at=%s WHERE company_id=%s AND id=%s''', [clean(request.data.get('name', current['name']), 160), api_key, clean(request.data.get('sender_name', current['sender_name']), 255), clean(request.data.get('sender_phone', current['sender_phone']), 40), clean(request.data.get('sender_city', current['sender_city']), 255), clean(request.data.get('sender_city_ref', current['sender_city_ref']), 120), clean(request.data.get('sender_warehouse', current['sender_warehouse']), 255), clean(request.data.get('sender_warehouse_ref', current['sender_warehouse_ref']), 120), is_default, bool_value(request.data.get('is_active'), default=current.get('is_active')), now, company.id, pk])
        return Response({'message': 'Профіль Нової пошти оновлено.', 'profile': fetch_profile(company.id, pk)})
    @transaction.atomic
    def delete(self, request, pk):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        current = fetch_profile(company.id, pk)
        if not current: return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM core_novapostprofile WHERE company_id=%s AND id=%s', [company.id, pk])
            if current.get('is_default'):
                cursor.execute('SELECT id FROM core_novapostprofile WHERE company_id=%s AND is_active=true ORDER BY id DESC LIMIT 1', [company.id]); row = cursor.fetchone()
                if row: cursor.execute('UPDATE core_novapostprofile SET is_default=true, updated_at=%s WHERE company_id=%s AND id=%s', [timezone.now(), company.id, row[0]])
        return Response({'message': 'Профіль Нової пошти видалено.'})


class NovaPostProfileTestView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, pk):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        profile = fetch_profile(company.id, pk, include_secret=True)
        if not profile: return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        ok, message, raw = test_nova_post_key(profile.get('api_key'))
        return Response({'ok': ok, 'message': message, 'profile_id': pk, 'profile_name': profile.get('name'), 'api_key_masked': mask_key(profile.get('api_key')), 'raw_success': bool(raw.get('success')) if isinstance(raw, dict) else False}, status=200 if ok else 400)


class NovaPostCitiesView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        query = clean(request.query_params.get('q'), 120)
        if len(query) < 2: return Response({'results': [], 'count': 0, 'message': 'Введіть мінімум 2 символи.'})
        api_key, profile = active_api_key(company.id, profile_id=request.query_params.get('profile_id'))
        if not api_key: return Response({'error': 'Додайте активний профіль Нової пошти з API-ключем.'}, status=400)
        try:
            raw = nova_post_request(api_key, 'AddressGeneral', 'getCities', {'FindByString': query, 'Limit': 20})
            if not raw.get('success'):
                errors = raw.get('errors') or raw.get('warnings') or []
                return Response({'error': '; '.join([str(x) for x in errors]) or 'Нова пошта не повернула міста.'}, status=400)
            results = [city_payload(item) for item in raw.get('data', [])]
            return Response({'results': results, 'count': len(results), 'profile': {'id': profile.get('id'), 'name': profile.get('name')}})
        except Exception as exc:
            return Response({'error': f'Не вдалося знайти міста: {exc}'}, status=400)


class NovaPostWarehousesView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        city_ref = clean(request.query_params.get('city_ref'), 120)
        if not city_ref: return Response({'results': [], 'count': 0, 'message': 'Спочатку виберіть місто.'})
        api_key, profile = active_api_key(company.id, profile_id=request.query_params.get('profile_id'))
        if not api_key: return Response({'error': 'Додайте активний профіль Нової пошти з API-ключем.'}, status=400)
        props = {'CityRef': city_ref, 'Limit': 50}; query = clean(request.query_params.get('q'), 120)
        if query: props['FindByString'] = query
        try:
            raw = nova_post_request(api_key, 'AddressGeneral', 'getWarehouses', props)
            if not raw.get('success'):
                errors = raw.get('errors') or raw.get('warnings') or []
                return Response({'error': '; '.join([str(x) for x in errors]) or 'Нова пошта не повернула відділення.'}, status=400)
            results = [warehouse_payload(item) for item in raw.get('data', [])]
            return Response({'results': results, 'count': len(results), 'profile': {'id': profile.get('id'), 'name': profile.get('name')}})
        except Exception as exc:
            return Response({'error': f'Не вдалося знайти відділення: {exc}'}, status=400)


class NovaPostDeliveryView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, visit_id):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        delivery = fetch_delivery(company.id, visit_id)
        return Response({'delivery': delivery, 'profiles': list_profiles(company.id)})
    @transaction.atomic
    def post(self, request, visit_id):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        profile_id = request.data.get('novapost_profile_id') or None
        if profile_id and not fetch_profile(company.id, profile_id): return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)
        delivery = upsert_delivery(company.id, visit_id, {**request.data, 'novapost_profile_id': profile_id})
        return Response({'message': 'Доставку збережено.', 'delivery': delivery})


class NovaPostDeliveryStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, visit_id):
        repair_legacy_account(request.user); company = get_user_company(request.user)
        if not company: return Response({'error': 'Компанію не знайдено.'}, status=403)
        delivery = fetch_delivery(company.id, visit_id)
        if not delivery or not delivery.get('ttn'): return Response({'error': 'Спочатку внесіть ТТН.'}, status=400)
        api_key, profile = active_api_key(company.id, profile_id=delivery.get('novapost_profile_id'))
        if not api_key: return Response({'error': 'Додайте активний профіль Нової пошти з API-ключем.'}, status=400)
        try:
            raw = nova_post_request(api_key, 'TrackingDocument', 'getStatusDocuments', {'Documents': [{'DocumentNumber': delivery.get('ttn')}]})
            if not raw.get('success'):
                errors = raw.get('errors') or raw.get('warnings') or []
                return Response({'error': '; '.join([str(x) for x in errors]) or 'Не вдалося отримати статус ТТН.'}, status=400)
            item = (raw.get('data') or [{}])[0]
            status, text = normalize_np_status(item)
            history = delivery.get('tracking_data') or {}
            events = history.get('events') if isinstance(history, dict) else []
            if not isinstance(events, list): events = []
            now = timezone.now()
            events.insert(0, {'time': now.isoformat(), 'status': status, 'text': text, 'raw': item})
            data = {**delivery, 'status': status, 'status_text': text, 'tracking_data': {'last': item, 'events': events[:30]}}
            saved = upsert_delivery(company.id, visit_id, data)
            with connection.cursor() as cursor:
                cursor.execute('UPDATE core_delivery SET last_checked_at=%s WHERE id=%s', [now, saved['id']])
            saved = fetch_delivery(company.id, visit_id)
            return Response({'message': 'Статус Нової пошти оновлено.', 'delivery': saved})
        except Exception as exc:
            return Response({'error': f'Не вдалося оновити статус: {exc}'}, status=400)
