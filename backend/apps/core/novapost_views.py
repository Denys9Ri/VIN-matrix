import json
import urllib.request

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import log_activity
from .db_repair_novapost import repair_novapost_schema
from .models import Visit
from .partner_views import get_user_company, repair_legacy_account


NP_URL = 'https://api.novaposhta.ua/v2.0/json/'


def clean(v, limit=None):
    v = str(v or '').strip()
    return v[:limit] if limit else v


def num(v, default=0):
    try:
        return float(str(v if v not in [None, ''] else default).replace(',', '.'))
    except Exception:
        return default


def int_or_none(v):
    try:
        if v in [None, '']:
            return None
        return int(v)
    except Exception:
        return None


def yes(v, default=False):
    if v is None:
        return default
    if v in [True, 'true', '1', 1, 'yes', 'on']:
        return True
    if v in [False, 'false', '0', 0, 'no', 'off']:
        return False
    return default


def masked(v):
    v = clean(v)
    return '' if not v else ('••••' if len(v) <= 8 else f'{v[:4]}••••{v[-4:]}')


def normalize_payer(v):
    return 'Sender' if v in ['sender', 'Sender'] else 'Recipient'


def normalize_payment_method(v):
    return 'NonCash' if v in ['noncash', 'NonCash'] else 'Cash'


