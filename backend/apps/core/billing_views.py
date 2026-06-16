from decimal import Decimal

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PlatformClient
from .partner_views import get_platform_client, is_platform_admin, is_partner_user, repair_legacy_account
from .subscriptions import CURRENCY, MONTHLY_PRICE, PLAN_CODE, PLAN_NAME, get_billing_status, renew_client_30_days


PAYMENT_METHODS = {
    'monobank_jar': 'Monobank банка',
    'cash': 'Готівка',
    'manual_bank': 'Ручний переказ',
    'bonus': 'Бонус / ручний доступ',
}


def money_value(value):
    try:
        return Decimal(str(value or 0))
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
        payment_id = create_payment(client, amount, method, status='pending', comment=comment, created_by=request.user)
        return Response({
            'id': payment_id,
            'message': 'Заявку на оплату створено. Після перевірки адміністратор підтвердить доступ.',
            'amount': float(amount),
            'currency': CURRENCY,
            'method': method,
            'method_label': PAYMENT_METHODS.get(method, method),
            'billing': get_billing_status(client),
        }, status=201)


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
        return Response({'message': 'Оплату підтверджено. Доступ продовжено на 30 днів.', 'billing': billing, 'payment_id': int(payment_id)})


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
