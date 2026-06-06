from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum


def money(value):
    try:
        return Decimal(str(value or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal('0.00')


def as_float(value):
    return float(money(value))


def visit_parts_total(visit):
    total = Decimal('0.00')
    cost = Decimal('0.00')
    for part in visit.parts.all():
        qty = money(part.quantity or 1) or Decimal('1.00')
        sell = money(part.sell_price)
        buy = money(part.buy_price)
        total += sell * qty
        cost += buy * qty
    return money(total), money(cost)


def visit_services_total(visit):
    total = Decimal('0.00')
    for service in visit.services.all():
        qty = money(service.quantity or 1) or Decimal('1.00')
        total += money(service.price) * qty
    return money(total)


def paid_amount_for_visit(visit):
    try:
        payments_total = visit.payments.aggregate(total=Sum('amount')).get('total')
    except Exception:
        payments_total = None
    if payments_total is not None:
        return money(payments_total)
    return money(getattr(visit, 'prepayment_amount', 0))


def finance_for_visit(visit):
    parts_total, parts_cost = visit_parts_total(visit)
    services_total = visit_services_total(visit)
    grand_total = money(parts_total + services_total)
    paid = paid_amount_for_visit(visit)
    debt = money(max(grand_total - paid, Decimal('0.00')))
    profit = money(parts_total - parts_cost + services_total)
    margin = money((profit / grand_total * Decimal('100')) if grand_total else Decimal('0.00'))
    return {
        'parts_total': as_float(parts_total),
        'parts_cost': as_float(parts_cost),
        'services_total': as_float(services_total),
        'grand_total': as_float(grand_total),
        'paid_amount': as_float(paid),
        'debt_amount': as_float(debt),
        'profit': as_float(profit),
        'margin': as_float(margin),
        'is_paid': debt <= 0 and grand_total > 0,
    }


def sync_visit_payment_status(visit):
    finance = finance_for_visit(visit)
    total = money(finance['grand_total'])
    paid = money(finance['paid_amount'])
    debt = money(finance['debt_amount'])
    if total <= 0:
        status = 'unpaid'
    elif debt <= 0:
        status = 'paid'
    elif paid > 0:
        status = 'prepaid'
    else:
        status = 'unpaid'
    visit.payment_status = status
    visit.prepayment_amount = paid
    visit.save(update_fields=['payment_status', 'prepayment_amount', 'updated_at'])
    return finance_for_visit(visit)
