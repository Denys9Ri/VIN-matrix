from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Employee, OrderPart, OrderService, Visit


ZERO = Decimal('0.00')
HUNDRED = Decimal('100')


def money(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return ZERO


def round_money(value):
    return money(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def service_revenue(service):
    quantity = money(getattr(service, 'quantity', 1)) or Decimal('1')
    return money(getattr(service, 'price', 0)) * quantity


def part_profit(part):
    quantity = money(getattr(part, 'quantity', 1)) or Decimal('1')
    return (money(getattr(part, 'sell_price', 0)) - money(getattr(part, 'buy_price', 0))) * quantity


def visit_gross_profit(visit_id):
    services = OrderService.objects.filter(visit_id=visit_id).only('price', 'quantity')
    parts = OrderPart.objects.filter(visit_id=visit_id).only('buy_price', 'sell_price', 'quantity')
    services_profit = sum((service_revenue(item) for item in services), ZERO)
    parts_margin = sum((part_profit(item) for item in parts), ZERO)
    return max(services_profit + parts_margin, ZERO)


def recalculate_order_profit_commissions(visit_id):
    """Recalculate historical order-profit commissions for one visit.

    The OrderService fields commission_base/commission_percent are treated as a
    snapshot of the payroll rule that was active when the work was assigned.
    This avoids rewriting old payroll when an employee's current settings later
    change.
    """
    if not visit_id:
        return {}

    visit = Visit.objects.filter(id=visit_id).only('id', 'responsible_mechanic_id').first()
    if not visit:
        return {}

    services = list(
        OrderService.objects.filter(visit_id=visit_id)
        .only('id', 'mechanic_id', 'price', 'quantity', 'commission_percent', 'commission_base')
        .order_by('id')
    )
    order_profit_services = [
        item for item in services
        if item.commission_base == Employee.SALARY_ORDER_PROFIT and item.mechanic_id
    ]
    if not order_profit_services:
        return {}

    gross_profit = visit_gross_profit(visit_id)
    allocations = {item.id: ZERO for item in order_profit_services}

    responsible_services = [
        item for item in order_profit_services
        if visit.responsible_mechanic_id and item.mechanic_id == visit.responsible_mechanic_id
    ]

    # If the order has a responsible mechanic using the order-profit scheme,
    # that mechanic owns the whole order profit. Otherwise the gross profit is
    # distributed proportionally to each order-profit work line's share of all
    # service revenue in the order.
    if responsible_services:
        denominator = sum((service_revenue(item) for item in responsible_services), ZERO)
        if denominator <= 0:
            denominator = Decimal(len(responsible_services))
        for item in responsible_services:
            weight = (
                service_revenue(item) / denominator
                if service_revenue(item) > 0 and denominator > 0
                else Decimal('1') / Decimal(len(responsible_services))
            )
            basis = gross_profit * weight
            allocations[item.id] = round_money(basis * money(item.commission_percent) / HUNDRED)
    else:
        all_service_revenue = sum((service_revenue(item) for item in services), ZERO)
        if all_service_revenue <= 0:
            all_service_revenue = Decimal(len(order_profit_services))
        for item in order_profit_services:
            weight = (
                service_revenue(item) / all_service_revenue
                if service_revenue(item) > 0 and all_service_revenue > 0
                else Decimal('1') / Decimal(len(order_profit_services))
            )
            basis = gross_profit * weight
            allocations[item.id] = round_money(basis * money(item.commission_percent) / HUNDRED)

    for service_id, amount in allocations.items():
        OrderService.objects.filter(id=service_id).update(commission_amount=amount)

    return allocations


@receiver(post_save, sender=OrderService)
def sync_order_profit_after_service_save(sender, instance, **kwargs):
    allocations = recalculate_order_profit_commissions(instance.visit_id)
    if instance.id in allocations:
        instance.commission_amount = allocations[instance.id]


@receiver(post_delete, sender=OrderService)
def sync_order_profit_after_service_delete(sender, instance, **kwargs):
    recalculate_order_profit_commissions(instance.visit_id)


@receiver(post_save, sender=OrderPart)
def sync_order_profit_after_part_save(sender, instance, **kwargs):
    recalculate_order_profit_commissions(instance.visit_id)


@receiver(post_delete, sender=OrderPart)
def sync_order_profit_after_part_delete(sender, instance, **kwargs):
    recalculate_order_profit_commissions(instance.visit_id)


@receiver(post_save, sender=Visit)
def sync_order_profit_after_visit_save(sender, instance, **kwargs):
    recalculate_order_profit_commissions(instance.id)
