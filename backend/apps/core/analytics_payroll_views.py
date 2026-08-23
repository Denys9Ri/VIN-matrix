from calendar import monthrange
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from apps.finance.models import MechanicPayrollRule

from . import analytics_views as base
from .safe_crm_views import safe_ensure_company


PARTS_SCHEMES = {'parts_only', 'services_and_parts_profit'}


def _parts_commission_eligible(employee):
    if not employee or not getattr(employee, 'is_salary_active', True):
        return False
    if getattr(employee, 'salary_scheme', '') not in PARTS_SCHEMES:
        return False
    return base.money(getattr(employee, 'parts_commission_percent', 0)) > 0


# The legacy analytics implementation already has correct allocation logic for
# parts margin. Extend only the eligibility predicate so a parts-only scheme
# uses that same battle-tested allocation path while service commission stays 0%.
base.mechanic_is_parts_commission_eligible = _parts_commission_eligible


def _date(value):
    if not value:
        return None
    if hasattr(value, 'date') and not isinstance(value, str):
        try:
            return timezone.localtime(value).date()
        except Exception:
            return value.date()
    return base.parse_iso_date(value)


def _daily_fixed_cost(rule, day):
    amount = base.money(rule.fixed_salary_amount)
    if amount <= 0:
        return Decimal('0')
    if rule.payout_period == 'daily':
        return amount
    if rule.payout_period == 'weekly':
        return amount / Decimal('7')
    # Monthly (and legacy custom) is accrued over calendar days so any analytics
    # interval remains consistent and does not depend on an arbitrary payday.
    return amount / Decimal(str(monthrange(day.year, day.month)[1]))


def _fixed_payroll(company, bounds):
    selected_start = _date(bounds.get('start_date'))
    selected_end = _date(bounds.get('end_date')) or timezone.localdate()

    rules = list(
        MechanicPayrollRule.objects.filter(
            company=company,
            salary_scheme='fixed',
            is_salary_active=True,
            fixed_salary_amount__gt=0,
        )
        .select_related('employee', 'employee__user')
        .order_by('employee_id', 'effective_from', 'id')
    )
    if not rules:
        return {}, {}, Decimal('0')

    if selected_start is None:
        selected_start = min((_date(rule.effective_from) for rule in rules), default=selected_end)

    by_employee = defaultdict(lambda: Decimal('0'))
    by_bucket = defaultdict(lambda: Decimal('0'))
    total = Decimal('0')

    for rule in rules:
        rule_start = _date(rule.effective_from)
        if not rule_start:
            continue
        rule_end = selected_end
        if rule.effective_to:
            # effective_to is exclusive. A rule changed today should not charge
            # both the old and new scheme for the same calendar day.
            rule_end = min(rule_end, _date(rule.effective_to) - timedelta(days=1))

        start = max(selected_start, rule_start)
        end = min(selected_end, rule_end)
        if start > end:
            continue

        day = start
        while day <= end:
            cost = _daily_fixed_cost(rule, day)
            if cost > 0:
                by_employee[rule.employee_id] += cost
                key, _ = base.chart_key(base.local_start_of_day(day), bounds.get('group_by') or 'day')
                by_bucket[key] += cost
                total += cost
            day += timedelta(days=1)

    return by_employee, by_bucket, total


def _active_rules(company):
    rules = (
        MechanicPayrollRule.objects.filter(company=company, effective_to__isnull=True)
        .select_related('employee')
        .order_by('employee_id', '-effective_from', '-id')
    )
    return {rule.employee_id: rule for rule in rules}


class AnalyticsSummaryView(base.AnalyticsSummaryView):
    """Original analytics plus payroll rules that are not tied to an OrderService."""

    def get(self, request):
        response = super().get(request)
        if getattr(response, 'status_code', 200) != 200 or not isinstance(getattr(response, 'data', None), dict):
            return response

        company = safe_ensure_company(request.user)
        if not company or getattr(company, 'business_type', 'sto') == 'store':
            return response

        bounds = base.period_bounds(request)
        fixed_by_employee, fixed_by_bucket, fixed_total = _fixed_payroll(company, bounds)
        active_rules = _active_rules(company)
        payload = response.data

        mechanics = payload.setdefault('mechanics', {'summary': {}, 'items': []})
        mechanic_items = mechanics.setdefault('items', [])
        for item in mechanic_items:
            employee_id = item.get('employee_id')
            fixed_accrued = fixed_by_employee.get(employee_id, Decimal('0'))
            active_rule = active_rules.get(employee_id)
            current_fixed_amount = (
                base.money(active_rule.fixed_salary_amount)
                if active_rule and active_rule.salary_scheme == 'fixed'
                else Decimal('0')
            )
            item['fixed_salary_amount'] = base.round_money(current_fixed_amount)
            item['fixed_salary_accrued'] = base.round_money(fixed_accrued)
            item['commission_total'] = base.round_money(base.money(item.get('commission_total')) + fixed_accrued)
            if item.get('salary_scheme') == 'fixed':
                item['average_commission_percent'] = 0

        mechanic_items.sort(key=lambda item: base.money(item.get('commission_total')), reverse=True)

        summary = payload.setdefault('summary', {})
        existing_mechanic_total = base.money(summary.get('mechanic_commission'))
        mechanic_total = existing_mechanic_total + fixed_total
        summary['mechanic_commission'] = base.round_money(mechanic_total)
        summary['net_profit_before_expenses'] = base.round_money(base.money(summary.get('gross_profit')) - mechanic_total)
        summary['net_profit'] = base.round_money(
            base.money(summary.get('gross_profit'))
            - mechanic_total
            - base.money(summary.get('operating_expenses'))
        )
        mechanics.setdefault('summary', {})['commission_total'] = base.round_money(mechanic_total)

        chart = payload.setdefault('chart', [])
        chart_map = {str(item.get('date')): item for item in chart}
        for key, fixed_cost in fixed_by_bucket.items():
            item = chart_map.get(key)
            if item is None:
                if bounds.get('group_by') == 'month':
                    label = timezone.datetime.strptime(key, '%Y-%m').strftime('%b %Y')
                else:
                    label = timezone.datetime.strptime(key, '%Y-%m-%d').strftime('%d %b')
                item = {
                    'date': key,
                    'label': label,
                    'revenue': 0,
                    'profit': 0,
                    'net_profit': 0,
                    'mechanic_commission': 0,
                    'operating_expenses': 0,
                    'orders_count': 0,
                    'average_check': 0,
                    'debt': 0,
                }
                chart.append(item)
                chart_map[key] = item

            item['mechanic_commission'] = base.round_money(base.money(item.get('mechanic_commission')) + fixed_cost)
            item['net_profit'] = base.round_money(
                base.money(item.get('profit'))
                - base.money(item.get('mechanic_commission'))
                - base.money(item.get('operating_expenses'))
            )

        chart.sort(key=lambda item: str(item.get('date') or ''))
        return response
