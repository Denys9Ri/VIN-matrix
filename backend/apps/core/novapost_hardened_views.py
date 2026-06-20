import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import log_activity
from .novapost_views import (
    build_ttn,
    get_delivery,
    get_profile,
    np_call,
    np_error_text,
    save_delivery,
    update_visit_delivery_data,
)
from .partner_views import get_user_company, repair_legacy_account
from .models import Visit
from .request_context import get_request_id


logger = logging.getLogger('vin_matrix.novapost')


class NovaPostDeliveryCreateHardenedView(APIView):
    """Create one TTN per visit with a short database lock and no long external transaction."""

    permission_classes = [IsAuthenticated]

    def _company(self, request):
        repair_legacy_account(request.user)
        return get_user_company(request.user)

    def _reserve_creation(self, company, visit_id, payload):
        with transaction.atomic():
            visit = Visit.objects.select_for_update().filter(id=visit_id, company=company).first()
            if not visit:
                return None, Response({'error': 'Замовлення не знайдено.', 'code': 'not_found'}, status=404)

            current = get_delivery(company.id, visit_id) or {}
            if current.get('ttn'):
                return None, Response(
                    {
                        'error': 'Для цього замовлення ТТН уже створена.',
                        'code': 'ttn_already_exists',
                        'delivery': current,
                    },
                    status=409,
                )
            if current.get('status') == 'creating':
                return None, Response(
                    {
                        'error': 'ТТН уже створюється. Зачекайте завершення операції.',
                        'code': 'ttn_creation_in_progress',
                    },
                    status=409,
                )

            save_delivery(
                company.id,
                visit_id,
                {
                    **payload,
                    'status': 'creating',
                    'status_text': 'Створюємо ТТН у Новій пошті',
                    'tracking_data': {'events': [{'time': timezone.now().isoformat(), 'status': 'creating', 'text': 'Розпочато створення ТТН'}]},
                },
            )
        return visit, None

    def _mark_failed(self, company, visit_id, payload, message):
        with transaction.atomic():
            Visit.objects.select_for_update().filter(id=visit_id, company=company).first()
            save_delivery(
                company.id,
                visit_id,
                {
                    **payload,
                    'status': 'draft',
                    'status_text': message,
                },
            )

    def post(self, request, visit_id):
        company = self._company(request)
        if not company:
            return Response({'error': 'Компанію не знайдено.', 'code': 'company_not_found'}, status=403)

        profile = get_profile(company.id, request.data.get('novapost_profile_id'), True) or get_profile(company.id, None, True)
        if not profile:
            return Response({'error': 'Додайте активний профіль Нової пошти.', 'code': 'novapost_profile_required'}, status=400)

        props, error = build_ttn(profile.get('api_key'), profile, request.data)
        if error:
            return Response({'error': error, 'code': 'ttn_validation_error'}, status=400)

        visit, reservation_error = self._reserve_creation(company, visit_id, request.data)
        if reservation_error:
            return reservation_error

        request_id = getattr(request, 'request_id', get_request_id())
        try:
            raw = np_call(profile.get('api_key'), 'InternetDocument', 'save', props, timeout=25)
        except Exception:
            logger.exception(
                'novapost_ttn_request_failed',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.path,
                    'status_code': 503,
                    'user_id': request.user.id,
                },
            )
            self._mark_failed(company, visit_id, request.data, 'Нова пошта тимчасово недоступна. Спробуйте ще раз.')
            return Response({'error': 'Нова пошта тимчасово недоступна. Спробуйте ще раз.', 'code': 'novapost_unavailable'}, status=503)

        if not raw.get('success'):
            message = np_error_text(raw) or 'Нова пошта не створила ТТН.'
            logger.warning(
                'novapost_ttn_rejected',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.path,
                    'status_code': 502,
                    'user_id': request.user.id,
                },
            )
            self._mark_failed(company, visit_id, request.data, message)
            return Response({'error': message, 'code': 'novapost_rejected'}, status=502)

        item = (raw.get('data') or [{}])[0] or {}
        ttn = item.get('IntDocNumber') or item.get('Number') or ''
        if not ttn:
            self._mark_failed(company, visit_id, request.data, 'Нова пошта не повернула номер ТТН.')
            return Response({'error': 'Нова пошта не повернула номер ТТН.', 'code': 'novapost_missing_ttn'}, status=502)

        with transaction.atomic():
            locked_visit = Visit.objects.select_for_update().filter(id=visit_id, company=company).first()
            current = get_delivery(company.id, visit_id) or {}
            if current.get('ttn'):
                return Response({'message': 'ТТН уже створена.', 'delivery': current, 'duplicate_prevented': True}, status=200)

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
            visit = update_visit_delivery_data(company, visit_id, saved) or locked_visit

            transaction.on_commit(
                lambda: log_activity(
                    company=company,
                    user=request.user,
                    visit=visit,
                    mode='store',
                    action_type='novapost_ttn_created',
                    title='Створено ТТН Нової пошти',
                    description=f'Створено ТТН {ttn}',
                    old_value=None,
                    new_value=ttn,
                    metadata={'ttn': ttn, 'delivery_id': saved.get('id'), 'service': 'nova_post'},
                )
            )

        return Response({'message': 'ТТН створено.', 'delivery': saved}, status=201)
