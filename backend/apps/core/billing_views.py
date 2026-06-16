from datetime import datetime
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .billing_client_link_views import get_client_link_settings
from .models import PlatformClient
from .partner_views import PLATFORM_ADMIN_USERNAMES, get_platform_client, is_platform_admin, is_partner_user, repair_legacy_account
from .subscriptions import CURRENCY, MONTHLY_PRICE, PLAN_CODE, PLAN_NAME, get_billing_status, renew_client_30_days


PAYMENT_METHODS = {
    'monobank_jar': 'Monobank банка',
    'cash': 'Готівка',
    'manual_bank': 'Ручний переказ',
    'bonus': 'Бонус / ручний доступ',
}

PARTNER_CLIENT_PRICE = Decimal('2000')
PARTNER_SHARE = Decimal('1500')
ADMIN_PARTNER_SHARE = Decimal('500')


def money_value(value):
    try:
        return Decimal(str(value or 0).replace(',', '.'))
    except Exception:
        return MONTHLY_PRICE


def payment_row(row):
    method = row[5] or 'monobank_jar'
    return {
        'id': row[0],
        'client_id': row[1],
        'client_code': row[2],
        'client_name': row[3] or row[4] or 'Клієнт',
        'client_username': row[4],
        'amount': float(row[6] or 0),
        'currency': row[7] or CURRENCY,
        'method': method,
        'method_label': PAYMENT_METHODS.get(method, method),
        'status': row[8],
        'period_start': row[9],
        'period_end': row[10],
        'comment': row[11] or '',
        'created_at': row[12],
        'confirmed_at': row[13],
        'confirmed_by': row[14],
        'rejected_reason': row[15] or '',
    }


def create_payment(platform_client, amount, method, status='pending', comment='', created_by=None):
    now = timezone.now()
    amount = money_value(amount)
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            INSERT INTO core_subscriptionpayment
            (platform_client_id, amount, currency, method, status, period_start, period_end, comment, created_by_id, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            ''',
            [
                platform_client.id,
                amount,
                CURRENCY,
                method or 'monobank_jar',
                status,
                None,
                None,
                comment or '',
                created_by.id if created_by and created_by.is_authenticated else None,
                now,
            ],
        )
        return cursor.fetchone()[0]


def find_pending_payment(platform_client):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT id FROM core_subscriptionpayment
            WHERE platform_client_id=%s AND status='pending'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            ''',
            [platform_client.id],
        )
        row = cursor.fetchone()
    return row[0] if row else None


