from datetime import datetime, timedelta, time as dt_time

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import serialize_activity_row
from .safe_crm_views import safe_ensure_company


def _limit(value, default=100, max_value=500):
    try:
        return min(max(int(value or default), 1), max_value)
    except Exception:
        return default


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except Exception:
        return None


class ActivityLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'results': [], 'users': []})

        where = ['a.company_id = %s']
        params = [company.id]

        visit_id = request.query_params.get('visit') or request.query_params.get('visit_id')
        phone = request.query_params.get('client_phone') or request.query_params.get('phone')
        mode = request.query_params.get('mode')
        action_type = request.query_params.get('type') or request.query_params.get('action_type')
        user_id = request.query_params.get('user') or request.query_params.get('user_id')
        q = (request.query_params.get('q') or request.query_params.get('search') or '').strip()
        category = (request.query_params.get('category') or '').strip()
        date_from = _parse_date(request.query_params.get('date_from'))
        date_to = _parse_date(request.query_params.get('date_to'))
        limit = _limit(request.query_params.get('limit'))

        if visit_id:
            where.append('a.visit_id = %s')
            params.append(visit_id)
        if phone:
            digits = ''.join(ch for ch in str(phone) if ch.isdigit())
            where.append("regexp_replace(COALESCE(a.metadata->>'phone',''), '[^0-9]', '', 'g') = %s")
            params.append(digits)
        if mode:
            where.append('a.mode = %s')
            params.append(mode)
        if action_type:
            where.append('a.action_type = %s')
            params.append(action_type)
        if user_id:
            where.append('a.user_id = %s')
            params.append(user_id)
        if date_from:
            where.append('a.created_at >= %s')
            params.append(timezone.make_aware(datetime.combine(date_from, dt_time.min)))
        if date_to:
            where.append('a.created_at < %s')
            params.append(timezone.make_aware(datetime.combine(date_to + timedelta(days=1), dt_time.min)))
        if q:
            like = f'%{q}%'
            where.append("(a.title ILIKE %s OR a.description ILIKE %s OR a.metadata->>'client' ILIKE %s OR a.metadata->>'phone' ILIKE %s OR a.metadata->>'article' ILIKE %s OR a.metadata->>'brand' ILIKE %s OR a.metadata->>'part_name' ILIKE %s)")
            params.extend([like, like, like, like, like, like, like])
        if category == 'finance':
            where.append("a.action_type LIKE 'payment_%'")
        elif category == 'stock':
            where.append("a.action_type LIKE 'stock_%'")
        elif category == 'cancel':
            where.append("(a.action_type LIKE '%cancel%' OR a.action_type LIKE '%deleted%')")
        elif category == 'return':
            where.append("(a.action_type LIKE '%return%' OR a.action_type = 'stock_defective')")

        params_with_limit = params + [limit]
        sql = f"""
            SELECT a.id, a.company_id, a.user_id, a.visit_id, a.order_part_id, a.inventory_item_id,
                   a.mode, a.action_type, a.title, a.description, a.old_value, a.new_value,
                   a.metadata, a.created_at, u.first_name, u.username
            FROM core_activitylog a
            LEFT JOIN auth_user u ON u.id = a.user_id
            WHERE {' AND '.join(where)}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT %s
        """
        with connection.cursor() as cursor:
            cursor.execute(sql, params_with_limit)
            rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT DISTINCT u.id, COALESCE(NULLIF(u.first_name, ''), u.username, 'Користувач')
                FROM core_activitylog a
                JOIN auth_user u ON u.id = a.user_id
                WHERE a.company_id = %s
                ORDER BY 2
                """,
                [company.id],
            )
            users = [{'id': r[0], 'name': r[1]} for r in cursor.fetchall()]

        return Response({'results': [serialize_activity_row(row) for row in rows], 'users': users})
