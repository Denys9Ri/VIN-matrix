from django.contrib.auth.models import User
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .billing_client_link_views import get_client_link_settings
from .billing_views import (
    PAYMENT_METHODS,
    client_admin_row,
    cover_other_pending_payments,
    create_payment,
    ensure_partner_payout_table,
    find_pending_payment,
    list_payments,
    money_value,
    parse_period,
    partner_payout_rows,
)
from .models import PlatformClient
from .partner_views import get_platform_client, is_platform_admin, is_partner_user, repair_legacy_account
from .subscriptions import CURRENCY, MONTHLY_PRICE, PLAN_CODE, PLAN_NAME, get_billing_status, renew_client_30_days


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
        queryset = PlatformClient.objects.select_related('user', 'assigned_owner').order_by('-created_at')
        if is_partner_user(request.user) and not is_platform_admin(request.user):
            queryset = queryset.filter(assigned_owner=request.user)
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(client_code__icontains=search)
                | Q(phone__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(assigned_owner__username__icontains=search)
                | Q(assigned_owner__first_name__icontains=search)
            )
        status_filter = request.query_params.get('billing_status') or request.query_params.get('status')
        rows = []
        summary = {'total': 0, 'trial': 0, 'active': 0, 'grace': 0, 'blocked': 0, 'manual_free': 0, 'paid': 0}
        for client in queryset[:300]:
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
        conditions = []
        if status_filter:
            conditions.append('p.status = %s')
            params.append(status_filter)
        if is_partner_user(request.user) and not is_platform_admin(request.user):
            conditions.append('pc.assigned_owner_id = %s')
            params.append(request.user.id)
        where_sql = 'WHERE ' + ' AND '.join(conditions) if conditions else ''
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
        return Response({
            'message': 'Оплату підтверджено. Доступ продовжено на 30 днів.',
            'billing': billing,
            'payment_id': int(payment_id),
            'covered_pending_payments': covered_count,
        })


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
            cursor.execute(
                'SELECT pc.assigned_owner_id FROM core_subscriptionpayment p JOIN core_platformclient pc ON pc.id=p.platform_client_id WHERE p.id=%s',
                [payment_id],
            )
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
