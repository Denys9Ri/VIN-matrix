from decimal import Decimal

from django.db import connection
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import log_activity
from .models import CRMTask, Visit
from .safe_crm_views import safe_ensure_company


def dec(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal('0')


def f(value):
    try:
        return float(dec(value))
    except Exception:
        return 0.0


def money_text(value):
    return f"{f(value):,.2f}".replace(',', ' ') + ' ₴'


def pay_type_label(value):
    return {
        'cash': 'Готівка',
        'card': 'Карта',
        'transfer': 'Переказ',
        'terminal': 'Термінал',
        'other': 'Інше',
    }.get(value or 'cash', value or 'Готівка')


def rows_for_visit(visit_id):
    with connection.cursor() as cursor:
        cursor.execute('SELECT id, amount, payment_type, payment_purpose, comment, created_at FROM core_visitpayment WHERE visit_id=%s ORDER BY created_at DESC, id DESC', [visit_id])
        rows = cursor.fetchall()
    return [{'id': r[0], 'amount': f(r[1]), 'payment_type': r[2], 'payment_purpose': r[3], 'comment': r[4] or '', 'created_at': r[5]} for r in rows]


def totals_for_visit(visit):
    parts = sum(dec(p.sell_price) * (dec(p.quantity) or Decimal('1')) for p in visit.parts.all())
    services = sum(dec(s.price) * (dec(s.quantity) or Decimal('1')) for s in visit.services.all())
    total = parts + services
    with connection.cursor() as cursor:
        cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM core_visitpayment WHERE visit_id=%s', [visit.id])
        paid = dec(cursor.fetchone()[0])
    if paid <= 0 and dec(visit.prepayment_amount) > 0:
        paid = dec(visit.prepayment_amount)
    debt = max(total - paid, Decimal('0'))
    return {'grand_total': f(total), 'paid_amount': f(paid), 'debt_amount': f(debt), 'is_paid': debt <= 0 and total > 0}


def sync_status(visit):
    t = totals_for_visit(visit)
    if t['grand_total'] <= 0:
        status = 'unpaid'
    elif t['debt_amount'] <= 0:
        status = 'paid'
    elif t['paid_amount'] > 0:
        status = 'prepaid'
    else:
        status = 'unpaid'
    visit.payment_status = status
    visit.prepayment_amount = dec(t['paid_amount'])
    visit.save(update_fields=['payment_status', 'prepayment_amount', 'updated_at'])
    return t


def add_payment(visit, user, amount, payment_type='cash', purpose='partial', comment=''):
    amount = dec(amount)
    if amount <= 0:
        raise ValueError('Сума оплати має бути більше 0.')
    with connection.cursor() as cursor:
        cursor.execute(
            'INSERT INTO core_visitpayment (company_id, visit_id, amount, payment_type, payment_purpose, comment, created_at, created_by_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id',
            [visit.company_id, visit.id, amount, payment_type or 'cash', purpose or 'partial', comment or '', timezone.now(), user.id if user and user.is_authenticated else None],
        )
        payment_id = cursor.fetchone()[0]
    finance = sync_status(visit)
    is_final = purpose == 'final' or f(finance.get('debt_amount')) <= 0
    log_activity(
        company=visit.company,
        user=user,
        visit=visit,
        action_type='payment_closed' if is_final else 'payment_added',
        title='Борг закрито' if is_final else f'Додано оплату {money_text(amount)}',
        description=f"{money_text(amount)} · {pay_type_label(payment_type)} · залишок боргу {money_text(finance.get('debt_amount'))}" + (f" · {comment}" if comment else ''),
        old_value=None,
        new_value=str(finance.get('debt_amount')),
        metadata={
            'payment_id': payment_id,
            'amount': f(amount),
            'payment_type': payment_type or 'cash',
            'payment_purpose': purpose or 'partial',
            'comment': comment or '',
            'debt_amount': finance.get('debt_amount'),
            'paid_amount': finance.get('paid_amount'),
            'grand_total': finance.get('grand_total'),
        }
    )
    return payment_id, finance


class VisitPaymentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        visit_id = request.query_params.get('visit')
        if not company or not visit_id:
            return Response({'results': []})
        visit = Visit.objects.filter(company=company, id=visit_id).first()
        if not visit:
            return Response({'results': []})
        return Response({'results': rows_for_visit(visit.id), 'finance': totals_for_visit(visit)})

    def post(self, request):
        company = safe_ensure_company(request.user)
        visit = Visit.objects.filter(company=company, id=request.data.get('visit')).first() if company else None
        if not visit:
            return Response({'error': 'Візит/замовлення не знайдено.'}, status=404)
        try:
            payment_id, finance = add_payment(visit, request.user, request.data.get('amount'), request.data.get('payment_type'), request.data.get('payment_purpose'), request.data.get('comment'))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response({'id': payment_id, 'payments': rows_for_visit(visit.id), 'finance': finance, 'visit_id': visit.id})


class VisitAddPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        company = safe_ensure_company(request.user)
        visit = Visit.objects.filter(company=company, id=pk).first() if company else None
        if not visit:
            return Response({'error': 'Візит/замовлення не знайдено.'}, status=404)
        try:
            payment_id, finance = add_payment(visit, request.user, request.data.get('amount'), request.data.get('payment_type'), request.data.get('payment_purpose'), request.data.get('comment'))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)
        return Response({'id': payment_id, 'payments': rows_for_visit(visit.id), 'finance': finance, 'visit_id': visit.id})


class VisitMarkPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        company = safe_ensure_company(request.user)
        visit = Visit.objects.filter(company=company, id=pk).first() if company else None
        if not visit:
            return Response({'error': 'Візит/замовлення не знайдено.'}, status=404)
        finance = totals_for_visit(visit)
        amount = dec(finance['debt_amount'])
        if amount > 0:
            add_payment(visit, request.user, amount, request.data.get('payment_type') or 'cash', 'final', request.data.get('comment') or 'Закриття боргу')
        return Response({'payments': rows_for_visit(visit.id), 'finance': sync_status(visit), 'visit_id': visit.id})


class VisitDebtReminderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        company = safe_ensure_company(request.user)
        visit = Visit.objects.filter(company=company, id=pk).first() if company else None
        if not visit:
            return Response({'error': 'Візит/замовлення не знайдено.'}, status=404)
        finance = totals_for_visit(visit)
        task = CRMTask.objects.create(
            company=company,
            visit=visit,
            client=visit.client,
            phone=visit.phone,
            plate=visit.plate,
            title='Нагадати про оплату',
            description=request.data.get('comment') or f"Борг {finance['debt_amount']} грн по №{visit.id}",
            due_date=request.data.get('due_date') or None,
            created_by=request.user,
        )
        log_activity(
            company=company,
            user=request.user,
            visit=visit,
            action_type='payment_reminder_created',
            title='Створено нагадування по боргу',
            description=request.data.get('comment') or f"Борг {money_text(finance['debt_amount'])} по №{visit.id}",
            metadata={'task_id': task.id, 'debt_amount': finance.get('debt_amount'), 'due_date': request.data.get('due_date') or None}
        )
        return Response({'id': task.id, 'message': 'Нагадування створено.'})