def np_call(secret, model, method, props=None, timeout=20):
    payload = {
        'api' + 'Key': clean(secret),
        'modelName': model,
        'calledMethod': method,
        'methodProperties': props or {},
    }

    req = urllib.request.Request(
        NP_URL,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8') or '{}')


def profile_row(row, secret=False):
    data = {
        'id': row[0],
        'company_id': row[1],
        'name': row[2] or 'Нова пошта',
        'api_key_masked': masked(row[3]),
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

    if secret:
        data['api_key'] = row[3] or ''

    return data


def get_profile(company_id, profile_id=None, secret=False):
    repair_novapost_schema()

    profile_id = int_or_none(profile_id)

    where = 'company_id=%s AND is_active=true ORDER BY is_default DESC, id DESC LIMIT 1'
    params = [company_id]

    if profile_id:
        where = 'company_id=%s AND id=%s LIMIT 1'
        params = [company_id, profile_id]

    with connection.cursor() as c:
        c.execute(
            f'''
            SELECT
                id, company_id, name, api_key, sender_name, sender_phone,
                sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref,
                is_default, is_active, created_at, updated_at
            FROM core_novapostprofile
            WHERE {where}
            ''',
            params,
        )
        row = c.fetchone()

    return profile_row(row, secret) if row else None


def profiles(company_id):
    repair_novapost_schema()

    with connection.cursor() as c:
        c.execute(
            '''
            SELECT
                id, company_id, name, api_key, sender_name, sender_phone,
                sender_city, sender_city_ref, sender_warehouse, sender_warehouse_ref,
                is_default, is_active, created_at, updated_at
            FROM core_novapostprofile
            WHERE company_id=%s
            ORDER BY is_default DESC, is_active DESC, id DESC
            ''',
            [company_id],
        )
        return [profile_row(x) for x in c.fetchall()]


def delivery_row(row):
    tracking_data = row[21] or {}

    if isinstance(tracking_data, str):
        try:
            tracking_data = json.loads(tracking_data)
        except Exception:
            tracking_data = {}

    return {
        'id': row[0],
        'company_id': row[1],
        'visit_id': row[2],
        'novapost_profile_id': row[3],
        'service': row[4],
        'ttn': row[5] or '',
        'status': row[6] or 'draft',
        'status_text': row[7] or '',
        'recipient_name': row[8] or '',
        'recipient_phone': row[9] or '',
        'recipient_city': row[10] or '',
        'recipient_city_ref': row[11] or '',
        'recipient_warehouse': row[12] or '',
        'recipient_warehouse_ref': row[13] or '',
        'payer_type': normalize_payer(row[14]),
        'payment_method': normalize_payment_method(row[15]),
        'cod_enabled': bool(row[16]),
        'cod_amount': float(row[17] or 0),
        'declared_value': float(row[18] or 0),
        'cost': float(row[18] or 0),
        'weight': float(row[19] or 1),
        'seats_amount': row[20] or 1,
        'tracking_data': tracking_data,
        'created_at': row[22],
        'updated_at': row[23],
        'last_checked_at': row[24],
    }


def get_delivery(company_id, visit_id):
    repair_novapost_schema()

    with connection.cursor() as c:
        c.execute(
            '''
            SELECT
                id, company_id, visit_id, novapost_profile_id, service, ttn,
                status, status_text, recipient_name, recipient_phone,
                recipient_city, recipient_city_ref, recipient_warehouse,
                recipient_warehouse_ref, payer_type, payment_method,
                cod_enabled, cod_amount, declared_value, weight, seats_amount,
                tracking_data, created_at, updated_at, last_checked_at
            FROM core_delivery
            WHERE company_id=%s AND visit_id=%s AND service='nova_post'
            ORDER BY id DESC
            LIMIT 1
            ''',
            [company_id, visit_id],
        )
        row = c.fetchone()

    return delivery_row(row) if row else None


def save_delivery(company_id, visit_id, data):
    old = get_delivery(company_id, visit_id) or {}
    now = timezone.now()

    declared_value = data.get('declared_value')
    if declared_value in [None, '']:
        declared_value = data.get('cost', old.get('declared_value', 0))

    tracking_data = data.get('tracking_data', old.get('tracking_data') or {})
    tracking_json = json.dumps(tracking_data or {}, ensure_ascii=False)

    vals = [
        int_or_none(data.get('novapost_profile_id', old.get('novapost_profile_id'))),
        clean(data.get('ttn', old.get('ttn')), 80),
        data.get('status', old.get('status') or 'manual'),
        data.get('status_text', old.get('status_text') or 'ТТН внесено вручну'),
        clean(data.get('recipient_name', old.get('recipient_name')), 255),
        clean(data.get('recipient_phone', old.get('recipient_phone')), 40),
        clean(data.get('recipient_city', old.get('recipient_city')), 255),
        clean(data.get('recipient_city_ref', old.get('recipient_city_ref')), 120),
        clean(data.get('recipient_warehouse', old.get('recipient_warehouse')), 255),
        clean(data.get('recipient_warehouse_ref', old.get('recipient_warehouse_ref')), 120),
        normalize_payer(data.get('payer_type', old.get('payer_type'))),
        normalize_payment_method(data.get('payment_method', old.get('payment_method'))),
        yes(data.get('cod_enabled', old.get('cod_enabled')), False),
        num(data.get('cod_amount', old.get('cod_amount')), 0),
        num(declared_value, 0),
        num(data.get('weight', old.get('weight')), 1),
        int(num(data.get('seats_amount', old.get('seats_amount')), 1) or 1),
        tracking_json,
        now,
    ]

    with connection.cursor() as c:
        if old:
            c.execute(
                '''
                UPDATE core_delivery SET
                    novapost_profile_id=%s,
                    ttn=%s,
                    status=%s,
                    status_text=%s,
                    recipient_name=%s,
                    recipient_phone=%s,
                    recipient_city=%s,
                    recipient_city_ref=%s,
                    recipient_warehouse=%s,
                    recipient_warehouse_ref=%s,
                    payer_type=%s,
                    payment_method=%s,
                    cod_enabled=%s,
                    cod_amount=%s,
                    declared_value=%s,
                    weight=%s,
                    seats_amount=%s,
                    tracking_data=%s,
                    updated_at=%s
                WHERE id=%s
                ''',
                vals + [old['id']],
            )
        else:
            c.execute(
                '''
                INSERT INTO core_delivery (
                    company_id, visit_id, novapost_profile_id, service,
                    ttn, status, status_text,
                    recipient_name, recipient_phone, recipient_city, recipient_city_ref,
                    recipient_warehouse, recipient_warehouse_ref,
                    payer_type, payment_method,
                    cod_enabled, cod_amount, declared_value,
                    weight, seats_amount, tracking_data,
                    created_at, updated_at
                ) VALUES (
                    %s,%s,%s,'nova_post',
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,
                    %s,%s,
                    %s,%s,%s,
                    %s,%s,%s,
                    %s,%s
                )
                ''',
                [company_id, visit_id] + vals + [now],
            )

    return get_delivery(company_id, visit_id)


def status_map(item):
    text = item.get('Status') or item.get('StatusDescription') or 'Статус не визначено'
    low = text.lower()

    if 'отрим' in low:
        return 'received', text
    if 'повер' in low or 'відмов' in low:
        return 'returned', text
    if 'прибул' in low:
        return 'arrived', text
    if 'дороз' in low or 'пряму' in low:
        return 'in_transit', text

    return 'tracking', text


def first_sender(secret):
    senders_response = np_call(
        secret,
        'Counterparty',
        'getCounterparties',
        {
            'CounterpartyProperty': 'Sender',
            'Page': '1',
        },
    )

    if not senders_response.get('success') or not senders_response.get('data'):
        return None, None, senders_response

    sender = senders_response['data'][0]

    contacts_response = np_call(
        secret,
        'Counterparty',
        'getCounterpartyContactPersons',
        {
            'Ref': sender.get('Ref'),
            'Page': '1',
        },
    )

    contact = (contacts_response.get('data') or [{}])[0] if contacts_response.get('success') else {}

    return sender, contact, {
        'sender': sender,
        'contact': contact,
    }


def build_ttn(secret, profile, data):
    missing = []

    for key, label in [
        ('sender_city_ref', 'місто відправника'),
        ('sender_warehouse_ref', 'відділення відправника'),
    ]:
        if not clean(profile.get(key)):
            missing.append(label)

    for key, label in [
        ('recipient_name', 'одержувач'),
        ('recipient_phone', 'телефон'),
        ('recipient_city_ref', 'місто отримувача'),
        ('recipient_warehouse_ref', 'відділення отримувача'),
    ]:
        if not clean(data.get(key)):
            missing.append(label)

    if missing:
        return None, 'Заповніть: ' + ', '.join(missing)

    sender, contact, raw = first_sender(secret)

    if not sender or not contact:
        return None, 'Не вдалося отримати відправника з кабінету Нової пошти. Перевірте API-ключ.'

    payer = normalize_payer(data.get('payer_type'))
    payment_method = normalize_payment_method(data.get('payment_method'))

    declared_value = data.get('declared_value')
    if declared_value in [None, '']:
        declared_value = data.get('cost')

    props = {
        'PayerType': payer,
        'PaymentMethod': payment_method,
        'DateTime': timezone.now().strftime('%d.%m.%Y'),
        'CargoType': 'Parcel',
        'ServiceType': 'WarehouseWarehouse',
        'SeatsAmount': str(int(num(data.get('seats_amount'), 1) or 1)),
        'Description': clean(data.get('description') or 'Автозапчастини', 120),
        'Cost': str(num(declared_value, 1) or 1),
        'Weight': str(num(data.get('weight'), 1) or 1),
        'CitySender': profile.get('sender_city_ref'),
        'Sender': sender.get('Ref'),
        'SenderAddress': profile.get('sender_warehouse_ref'),
        'ContactSender': contact.get('Ref'),
        'SendersPhone': clean(profile.get('sender_phone') or contact.get('Phones'), 40),
        'RecipientType': 'PrivatePerson',
        'RecipientName': clean(data.get('recipient_name'), 255),
        'RecipientsPhone': clean(data.get('recipient_phone'), 40),
        'CityRecipient': clean(data.get('recipient_city_ref'), 120),
        'RecipientAddress': clean(data.get('recipient_warehouse_ref'), 120),
    }

    if yes(data.get('cod_enabled'), False) and num(data.get('cod_amount'), 0) > 0:
        props['BackwardDeliveryData'] = [
            {
                'PayerType': 'Recipient',
                'CargoType': 'Money',
                'RedeliveryString': str(num(data.get('cod_amount'), 0)),
            }
        ]

    return props, None


def delivery_status_is_final(status):
    return clean(status).lower() in ['received', 'returned', 'cancelled', 'deleted']


def get_active_deliveries(company_id, limit=25):
    repair_novapost_schema()

    try:
        limit = min(max(int(limit or 25), 1), 50)
    except Exception:
        limit = 25

    with connection.cursor() as c:
        c.execute(
            '''
            SELECT
                id, company_id, visit_id, novapost_profile_id, service, ttn,
                status, status_text, recipient_name, recipient_phone,
                recipient_city, recipient_city_ref, recipient_warehouse,
                recipient_warehouse_ref, payer_type, payment_method,
                cod_enabled, cod_amount, declared_value, weight, seats_amount,
                tracking_data, created_at, updated_at, last_checked_at
            FROM core_delivery
            WHERE company_id=%s
              AND service='nova_post'
              AND COALESCE(ttn, '') <> ''
              AND COALESCE(status, '') NOT IN ('received', 'returned', 'cancelled', 'deleted')
            ORDER BY COALESCE(last_checked_at, created_at) ASC, id ASC
            LIMIT %s
            ''',
            [company_id, limit],
        )
        return [delivery_row(row) for row in c.fetchall()]


def update_visit_delivery_data(company, visit_id, delivery):
    try:
        visit = Visit.objects.get(id=visit_id, company=company)
    except Exception:
        return None

    try:
        current = visit.delivery_data or {}

        if isinstance(current, str):
            try:
                current = json.loads(current) if current.strip().startswith('{') else {}
            except Exception:
                current = {}

        if not isinstance(current, dict):
            current = {}

        next_delivery = {
            **current,
            'mode': current.get('mode') or 'store',
            'service': 'nova_post',
            'ttn': delivery.get('ttn') or current.get('ttn') or '',
            'delivery_status': delivery.get('status') or current.get('delivery_status') or '',
            'delivery_status_text': delivery.get('status_text') or current.get('delivery_status_text') or '',
            'recipient_name': delivery.get('recipient_name') or current.get('recipient_name') or '',
            'recipient_phone': delivery.get('recipient_phone') or current.get('recipient_phone') or '',
            'recipient_city': delivery.get('recipient_city') or current.get('recipient_city') or '',
            'recipient_city_ref': delivery.get('recipient_city_ref') or current.get('recipient_city_ref') or '',
            'recipient_warehouse': delivery.get('recipient_warehouse') or current.get('recipient_warehouse') or '',
            'recipient_warehouse_ref': delivery.get('recipient_warehouse_ref') or current.get('recipient_warehouse_ref') or '',
            'payer_type': delivery.get('payer_type') or current.get('payer_type') or 'Recipient',
            'payment_method': delivery.get('payment_method') or current.get('payment_method') or 'Cash',
            'cod_enabled': bool(delivery.get('cod_enabled')),
            'cod_amount': delivery.get('cod_amount') or 0,
            'cost': delivery.get('cost') or delivery.get('declared_value') or current.get('cost') or '',
            'weight': delivery.get('weight') or current.get('weight') or '1',
            'seats_amount': delivery.get('seats_amount') or current.get('seats_amount') or '1',
            'novapost_last_checked_at': timezone.now().isoformat(),
        }

        visit.delivery_data = json.dumps(next_delivery, ensure_ascii=False)
        visit.save(update_fields=['delivery_data'])

        return visit
    except Exception as exc:
        print(f'NovaPost visit delivery_data update failed: {exc}')
        return visit


def refresh_single_delivery_status(company, user, delivery):
    old_status = delivery.get('status') or ''
    old_text = delivery.get('status_text') or ''
    ttn = delivery.get('ttn') or ''

    result = {
        'delivery_id': delivery.get('id'),
        'visit_id': delivery.get('visit_id'),
        'ttn': ttn,
        'old_status': old_status,
        'old_status_text': old_text,
        'status': old_status,
        'status_text': old_text,
        'updated': False,
        'ok': False,
    }

    if not ttn:
        result['error'] = 'Немає ТТН.'
        return result

    if delivery_status_is_final(old_status):
        result['ok'] = True
        result['skipped'] = True
        result['error'] = 'Фінальний статус не перевіряється.'
        return result

    profile = (
        get_profile(company.id, delivery.get('novapost_profile_id'), True)
        or get_profile(company.id, None, True)
    )

    if not profile:
        result['error'] = 'Немає активного профілю Нової пошти.'
        return result

    try:
        raw = np_call(
            profile.get('api_key'),
            'TrackingDocument',
            'getStatusDocuments',
            {'Documents': [{'DocumentNumber': ttn}]},
            timeout=20,
        )
    except Exception as exc:
        result['error'] = str(exc)
        return result

    if not raw.get('success'):
        result['error'] = '; '.join(map(str, raw.get('errors') or raw.get('warnings') or [])) or 'Не вдалося отримати статус.'
        result['raw'] = raw
        return result

    item = (raw.get('data') or [{}])[0] or {}
    status, text = status_map(item)

    history = delivery.get('tracking_data') or {}
    events = history.get('events') if isinstance(history, dict) else []

    if not isinstance(events, list):
        events = []

    changed = status != old_status or text != old_text

    if changed:
        events.insert(
            0,
            {
                'time': timezone.now().isoformat(),
                'status': status,
                'text': text,
                'raw': item,
            },
        )

    saved = save_delivery(
        company.id,
        delivery.get('visit_id'),
        {
            **delivery,
            'status': status,
            'status_text': text,
            'tracking_data': {
                'last': item,
                'events': events[:30],
            },
        },
    )

    with connection.cursor() as c:
        c.execute(
            'UPDATE core_delivery SET last_checked_at=%s WHERE id=%s',
            [timezone.now(), saved['id']],
        )

    saved = get_delivery(company.id, delivery.get('visit_id')) or saved
    visit = update_visit_delivery_data(company, delivery.get('visit_id'), saved)

    if changed:
        log_activity(
            company=company,
            user=user,
            visit=visit,
            mode='store',
            action_type='novapost_status_changed',
            title='Оновлено статус Нової пошти',
            description=f'ТТН {ttn}: {old_text or old_status or "—"} → {text or status}',
            old_value=old_text or old_status,
            new_value=text or status,
            metadata={
                'ttn': ttn,
                'delivery_id': delivery.get('id'),
                'old_status': old_status,
                'new_status': status,
                'old_status_text': old_text,
                'new_status_text': text,
                'service': 'nova_post',
            },
        )

    result.update({
        'ok': True,
        'status': status,
        'status_text': text,
        'updated': changed,
    })

    return result


class NovaPostProfileListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        rows = profiles(company.id)

        return Response({
            'results': rows,
            'profiles': rows,
            'count': len(rows),
        })

    @transaction.atomic
    def post(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        if not clean(request.data.get('api_key')):
            return Response({'error': 'Вкажіть API-ключ Нової пошти.'}, status=400)

        now = timezone.now()
        is_default = yes(request.data.get('is_default'), False)

        with connection.cursor() as c:
            c.execute(
                'SELECT COUNT(*) FROM core_novapostprofile WHERE company_id=%s',
                [company.id],
            )
            is_first = int(c.fetchone()[0] or 0) == 0

            if is_default or is_first:
                c.execute(
                    'UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s',
                    [company.id],
                )

            c.execute(
                '''
                INSERT INTO core_novapostprofile (
                    company_id, name, api_key,
                    sender_name, sender_phone, sender_city, sender_city_ref,
                    sender_warehouse, sender_warehouse_ref,
                    is_default, is_active, created_at, updated_at
                ) VALUES (
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,
                    %s,%s,%s,%s
                )
                RETURNING id
                ''',
                [
                    company.id,
                    clean(request.data.get('name') or 'Нова пошта', 160),
                    clean(request.data.get('api_key')),
                    clean(request.data.get('sender_name'), 255),
                    clean(request.data.get('sender_phone'), 40),
                    clean(request.data.get('sender_city'), 255),
                    clean(request.data.get('sender_city_ref'), 120),
                    clean(request.data.get('sender_warehouse'), 255),
                    clean(request.data.get('sender_warehouse_ref'), 120),
                    bool(is_default or is_first),
                    yes(request.data.get('is_active'), True),
                    now,
                    now,
                ],
            )
            profile_id = c.fetchone()[0]

        return Response(
            {
                'message': 'Профіль Нової пошти додано.',
                'profile': get_profile(company.id, profile_id),
            },
            status=201,
        )


class NovaPostProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        old = get_profile(company.id, pk, True)

        if not old:
            return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)

        is_default = yes(request.data.get('is_default'), old.get('is_default'))

        if is_default:
            with connection.cursor() as c:
                c.execute(
                    'UPDATE core_novapostprofile SET is_default=false WHERE company_id=%s AND id<>%s',
                    [company.id, pk],
                )

        with connection.cursor() as c:
            c.execute(
                '''
                UPDATE core_novapostprofile SET
                    name=%s,
                    api_key=%s,
                    sender_name=%s,
                    sender_phone=%s,
                    sender_city=%s,
                    sender_city_ref=%s,
                    sender_warehouse=%s,
                    sender_warehouse_ref=%s,
                    is_default=%s,
                    is_active=%s,
                    updated_at=%s
                WHERE company_id=%s AND id=%s
                ''',
                [
                    clean(request.data.get('name', old['name']), 160),
                    clean(request.data.get('api_key')) if 'api_key' in request.data else old.get('api_key'),
                    clean(request.data.get('sender_name', old['sender_name']), 255),
                    clean(request.data.get('sender_phone', old['sender_phone']), 40),
                    clean(request.data.get('sender_city', old['sender_city']), 255),
                    clean(request.data.get('sender_city_ref', old['sender_city_ref']), 120),
                    clean(request.data.get('sender_warehouse', old['sender_warehouse']), 255),
                    clean(request.data.get('sender_warehouse_ref', old['sender_warehouse_ref']), 120),
                    is_default,
                    yes(request.data.get('is_active'), old.get('is_active')),
                    timezone.now(),
                    company.id,
                    pk,
                ],
            )

        return Response({
            'message': 'Профіль Нової пошти оновлено.',
            'profile': get_profile(company.id, pk),
        })

    @transaction.atomic
    def delete(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        with connection.cursor() as c:
            c.execute(
                'DELETE FROM core_novapostprofile WHERE company_id=%s AND id=%s',
                [company.id, pk],
            )

        return Response({'message': 'Профіль Нової пошти видалено.'})


class NovaPostProfileTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        profile = get_profile(company.id, pk, True)

        if not profile:
            return Response({'error': 'Профіль Нової пошти не знайдено.'}, status=404)

        try:
            raw = np_call(
                profile.get('api_key'),
                'AddressGeneral',
                'getCities',
                {'Limit': 1},
            )
            ok = bool(raw.get('success'))
            errors = raw.get('errors') or raw.get('warnings') or []

            return Response(
                {
                    'ok': ok,
                    'message': 'API-ключ працює.' if ok else '; '.join(map(str, errors)) or 'Ключ не підтверджено.',
                    'api_key_masked': masked(profile.get('api_key')),
                },
                status=200 if ok else 400,
            )
        except Exception as e:
            return Response({'ok': False, 'message': str(e)}, status=400)


class NovaPostCitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        query = clean(request.query_params.get('q'), 120)

        if len(query) < 2:
            return Response({'results': [], 'count': 0})

        profile = get_profile(company.id, request.query_params.get('profile_id'), True) or get_profile(company.id, None, True)

        if not profile:
            return Response({'error': 'Додайте активний профіль Нової пошти.'}, status=400)

        try:
            raw = np_call(
                profile.get('api_key'),
                'AddressGeneral',
                'getCities',
                {
                    'FindByString': query,
                    'Limit': 20,
                },
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        if not raw.get('success'):
            return Response(
                {
                    'error': '; '.join(map(str, raw.get('errors') or raw.get('warnings') or [])) or 'Помилка пошуку міст.',
                },
                status=400,
            )

        results = [
            {
                'ref': x.get('Ref') or '',
                'description': x.get('Description') or '',
                'area': x.get('AreaDescription') or '',
                'settlement_type': x.get('SettlementTypeDescription') or '',
                'raw': x,
            }
            for x in raw.get('data', [])
        ]

        return Response({'results': results, 'count': len(results)})


class NovaPostWarehousesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        city_ref = clean(request.query_params.get('city_ref'), 120)

        if not city_ref:
            return Response({'results': [], 'count': 0})

        profile = get_profile(company.id, request.query_params.get('profile_id'), True) or get_profile(company.id, None, True)

        if not profile:
            return Response({'error': 'Додайте активний профіль Нової пошти.'}, status=400)

        props = {
            'CityRef': city_ref,
            'Limit': 50,
        }

        query = clean(request.query_params.get('q'), 120)

        if query:
            props['FindByString'] = query

        try:
            raw = np_call(profile.get('api_key'), 'AddressGeneral', 'getWarehouses', props)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        if not raw.get('success'):
            return Response(
                {
                    'error': '; '.join(map(str, raw.get('errors') or raw.get('warnings') or [])) or 'Помилка пошуку відділень.',
                },
                status=400,
            )

        results = [
            {
                'ref': x.get('Ref') or '',
                'description': x.get('Description') or '',
                'number': x.get('Number') or '',
                'short_address': x.get('ShortAddress') or '',
                'raw': x,
            }
            for x in raw.get('data', [])
        ]

        return Response({'results': results, 'count': len(results)})


class NovaPostDeliveryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        return Response({
            'delivery': get_delivery(company.id, visit_id),
            'profiles': profiles(company.id),
        })

    @transaction.atomic
    def post(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        return Response({
            'message': 'Доставку збережено.',
            'delivery': save_delivery(company.id, visit_id, request.data),
        })


class NovaPostDeliveryStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        delivery = get_delivery(company.id, visit_id)

        if not delivery or not delivery.get('ttn'):
            return Response({'error': 'Спочатку внесіть ТТН.'}, status=400)

        result = refresh_single_delivery_status(company, request.user, delivery)

        if not result.get('ok'):
            return Response({'error': result.get('error') or 'Не вдалося отримати статус.'}, status=400)

        return Response({
            'message': 'Статус Нової пошти оновлено.',
            'delivery': get_delivery(company.id, visit_id),
            'result': result,
        })


class NovaPostDeliveryCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        profile = get_profile(company.id, request.data.get('novapost_profile_id'), True) or get_profile(company.id, None, True)

        if not profile:
            return Response({'error': 'Додайте активний профіль Нової пошти.'}, status=400)

        props, error = build_ttn(profile.get('api_key'), profile, request.data)

        if error:
            return Response({'error': error}, status=400)

        try:
            raw = np_call(
                profile.get('api_key'),
                'InternetDocument',
                'save',
                props,
                timeout=25,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        if not raw.get('success'):
            return Response(
                {
                    'error': '; '.join(map(str, raw.get('errors') or raw.get('warnings') or [])) or 'Нова пошта не створила ТТН.',
                    'raw': raw,
                },
                status=400,
            )

        item = (raw.get('data') or [{}])[0]
        ttn = item.get('IntDocNumber') or item.get('Number') or ''

        if not ttn:
            return Response(
                {
                    'error': 'ТТН не повернулась у відповіді Нової пошти.',
                    'raw': raw,
                },
                status=400,
            )

        tracking = {
            'last': item,
            'events': [
                {
                    'time': timezone.now().isoformat(),
                    'status': 'created',
                    'text': f'Створено ТТН {ttn}',
                    'raw': item,
                }
            ],
        }

        saved = save_delivery(
            company.id,
            visit_id,
            {
                **request.data,
                'novapost_profile_id': profile.get('id'),
                'ttn': ttn,
                'status': 'created',
                'status_text': 'ТТН створено у Новій пошті',
                'tracking_data': tracking,
            },
        )

        visit = update_visit_delivery_data(company, visit_id, saved)

        log_activity(
            company=company,
            user=request.user,
            visit=visit,
            mode='store',
            action_type='novapost_ttn_created',
            title='Створено ТТН Нової пошти',
            description=f'Створено ТТН {ttn}',
            old_value=None,
            new_value=ttn,
            metadata={
                'ttn': ttn,
                'delivery_id': saved.get('id'),
                'service': 'nova_post',
            },
        )

        return Response(
            {
                'message': 'ТТН створено.',
                'delivery': saved,
            },
            status=201,
        )


class NovaPostDeliveryRefreshActiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)

        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)

        limit = request.data.get('limit') or request.query_params.get('limit') or 25
        deliveries = get_active_deliveries(company.id, limit)

        results = []
        checked = 0
        updated = 0
        errors = 0

        for delivery in deliveries:
            checked += 1
            item = refresh_single_delivery_status(company, request.user, delivery)
            results.append(item)

            if item.get('updated'):
                updated += 1

            if not item.get('ok'):
                errors += 1

        return Response({
            'message': f'Перевірено активні ТТН Нової пошти: {checked}. Оновлено: {updated}.',
            'checked': checked,
            'updated': updated,
            'errors': errors,
            'results': results,
        })
