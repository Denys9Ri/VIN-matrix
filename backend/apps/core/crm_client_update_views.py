from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit, OrderPart
from .safe_crm_views import safe_ensure_company
from .crm_client_views import build_clients, normalize_phone


GENERIC_CLIENTS = {'', 'Новий покупець', 'Роздрібний покупець', 'Без імені'}
ACTIVE_STORE_STATUSES = ['SELECTION', 'PENDING', 'DRAFT', 'ORDERED', 'IN_PROGRESS', 'DONE', 'SHIPPED']


def is_generic_plate(value):
    value = str(value or '').upper().strip()
    return (not value) or value.startswith('ORDER-') or value.startswith('SALE-')


def safe_decimal(value, default=0):
    try:
        return str(value if value not in [None, ''] else default).replace(',', '.')
    except Exception:
        return default


def find_client_visits(company, wanted):
    visits = Visit.objects.filter(company=company)
    if str(wanted).startswith('name:'):
        current_name = wanted.replace('name:', '', 1)
        return visits.filter(client=current_name)
    tail = wanted[-10:] if len(str(wanted)) >= 10 else wanted
    return visits.filter(phone__icontains=tail)


class StoreClientUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії'}, status=400)

        key = request.data.get('key') or request.query_params.get('key') or ''
        old_phone = request.data.get('old_phone') or request.data.get('phone') or ''
        wanted = key or normalize_phone(old_phone)
        client_name = (request.data.get('client') or '').strip()
        phone = (request.data.get('phone') or '').strip()
        plate = (request.data.get('plate') or '').strip().upper()
        vin_code = (request.data.get('vin_code') or '').strip().upper()
        overwrite_car = request.data.get('overwrite_car') is True

        visits = find_client_visits(company, wanted)

        if not visits.exists():
            return Response({'error': 'Клієнта не знайдено'}, status=404)

        updated = 0
        for visit in visits:
            changed = False
            if client_name and (visit.client in GENERIC_CLIENTS or visit.client != client_name):
                visit.client = client_name
                changed = True
            if phone and visit.phone != phone:
                visit.phone = phone
                changed = True
            if plate and (overwrite_car or is_generic_plate(visit.plate)):
                visit.plate = plate
                changed = True
            if vin_code and (overwrite_car or not visit.vin_code):
                visit.vin_code = vin_code
                changed = True
            if changed:
                visit.save(update_fields=['client', 'phone', 'plate', 'vin_code', 'updated_at'])
                updated += 1

        clients = build_clients(company)
        new_key = normalize_phone(phone) if phone else wanted
        for client in clients:
            if client['key'] == new_key or normalize_phone(client.get('phone')) == new_key:
                return Response({'updated': updated, 'client': client})

        return Response({'updated': updated})


class StoreClientRepeatSaleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії'}, status=400)

        key = request.data.get('key') or ''
        phone = (request.data.get('phone') or '').strip()
        wanted = key or normalize_phone(phone)
        client_name = (request.data.get('client') or '').strip() or 'Новий покупець'
        plate = (request.data.get('plate') or '').strip().upper()
        vin_code = (request.data.get('vin_code') or '').strip().upper() or None
        part = request.data.get('part') or {}

        article = (part.get('article') or '').strip()
        brand = (part.get('brand') or '').strip() or 'Без бренду'
        name = (part.get('name') or '').strip() or article or 'Товар'
        supplier = (part.get('supplier') or part.get('source_label') or '').strip() or 'Повторний продаж'
        buy_price = safe_decimal(part.get('buy_price'), 0)
        sell_price = safe_decimal(part.get('sell_price') or part.get('revenue'), 0)
        quantity = safe_decimal(part.get('quantity'), 1)

        if not article and not name:
            return Response({'error': 'Немає товару для повторення'}, status=400)

        client_visits = find_client_visits(company, wanted) if wanted else Visit.objects.none()
        last_visit = client_visits.order_by('-created_at').first()
        if last_visit:
            client_name = client_name or last_visit.client
            phone = phone or last_visit.phone
            plate = plate or last_visit.plate
            vin_code = vin_code or last_visit.vin_code

        today = timezone.localdate()
        active_visit = client_visits.filter(
            scheduled_datetime__date=today,
            status__in=ACTIVE_STORE_STATUSES,
        ).order_by('-created_at').first()

        created = False
        if active_visit:
            visit = active_visit
        else:
            visit = Visit.objects.create(
                company=company,
                client=client_name,
                phone=phone or '0000000000',
                plate=plate or f'ORDER-{int(timezone.now().timestamp())}',
                vin_code=vin_code,
                status='ORDERED',
                delivery_type='pickup',
                delivery_data='{"source":"Повторний продаж","mode":"store"}',
                payment_status='unpaid',
                scheduled_datetime=timezone.now(),
                comment=f'Повторний продаж з історії клієнта: {article or name}',
            )
            created = True

        order_part = OrderPart.objects.create(
            visit=visit,
            brand=brand,
            article=article or 'manual',
            name=name,
            buy_price=buy_price,
            sell_price=sell_price,
            quantity=quantity or 1,
            supplier=supplier,
            status='WAITING',
        )

        if visit.status in ['SELECTION', 'PENDING', 'DRAFT']:
            visit.status = 'ORDERED'
            visit.save(update_fields=['status', 'updated_at'])

        return Response({
            'created_order': created,
            'visit_id': visit.id,
            'order_id': visit.id,
            'part_id': order_part.id,
            'message': 'Створено нове замовлення' if created else f'Додано в активне замовлення №{visit.id}',
        })
