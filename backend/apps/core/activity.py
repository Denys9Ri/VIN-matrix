import json
from decimal import Decimal

from django.db import connection
from django.utils import timezone


def _safe_text(value, max_len=None):
    if value is None:
        return ''
    text = str(value)
    return text[:max_len] if max_len else text


def _json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


def actor_name(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return 'Система'
    return user.get_full_name() or getattr(user, 'first_name', '') or getattr(user, 'username', '') or 'Користувач'


def mode_for_company(company):
    return 'store' if getattr(company, 'business_type', '') == 'store' else 'sto'


def mode_for_visit(visit):
    company = getattr(visit, 'company', None)
    return mode_for_company(company) if company else 'system'


def log_activity(company=None, user=None, visit=None, order_part=None, inventory_item=None, mode=None, action_type='system', title='', description='', old_value=None, new_value=None, metadata=None):
    """Safe low-risk activity writer. Never breaks business flow if logging fails."""
    try:
        company = company or getattr(visit, 'company', None) or getattr(inventory_item, 'company', None)
        if not company:
            return None
        if not mode:
            mode = mode_for_company(company)
        data = dict(metadata or {})
        if visit:
            data.setdefault('visit_id', getattr(visit, 'id', None))
            data.setdefault('client', getattr(visit, 'client', '') or '')
            data.setdefault('phone', getattr(visit, 'phone', '') or '')
            data.setdefault('plate', getattr(visit, 'plate', '') or '')
        if order_part:
            data.setdefault('part_id', getattr(order_part, 'id', None))
            data.setdefault('brand', getattr(order_part, 'brand', '') or '')
            data.setdefault('article', getattr(order_part, 'article', '') or '')
            data.setdefault('part_name', getattr(order_part, 'name', '') or '')
            data.setdefault('quantity', float(getattr(order_part, 'quantity', 0) or 0))
        if inventory_item:
            data.setdefault('inventory_item_id', getattr(inventory_item, 'id', None))
            data.setdefault('inventory_article', getattr(inventory_item, 'article', '') or '')
            data.setdefault('inventory_brand', getattr(inventory_item, 'brand', '') or '')
        data.setdefault('actor', actor_name(user))
        payload = json.dumps(data, ensure_ascii=False, default=_json_default)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO core_activitylog
                (company_id, user_id, visit_id, order_part_id, inventory_item_id, mode, action_type, title, description, old_value, new_value, metadata, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s)
                RETURNING id
                """,
                [
                    company.id,
                    user.id if user and getattr(user, 'is_authenticated', False) else None,
                    getattr(visit, 'id', None),
                    getattr(order_part, 'id', None),
                    getattr(inventory_item, 'id', None),
                    _safe_text(mode or 'system', 20),
                    _safe_text(action_type or 'system', 80),
                    _safe_text(title or 'Дія', 255),
                    description or '',
                    None if old_value is None else str(old_value),
                    None if new_value is None else str(new_value),
                    payload,
                    timezone.now(),
                ],
            )
            return cursor.fetchone()[0]
    except Exception as exc:
        print(f'ACTIVITY LOG failed: {exc}')
        return None


def serialize_activity_row(row):
    metadata = row[12] or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    actor = row[14] or row[15] or metadata.get('actor') or 'Система'
    return {
        'id': row[0],
        'company_id': row[1],
        'user_id': row[2],
        'visit_id': row[3],
        'order_part_id': row[4],
        'inventory_item_id': row[5],
        'mode': row[6],
        'action_type': row[7],
        'title': row[8],
        'description': row[9] or '',
        'old_value': row[10],
        'new_value': row[11],
        'metadata': metadata,
        'created_at': row[13],
        'actor': actor,
    }


def activity_query(company, visit_id=None, phone=None, mode=None, action_type=None, limit=80):
    where = ['a.company_id = %s']
    params = [company.id]
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
    params.append(int(limit or 80))
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
        cursor.execute(sql, params)
        rows = cursor.fetchall()
    return [serialize_activity_row(row) for row in rows]