def cover_other_pending_payments(platform_client, confirmed_payment_id, admin_user):
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            UPDATE core_subscriptionpayment
            SET status='covered', confirmed_by_id=%s, confirmed_at=%s, rejected_reason=NULL,
                comment=CASE
                    WHEN comment IS NULL OR comment = '' THEN 'Закрито автоматично: доступ уже продовжено'
                    ELSE comment || ' · Закрито автоматично: доступ уже продовжено'
                END
            WHERE platform_client_id=%s AND status='pending' AND id<>%s
            ''',
            [admin_user.id if admin_user and admin_user.is_authenticated else None, timezone.now(), platform_client.id, confirmed_payment_id],
        )
        return cursor.rowcount


def list_payments(where_sql='', params=None, limit=80):
    params = params or []
    sql = f'''
        SELECT p.id, pc.id, pc.client_code, u.first_name, u.username, p.method, p.amount, p.currency,
               p.status, p.period_start, p.period_end, p.comment, p.created_at, p.confirmed_at,
               cu.username as confirmed_by, p.rejected_reason
        FROM core_subscriptionpayment p
        JOIN core_platformclient pc ON pc.id = p.platform_client_id
        JOIN auth_user u ON u.id = pc.user_id
        LEFT JOIN auth_user cu ON cu.id = p.confirmed_by_id
        {where_sql}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT %s
    '''
    with connection.cursor() as cursor:
        cursor.execute(sql, params + [limit])
        return [payment_row(row) for row in cursor.fetchall()]


def client_admin_row(client):
    billing = get_billing_status(client)
    owner = getattr(client, 'assigned_owner', None)
    user = getattr(client, 'user', None)
    return {
        'id': client.id,
        'user_id': user.id if user else None,
        'client_code': client.client_code,
        'client_code_display': f'C{client.client_code}' if client.client_code else '—',
        'client_name': (user.first_name or user.username) if user else 'Клієнт',
        'username': user.username if user else '',
        'email': user.email if user else '',
        'phone': client.phone or '',
        'assigned_owner_id': owner.id if owner else None,
        'assigned_to': (owner.first_name or owner.username) if owner else '—',
        'payment_status': client.payment_status,
        'billing_status': billing.get('billing_status'),
        'billing_label': billing.get('label'),
        'billing_message': billing.get('message'),
        'is_access_enabled': client.is_access_enabled,
        'access_allowed': billing.get('access_allowed'),
        'subscription_price': float(client.subscription_price or MONTHLY_PRICE),
        'currency': CURRENCY,
        'trial_until': client.trial_until,
        'subscription_until': client.subscription_until,
        'grace_until': client.grace_until,
        'subscription_end': billing.get('subscription_end'),
        'subscription_end_display': billing.get('subscription_end_display'),
        'days_left': billing.get('days_left'),
        'grace_days_left': billing.get('grace_days_left'),
        'overdue_days': billing.get('overdue_days'),
        'blocked_at': client.blocked_at,
        'blocked_reason': client.blocked_reason,
        'last_payment_at': client.last_payment_at,
        'last_payment_method': client.last_payment_method,
        'created_at': client.created_at,
    }


def ensure_partner_payout_table():
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_partnerpayout (
                    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    partner_id integer NOT NULL,
                    period_key varchar(7) NOT NULL,
                    amount numeric(10,2) NOT NULL DEFAULT 0,
                    note text NULL,
                    paid_at timestamp with time zone NOT NULL DEFAULT NOW(),
                    created_by_id integer NULL
                )
                '''
            )
        else:
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_partnerpayout (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    partner_id integer NOT NULL,
                    period_key varchar(7) NOT NULL,
                    amount numeric(10,2) NOT NULL DEFAULT 0,
                    note text NULL,
                    paid_at datetime NOT NULL,
                    created_by_id integer NULL
                )
                '''
            )


def parse_period(value=None):
    raw = (value or timezone.localdate().strftime('%Y-%m')).strip()[:7]
    try:
        start = datetime.strptime(raw, '%Y-%m').date().replace(day=1)
    except Exception:
        raw = timezone.localdate().strftime('%Y-%m')
        start = timezone.localdate().replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return raw, start, end


def partner_payout_rows(request, period_key, start, end):
    ensure_partner_payout_table()
    params = [start, end]
    owner_filter = ''
    if is_partner_user(request.user) and not is_platform_admin(request.user):
        owner_filter = 'AND owner.id = %s'
        params.append(request.user.id)
    with connection.cursor() as cursor:
        cursor.execute(
            f'''
            SELECT p.id, p.amount, p.confirmed_at, pc.client_code,
                   client_user.first_name, client_user.username,
                   owner.id, owner.first_name, owner.username, owner.is_staff, owner.is_superuser,
                   emp.role
            FROM core_subscriptionpayment p
            JOIN core_platformclient pc ON pc.id=p.platform_client_id
            JOIN auth_user client_user ON client_user.id=pc.user_id
            JOIN auth_user owner ON owner.id=pc.assigned_owner_id
            LEFT JOIN core_employee emp ON emp.user_id=owner.id
            WHERE p.status='confirmed' AND p.confirmed_at >= %s AND p.confirmed_at < %s {owner_filter}
            ORDER BY p.confirmed_at DESC, p.id DESC
            ''',
            params,
        )
        payment_rows = cursor.fetchall()

    partners = {}
    totals = {'payments_count': 0, 'revenue': Decimal('0'), 'partner_earned': Decimal('0'), 'admin_earned': Decimal('0'), 'paid_to_partners': Decimal('0'), 'partner_due': Decimal('0')}
    for row in payment_rows:
        owner_id = row[6]
        owner_name = row[7] or row[8] or 'Партнер'
        owner_username = row[8] or ''
        role = row[11] or ''
        is_owner_admin = owner_username in PLATFORM_ADMIN_USERNAMES or bool(row[9]) or bool(row[10])
        is_partner_owner = role == 'partner' and not is_owner_admin
        amount = PARTNER_CLIENT_PRICE
        partner_share = PARTNER_SHARE if is_partner_owner else Decimal('0')
        admin_share = ADMIN_PARTNER_SHARE if is_partner_owner else amount
        key = owner_id if is_partner_owner else 'admin'
        if key not in partners:
            partners[key] = {
                'partner_id': owner_id if is_partner_owner else None,
                'partner_name': owner_name if is_partner_owner else 'Адмін / прямі клієнти',
                'partner_username': owner_username if is_partner_owner else '',
                'payments_count': 0,
                'revenue': Decimal('0'),
                'partner_earned': Decimal('0'),
                'admin_earned': Decimal('0'),
                'paid': Decimal('0'),
                'due': Decimal('0'),
                'clients': [],
            }
        bucket = partners[key]
        bucket['payments_count'] += 1
        bucket['revenue'] += amount
        bucket['partner_earned'] += partner_share
        bucket['admin_earned'] += admin_share
        bucket['clients'].append({
            'payment_id': row[0],
            'client_code': f'C{row[3]}',
            'client_name': row[4] or row[5] or 'Клієнт',
            'confirmed_at': row[2],
            'amount': float(amount),
            'partner_share': float(partner_share),
            'admin_share': float(admin_share),
        })
        totals['payments_count'] += 1
        totals['revenue'] += amount
        totals['partner_earned'] += partner_share
        totals['admin_earned'] += admin_share

    if partners:
        with connection.cursor() as cursor:
            cursor.execute('SELECT partner_id, COALESCE(SUM(amount),0) FROM core_partnerpayout WHERE period_key=%s GROUP BY partner_id', [period_key])
            paid_map = {row[0]: Decimal(str(row[1] or 0)) for row in cursor.fetchall()}
        for bucket in partners.values():
            partner_id = bucket.get('partner_id')
            paid = paid_map.get(partner_id, Decimal('0')) if partner_id else Decimal('0')
            bucket['paid'] = paid
            bucket['due'] = max(bucket['partner_earned'] - paid, Decimal('0'))
            totals['paid_to_partners'] += paid
            totals['partner_due'] += bucket['due']

    def clean(bucket):
        return {**bucket, 'revenue': float(bucket['revenue']), 'partner_earned': float(bucket['partner_earned']), 'admin_earned': float(bucket['admin_earned']), 'paid': float(bucket['paid']), 'due': float(bucket['due'])}

    return {
        'period': period_key,
        'summary': {key: float(value) if isinstance(value, Decimal) else value for key, value in totals.items()},
        'results': [clean(bucket) for bucket in sorted(partners.values(), key=lambda item: item['due'], reverse=True)],
    }


class BillingMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        client = get_platform_client(request.user)
        billing = get_billing_status(client) if client else {'access_allowed': True, 'status': 'none'}
        payments = list_payments('WHERE pc.id = %s', [client.id], limit=30) if client else []
        return Response({
            'billing': billing,
            'plan': {
                'code': PLAN_CODE,
                'name': PLAN_NAME,
                'price': float(MONTHLY_PRICE),
                'currency': CURRENCY,
                'period': 'month',
                'features': ['Усі функції VIN-matrix', 'Магазин', 'СТО', 'Склад', 'CRM', 'Документи', 'Аналітика'],
            },
            'payment_methods': PAYMENT_METHODS,
            'payment_settings': get_client_link_settings(),
            'payments': payments,
            'pending_payments': [payment for payment in payments if payment.get('status') == 'pending'],
        })


class BillingPaymentRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        client = get_platform_client(request.user)
        if not client:
            return Response({'results': [], 'count': 0})
        rows = list_payments('WHERE pc.id = %s', [client.id], limit=int(request.query_params.get('limit') or 50))
        return Response({'results': rows, 'count': len(rows), 'billing': get_billing_status(client)})

    def post(self, request):
        repair_legacy_account(request.user)
        client = get_platform_client(request.user)
        if not client:
            return Response({'error': 'Платіжний профіль не знайдено.'}, status=404)
        method = request.data.get('method') or 'monobank_jar'
        amount = money_value(request.data.get('amount') or MONTHLY_PRICE)
        comment = request.data.get('comment') or f'Заявка на оплату тарифу {PLAN_NAME}'
        existing_id = find_pending_payment(client)
        settings = get_client_link_settings()
        if existing_id:
            return Response({
                'id': existing_id,
                'message': 'Активна заявка вже є. Адміністратор бачить її в кабінеті й може підтвердити оплату.',
                'already_pending': True,
                'amount': float(amount),
                'currency': CURRENCY,
                'method': method,
                'method_label': PAYMENT_METHODS.get(method, method),
                'payment_url': settings.get('public_url') or '',
                'payment_note': settings.get('public_note') or '',
                'billing': get_billing_status(client),
            }, status=200)
        payment_id = create_payment(client, amount, method, status='pending', comment=comment, created_by=request.user)
        return Response({
            'id': payment_id,
            'message': 'Заявку на оплату створено. Після перевірки адміністратор підтвердить доступ.',
            'amount': float(amount),
            'currency': CURRENCY,
            'method': method,
            'method_label': PAYMENT_METHODS.get(method, method),
            'payment_url': settings.get('public_url') or '',
            'payment_note': settings.get('public_note') or '',
            'billing': get_billing_status(client),
        }, status=201)


class BillingAdminClientsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        if not (is_platform_admin(request.user) or is_partner_user(request.user)):
            return Response({'error': 'Немає прав переглядати SaaS-клієнтів.'}, status=403)
        qs = PlatformClient.objects.select_related('user', 'assigned_owner').order_by('-created_at')
        if is_partner_user(request.user) and not is_platform_admin(request.user):
            qs = qs.filter(assigned_owner=request.user)
        q = request.query_params.get('search', '').strip()
        if q:
            qs = qs.filter(Q(client_code__icontains=q) | Q(phone__icontains=q) | Q(user__username__icontains=q) | Q(user__first_name__icontains=q) | Q(user__email__icontains=q) | Q(assigned_owner__username__icontains=q) | Q(assigned_owner__first_name__icontains=q))
        status_filter = request.query_params.get('billing_status') or request.query_params.get('status')
        rows = []
        summary = {'total': 0, 'trial': 0, 'active': 0, 'grace': 0, 'blocked': 0, 'manual_free': 0, 'paid': 0}
        for client in qs[:300]:
            row = client_admin_row(client)
            status_value = row.get('billing_status') or ''
            if status_filter and status_filter != status_value:
                continue
            summary['total'] += 1
            if status_value in summary:
                summary[status_value] += 1
            if client.payment_status == 'active':
                summary['paid'] += 1
            rows.append(row)
        return Response({'results': rows, 'count': len(rows), 'summary': summary})


class BillingAdminPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        if not (is_platform_admin(request.user) or is_partner_user(request.user)):
            return Response({'error': 'Немає прав переглядати billing.'}, status=403)
        status_filter = request.query_params.get('status')
        params = []
        where = []
        if status_filter:
            where.append('p.status = %s')
            params.append(status_filter)
        if is_partner_user(request.user) and not is_platform_admin(request.user):
            where.append('pc.assigned_owner_id = %s')
            params.append(request.user.id)
        where_sql = 'WHERE ' + ' AND '.join(where) if where else ''
        rows = list_payments(where_sql, params, limit=int(request.query_params.get('limit') or 100))
        return Response({'results': rows, 'count': len(rows), 'payment_methods': PAYMENT_METHODS})


class BillingAdminPartnerPayoutsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        repair_legacy_account(request.user)
        if not (is_platform_admin(request.user) or is_partner_user(request.user)):
            return Response({'error': 'Немає прав переглядати партнерські виплати.'}, status=403)
        period_key, start, end = parse_period(request.query_params.get('month') or request.query_params.get('period'))
        return Response(partner_payout_rows(request, period_key, start, end))

    def post(self, request):
        repair_legacy_account(request.user)
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки адмін може фіксувати виплати партнерам.'}, status=403)
        partner_id = request.data.get('partner_id')
        if not partner_id:
            return Response({'error': 'Передайте partner_id.'}, status=400)
        try:
            partner = User.objects.get(id=int(partner_id))
        except Exception:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        period_key, start, end = parse_period(request.data.get('period') or request.data.get('month'))
        amount = money_value(request.data.get('amount'))
        if amount <= 0:
            return Response({'error': 'Сума виплати має бути більше 0.'}, status=400)
        note = request.data.get('note') or 'Виплата партнеру'
        ensure_partner_payout_table()
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                INSERT INTO core_partnerpayout (partner_id, period_key, amount, note, paid_at, created_by_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                ''',
                [partner.id, period_key, amount, note, timezone.now(), request.user.id],
            )
        return Response({'message': 'Виплату партнеру зафіксовано.', **partner_payout_rows(request, period_key, start, end)})


class BillingAdminConfirmPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        repair_legacy_account(request.user)
        if not (is_platform_admin(request.user) or is_partner_user(request.user)):
            return Response({'error': 'Немає прав підтверджувати оплату.'}, status=403)
        payment_id = request.data.get('payment_id') or request.data.get('id')
        if not payment_id:
            return Response({'error': 'Передайте payment_id.'}, status=400)

        with connection.cursor() as cursor:
            cursor.execute('SELECT platform_client_id, status, method FROM core_subscriptionpayment WHERE id=%s FOR UPDATE', [payment_id])
            row = cursor.fetchone()
        if not row:
            return Response({'error': 'Платіж не знайдено.'}, status=404)
        client = PlatformClient.objects.select_for_update().filter(id=row[0]).first()
        if not client:
            return Response({'error': 'Клієнт не знайдений.'}, status=404)
        if is_partner_user(request.user) and not is_platform_admin(request.user) and client.assigned_owner_id != request.user.id:
            return Response({'error': 'Немає доступу до цього клієнта.'}, status=403)

        renew_client_30_days(client, method=row[2] or 'manual')
        billing = get_billing_status(client)
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                UPDATE core_subscriptionpayment
                SET status='confirmed', confirmed_by_id=%s, confirmed_at=%s, period_start=%s, period_end=%s, rejected_reason=NULL
                WHERE id=%s
                ''',
                [request.user.id, timezone.now(), client.subscription_started_at, client.subscription_until, payment_id],
            )
        covered_count = cover_other_pending_payments(client, int(payment_id), request.user)
        return Response({'message': 'Оплату підтверджено. Доступ продовжено на 30 днів.', 'billing': billing, 'payment_id': int(payment_id), 'covered_pending_payments': covered_count})


class BillingAdminRejectPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        repair_legacy_account(request.user)
        if not (is_platform_admin(request.user) or is_partner_user(request.user)):
            return Response({'error': 'Немає прав відхиляти оплату.'}, status=403)
        payment_id = request.data.get('payment_id') or request.data.get('id')
        reason = request.data.get('reason') or 'Оплату не підтверджено.'
        if not payment_id:
            return Response({'error': 'Передайте payment_id.'}, status=400)
        with connection.cursor() as cursor:
            cursor.execute('SELECT pc.assigned_owner_id FROM core_subscriptionpayment p JOIN core_platformclient pc ON pc.id=p.platform_client_id WHERE p.id=%s', [payment_id])
            row = cursor.fetchone()
        if not row:
            return Response({'error': 'Платіж не знайдено.'}, status=404)
        if is_partner_user(request.user) and not is_platform_admin(request.user) and row[0] != request.user.id:
            return Response({'error': 'Немає доступу до цього клієнта.'}, status=403)
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE core_subscriptionpayment SET status='rejected', confirmed_by_id=%s, confirmed_at=%s, rejected_reason=%s WHERE id=%s",
                [request.user.id, timezone.now(), reason, payment_id],
            )
        return Response({'message': 'Заявку на оплату відхилено.', 'payment_id': int(payment_id), 'reason': reason})
