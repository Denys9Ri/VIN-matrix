import logging
import re

from django.core.cache import cache
from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import is_platform_admin

logger = logging.getLogger(__name__)

PHONE_DIGITS = re.compile(r"\D+")
ALLOWED_BUSINESS_TYPES = {'СТО', 'Магазин запчастин', 'СТО + магазин', 'Шиномонтаж'}
ALLOWED_TEAM_SIZES = {'1–3', '4–10', '11+'}


def _create_lead_table():
    """Keep leads durable even on installations that have not run a dedicated migration yet."""
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_landing_lead (
                    id BIGSERIAL PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    phone VARCHAR(40) NOT NULL,
                    business_type VARCHAR(80) NOT NULL,
                    team_size VARCHAR(20) NOT NULL,
                    source VARCHAR(80) NOT NULL DEFAULT 'landing',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                '''
            )
        else:
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_landing_lead (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(120) NOT NULL,
                    phone VARCHAR(40) NOT NULL,
                    business_type VARCHAR(80) NOT NULL,
                    team_size VARCHAR(20) NOT NULL,
                    source VARCHAR(80) NOT NULL DEFAULT 'landing',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                '''
            )


def _client_ip(request):
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    return forwarded or request.META.get('REMOTE_ADDR') or 'unknown'


class LandingLeadView(APIView):
    """Accept public demo requests and expose the lead inbox to the platform admin."""

    permission_classes = [AllowAny]

    def get(self, request):
        if not is_platform_admin(request.user):
            return Response({'error': 'Доступ лише для адміністратора.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            _create_lead_table()
            with connection.cursor() as cursor:
                cursor.execute(
                    '''
                    SELECT id, name, phone, business_type, team_size, source, created_at
                    FROM core_landing_lead
                    ORDER BY created_at DESC, id DESC
                    LIMIT 200
                    '''
                )
                rows = cursor.fetchall()
        except Exception:
            logger.exception('Landing leads could not be loaded')
            return Response({'error': 'Не вдалося завантажити заявки.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'results': [
                {
                    'id': row[0],
                    'name': row[1],
                    'phone': row[2],
                    'business_type': row[3],
                    'team_size': row[4],
                    'source': row[5],
                    'created_at': row[6],
                }
                for row in rows
            ],
            'count': len(rows),
        })

    def post(self, request):
        ip = _client_ip(request)
        throttle_key = f'landing-lead:{ip}'
        if not cache.add(throttle_key, '1', timeout=60):
            return Response(
                {'error': 'Будь ласка, зачекайте хвилину перед повторною заявкою.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        name = str(request.data.get('name') or '').strip()[:120]
        phone = str(request.data.get('phone') or '').strip()[:40]
        business_type = str(request.data.get('type') or '').strip()
        team_size = str(request.data.get('team') or '').strip()
        phone_digits = PHONE_DIGITS.sub('', phone)

        if len(name) < 2:
            return Response({'error': 'Вкажіть, будь ласка, ім’я.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(phone_digits) < 8:
            return Response({'error': 'Вкажіть коректний номер телефону.'}, status=status.HTTP_400_BAD_REQUEST)
        if business_type not in ALLOWED_BUSINESS_TYPES:
            return Response({'error': 'Оберіть тип бізнесу зі списку.'}, status=status.HTTP_400_BAD_REQUEST)
        if team_size not in ALLOWED_TEAM_SIZES:
            return Response({'error': 'Оберіть розмір команди зі списку.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            _create_lead_table()
            with connection.cursor() as cursor:
                cursor.execute(
                    '''
                    INSERT INTO core_landing_lead (name, phone, business_type, team_size, source)
                    VALUES (%s, %s, %s, %s, %s)
                    ''',
                    [name, phone, business_type, team_size, 'landing'],
                )
        except Exception:
            logger.exception('Landing lead could not be stored')
            return Response(
                {'error': 'Не вдалося зберегти заявку. Спробуйте ще раз трохи пізніше.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {'ok': True, 'message': 'Заявку прийнято. Ми підготуємо демо під ваш тип бізнесу.'},
            status=status.HTTP_201_CREATED,
        )
