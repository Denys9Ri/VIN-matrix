from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit
from .safe_crm_views import safe_ensure_company
from .crm_client_views import build_clients, normalize_phone


GENERIC_CLIENTS = {'', 'Новий покупець', 'Роздрібний покупець', 'Без імені'}


def is_generic_plate(value):
    value = str(value or '').upper().strip()
    return (not value) or value.startswith('ORDER-') or value.startswith('SALE-')


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

        visits = Visit.objects.filter(company=company)
        if str(wanted).startswith('name:'):
            current_name = wanted.replace('name:', '', 1)
            visits = visits.filter(client=current_name)
        else:
            visits = visits.filter(phone__icontains=wanted[-10:] if len(wanted) >= 10 else wanted)

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
