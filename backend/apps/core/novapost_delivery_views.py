import json

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .db_repair_novapost import repair_novapost_schema
from .novapost_views import active_api_key, clean, fetch_profile, get_default_profile, list_profiles, nova_post_request
from .partner_views import get_user_company, repair_legacy_account


def money_value(value):
    try:
        return round(float(value or 0), 2)
    except Exception:
        return 0


def delivery_payload(row):
    if not row:
        return None
    tracking = row[21] or {}
    if isinstance(tracking, str):
        try:
            tracking = json.loads(tracking)
        except Exception:
            tracking = {}
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
        'payer_type': row[14] or 'recipient',
        'payment_method': row[15] or 'cash',
        'cod_enabled': bool(row[16]),
        'cod_amount': float(row[17] or 0),
        'declared_value': float(row[18] or 0),
        'weight': float(row[19] or 1),
        'seats_amount': int(row[20] or 1),
        'tracking_data': tracking,
        'created_at': row[22],
        'updated_at': row[23],
        'last_checked_at': row[24],
    }


def fetch_delivery(company_id, visit_id):
    repair_novapost_schema()
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT id, company_id, visit_id, novapost_profile_id, service, ttn, status, status_text,
                   recipient_name, recipient_phone, recipient_city, recipient_city_ref,
                   recipient_warehouse, recipient_warehouse_ref, payer_type, payment_method,
                   cod_enabled, cod_amount, declared_value, weight, seats_amount, tracking_data,
                   created_at, updated_at, last_checked_at
            FROM core_delivery
            WHERE company_id=%s AND visit_id=%s AND service='nova_post'
            ORDER BY id DESC
            LIMIT 1
            ''',
            [company_id, visit_id],
        )
        row = cursor.fetchone()
    return delivery_payload(row)


def normalize_np_status(item):
    raw_status = str(item.get('Status') or item.get('StatusDescription') or '').lower()
    status_code = str(item.get('StatusCode') or '')
    status_text = item.get('Status') or item.get('StatusDescription') or item.get('DocumentStatus') or 'Статус оновлено'
    if status_code in ['9', '10', '11'] or 'отрим' in raw_status:
        return 'received', status_text
    if status_code in ['102', '103', '104', '105', '106'] or 'повер' in raw_status or 'відмов' in raw_status:
        return 'returned', status_text
    if status_code in ['4', '5', '6', '7', '8'] or 'дороз' in raw_status or 'відділен' in raw_status or 'прибул' in raw_status:
        return 'in_transit', status_text
    return 'created', status_text


def merge_history(existing, item):
    tracking = existing if isinstance(existing, dict) else {}
    history = tracking.get('history') if isinstance(tracking.get('history'), list) else []
    history.append(item)
    tracking['history'] = history[-30:]
    return tracking


class NovaPostDeliveryByVisitView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        return Response({'delivery': fetch_delivery(company.id, visit_id), 'profiles': list_profiles(company.id)})

    @transaction.atomic
    def post(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        repair_novapost_schema()
        profile_id = request.data.get('novapost_profile_id') or request.data.get('profile_id')
        profile = fetch_profile(company.id, profile_id) if profile_id else get_default_profile(company.id)
        now = timezone.now()
        existing = fetch_delivery(company.id, visit_id)
        ttn = clean(request.data.get('ttn'), 80)
        if not ttn:
            return Response({'error': 'Вкажіть ТТН.'}, status=400)
        values = {
            'profile_id': profile.get('id') if profile else None,
            'ttn': ttn,
            'status': clean(request.data.get('status') or 'manual', 80),
            'status_text': clean(request.data.get('status_text') or 'ТТН внесено вручну', 255),
            'recipient_name': clean(request.data.get('recipient_name'), 255),
            'recipient_phone': clean(request.data.get('recipient_phone'), 40),
            'recipient_city': clean(request.data.get('recipient_city'), 255),
            'recipient_city_ref': clean(request.data.get('recipient_city_ref'), 120),
            'recipient_warehouse': clean(request.data.get('recipient_warehouse'), 255),
            'recipient_warehouse_ref': clean(request.data.get('recipient_warehouse_ref'), 120),
            'payer_type': clean(request.data.get('payer_type') or 'recipient', 40),
            'payment_method': clean(request.data.get('payment_method') or 'cash', 40),
            'cod_enabled': request.data.get('cod_enabled') in [True, 'true', '1', 1],
            'cod_amount': money_value(request.data.get('cod_amount')),
            'declared_value': money_value(request.data.get('declared_value')),
            'weight': money_value(request.data.get('weight')) or 1,
            'seats_amount': int(float(request.data.get('seats_amount') or 1)),
        }
        tracking = merge_history((existing or {}).get('tracking_data') or {}, {'time': now.isoformat(), 'title': 'ТТН збережено вручну', 'description': values['status_text']})
        with connection.cursor() as cursor:
            if existing:
                cursor.execute(
                    '''
                    UPDATE core_delivery
                    SET novapost_profile_id=%s, ttn=%s, status=%s, status_text=%s,
                        recipient_name=%s, recipient_phone=%s, recipient_city=%s, recipient_city_ref=%s,
                        recipient_warehouse=%s, recipient_warehouse_ref=%s, payer_type=%s, payment_method=%s,
                        cod_enabled=%s, cod_amount=%s, declared_value=%s, weight=%s, seats_amount=%s,
                        tracking_data=%s::jsonb, updated_at=%s
                    WHERE id=%s
                    ''',
                    [values['profile_id'], values['ttn'], values['status'], values['status_text'], values['recipient_name'], values['recipient_phone'], values['recipient_city'], values['recipient_city_ref'], values['recipient_warehouse'], values['recipient_warehouse_ref'], values['payer_type'], values['payment_method'], values['cod_enabled'], values['cod_amount'], values['declared_value'], values['weight'], values['seats_amount'], json.dumps(tracking, ensure_ascii=False), now, existing['id']],
                )
            else:
                cursor.execute(
                    '''
                    INSERT INTO core_delivery
                    (company_id, visit_id, novapost_profile_id, service, ttn, status, status_text,
                     recipient_name, recipient_phone, recipient_city, recipient_city_ref,
                     recipient_warehouse, recipient_warehouse_ref, payer_type, payment_method,
                     cod_enabled, cod_amount, declared_value, weight, seats_amount, tracking_data, created_at, updated_at)
                    VALUES (%s,%s,%s,'nova_post',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s)
                    ''',
                    [company.id, visit_id, values['profile_id'], values['ttn'], values['status'], values['status_text'], values['recipient_name'], values['recipient_phone'], values['recipient_city'], values['recipient_city_ref'], values['recipient_warehouse'], values['recipient_warehouse_ref'], values['payer_type'], values['payment_method'], values['cod_enabled'], values['cod_amount'], values['declared_value'], values['weight'], values['seats_amount'], json.dumps(tracking, ensure_ascii=False), now, now],
                )
        return Response({'message': 'Доставку Нової пошти збережено.', 'delivery': fetch_delivery(company.id, visit_id)})


class NovaPostDeliveryStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, visit_id):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=403)
        delivery = fetch_delivery(company.id, visit_id)
        if not delivery or not delivery.get('ttn'):
            return Response({'error': 'Спочатку внесіть ТТН.'}, status=400)
        api_key, profile = active_api_key(company.id, profile_id=delivery.get('novapost_profile_id'))
        if not api_key:
            return Response({'error': 'Для перевірки статусу потрібен активний профіль Нової пошти.'}, status=400)
        try:
            raw = nova_post_request(api_key, 'TrackingDocument', 'getStatusDocuments', {'Documents': [{'DocumentNumber': delivery['ttn']}]})
            if not raw.get('success'):
                errors = raw.get('errors') or raw.get('warnings') or []
                return Response({'error': '; '.join([str(x) for x in errors]) or 'Нова пошта не повернула статус.'}, status=400)
            item = (raw.get('data') or [{}])[0]
            status, status_text = normalize_np_status(item)
            now = timezone.now()
            tracking = delivery.get('tracking_data') or {}
            tracking['last_raw'] = item
            tracking = merge_history(tracking, {'time': now.isoformat(), 'title': 'Статус оновлено', 'description': status_text, 'status': status, 'status_code': item.get('StatusCode')})
            with connection.cursor() as cursor:
                cursor.execute('UPDATE core_delivery SET status=%s, status_text=%s, tracking_data=%s::jsonb, last_checked_at=%s, updated_at=%s WHERE id=%s', [status, status_text, json.dumps(tracking, ensure_ascii=False), now, now, delivery['id']])
            return Response({'message': 'Статус доставки оновлено.', 'delivery': fetch_delivery(company.id, visit_id)})
        except Exception as exc:
            return Response({'error': f'Не вдалося перевірити статус: {exc}'}, status=400)
