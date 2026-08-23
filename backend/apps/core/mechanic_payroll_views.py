from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.finance.models import MechanicPayrollRule

from .models import Employee
from .safe_crm_views import safe_ensure_company


SCHEME_SERVICES_ONLY = 'services_only'
SCHEME_PARTS_ONLY = 'parts_only'
SCHEME_SERVICES_AND_PARTS = 'services_and_parts_profit'
SCHEME_ORDER_PROFIT = 'order_profit'
SCHEME_FIXED = 'fixed'
VALID_SCHEMES = {
    SCHEME_SERVICES_ONLY,
    SCHEME_PARTS_ONLY,
    SCHEME_SERVICES_AND_PARTS,
    SCHEME_ORDER_PROFIT,
    SCHEME_FIXED,
}
VALID_PAYOUTS = {'daily', 'weekly', 'monthly', 'custom'}
PAYROLL_FIELDS = {
    'commission_percent',
    'parts_commission_percent',
    'fixed_salary_amount',
    'salary_scheme',
    'payout_period',
    'is_salary_active',
}


def _decimal(value, field_name, default=0):
    if value in [None, '']:
        value = default
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'Поле «{field_name}» має бути числом.')


def _active_rule(employee):
    return employee.payroll_rules.filter(effective_to__isnull=True).order_by('-effective_from', '-id').first()


def _current_payroll(employee):
    rule = _active_rule(employee)
    return {
        'salary_scheme': getattr(employee, 'salary_scheme', SCHEME_SERVICES_ONLY) or SCHEME_SERVICES_ONLY,
        'commission_percent': Decimal(str(getattr(employee, 'commission_percent', 0) or 0)),
        'parts_commission_percent': Decimal(str(getattr(employee, 'parts_commission_percent', 0) or 0)),
        'fixed_salary_amount': Decimal(str(getattr(rule, 'fixed_salary_amount', 0) or 0)),
        'payout_period': getattr(employee, 'payout_period', 'monthly') or 'monthly',
        'is_salary_active': bool(getattr(employee, 'is_salary_active', True)),
    }


def _normalize_payroll(payload, current=None):
    current = current or {
        'salary_scheme': SCHEME_SERVICES_ONLY,
        'commission_percent': Decimal('40'),
        'parts_commission_percent': Decimal('0'),
        'fixed_salary_amount': Decimal('0'),
        'payout_period': 'monthly',
        'is_salary_active': True,
    }

    scheme = str(payload.get('salary_scheme', current['salary_scheme']) or SCHEME_SERVICES_ONLY)
    if scheme not in VALID_SCHEMES:
        raise ValueError('Некоректна схема нарахування зарплати.')

    payout_period = str(payload.get('payout_period', current['payout_period']) or 'monthly')
    if payout_period not in VALID_PAYOUTS:
        raise ValueError('Некоректний період виплати зарплати.')
    if scheme == SCHEME_FIXED and payout_period == 'custom':
        raise ValueError('Для фіксованої зарплати виберіть: щодня, щотижня або щомісяця.')

    work_percent = _decimal(payload.get('commission_percent', current['commission_percent']), '% від робіт')
    parts_percent = _decimal(payload.get('parts_commission_percent', current['parts_commission_percent']), '% від маржі запчастин')
    fixed_amount = _decimal(payload.get('fixed_salary_amount', current['fixed_salary_amount']), 'Фіксована сума')

    if work_percent < 0 or work_percent > 100:
        raise ValueError('Відсоток від робіт має бути від 0 до 100%.')
    if parts_percent < 0 or parts_percent > 100:
        raise ValueError('Відсоток від маржі запчастин має бути від 0 до 100%.')
    if fixed_amount < 0:
        raise ValueError('Фіксована сума не може бути відʼємною.')

    # A scheme is mutually exclusive by design. Hidden values never leak into
    # calculations or analytics when another scheme is selected.
    if scheme == SCHEME_SERVICES_ONLY:
        parts_percent = Decimal('0')
        fixed_amount = Decimal('0')
    elif scheme == SCHEME_PARTS_ONLY:
        work_percent = Decimal('0')
        fixed_amount = Decimal('0')
    elif scheme == SCHEME_SERVICES_AND_PARTS:
        fixed_amount = Decimal('0')
    elif scheme == SCHEME_ORDER_PROFIT:
        parts_percent = Decimal('0')
        fixed_amount = Decimal('0')
    elif scheme == SCHEME_FIXED:
        work_percent = Decimal('0')
        parts_percent = Decimal('0')

    return {
        'salary_scheme': scheme,
        'commission_percent': work_percent,
        'parts_commission_percent': parts_percent,
        'fixed_salary_amount': fixed_amount,
        'payout_period': payout_period,
        'is_salary_active': payload.get('is_salary_active', current['is_salary_active']) is not False,
    }


def _payroll_tuple(data):
    return (
        data['salary_scheme'],
        Decimal(str(data['commission_percent'])),
        Decimal(str(data['parts_commission_percent'])),
        Decimal(str(data['fixed_salary_amount'])),
        data['payout_period'],
        bool(data['is_salary_active']),
    )


def _create_rule(employee, payroll, effective_from=None):
    return MechanicPayrollRule.objects.create(
        company=employee.company,
        employee=employee,
        salary_scheme=payroll['salary_scheme'],
        commission_percent=payroll['commission_percent'],
        parts_commission_percent=payroll['parts_commission_percent'],
        fixed_salary_amount=payroll['fixed_salary_amount'],
        payout_period=payroll['payout_period'],
        is_salary_active=payroll['is_salary_active'],
        effective_from=effective_from or timezone.now(),
    )


def _save_employee_payroll(employee, payroll):
    employee.commission_percent = payroll['commission_percent']
    employee.parts_commission_percent = payroll['parts_commission_percent']
    employee.salary_scheme = payroll['salary_scheme']
    employee.payout_period = payroll['payout_period']
    employee.is_salary_active = payroll['is_salary_active']


class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _serialize_employee(self, employee):
        payroll = _current_payroll(employee)
        user = employee.user
        return {
            'id': user.id,
            'employee_id': employee.id,
            'username': user.username,
            'first_name': user.first_name,
            'email': user.email,
            'role': employee.role,
            'can_create_visits': employee.can_create_visits,
            'can_view_finances': employee.can_view_finances,
            'commission_percent': float(payroll['commission_percent']),
            'parts_commission_percent': float(payroll['parts_commission_percent']),
            'fixed_salary_amount': float(payroll['fixed_salary_amount']),
            'salary_scheme': payroll['salary_scheme'],
            'payout_period': payroll['payout_period'],
            'is_salary_active': payroll['is_salary_active'],
        }

    def list(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response(status=403)
        mechanics = (
            Employee.objects.filter(company=company, role='mechanic')
            .select_related('user')
            .prefetch_related('payroll_rules')
            .order_by('user__first_name', 'user__username')
        )
        return Response([self._serialize_employee(employee) for employee in mechanics])

    def create(self, request):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)

        username = str(request.data.get('username') or '').strip()
        password = str(request.data.get('password') or '')
        first_name = str(request.data.get('first_name') or '').strip()
        if not username or not password:
            return Response({'error': 'Вкажіть логін і пароль працівника.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий'}, status=400)

        try:
            payroll = _normalize_payroll(request.data)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)

        try:
            with transaction.atomic():
                user = User.objects.create_user(username=username, password=password, first_name=first_name)
                employee = Employee(
                    user=user,
                    company=company,
                    role='mechanic',
                    can_create_visits=request.data.get('can_create_visits') is True,
                    can_view_finances=request.data.get('can_view_finances') is True,
                )
                _save_employee_payroll(employee, payroll)
                employee.save()
                _create_rule(employee, payroll)
            return Response(self._serialize_employee(employee), status=201)
        except Exception as exc:
            return Response({'error': str(exc)}, status=500)

    def partial_update(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)

        try:
            with transaction.atomic():
                user = User.objects.select_for_update().get(id=pk, employee_profile__company=company)
                employee = Employee.objects.select_for_update().get(user=user, company=company)

                if request.data.get('first_name') is not None:
                    user.first_name = request.data.get('first_name') or ''
                if request.data.get('email') is not None:
                    user.email = request.data.get('email') or ''
                if request.data.get('new_password'):
                    user.set_password(request.data.get('new_password'))
                user.save()

                if 'can_create_visits' in request.data:
                    employee.can_create_visits = request.data.get('can_create_visits') is True
                if 'can_view_finances' in request.data:
                    employee.can_view_finances = request.data.get('can_view_finances') is True

                current = _current_payroll(employee)
                payroll = _normalize_payroll(request.data, current=current)
                payroll_changed = any(field in request.data for field in PAYROLL_FIELDS) and _payroll_tuple(payroll) != _payroll_tuple(current)

                _save_employee_payroll(employee, payroll)
                employee.save()

                if payroll_changed:
                    now = timezone.now()
                    active_rule = (
                        MechanicPayrollRule.objects.select_for_update()
                        .filter(employee=employee, effective_to__isnull=True)
                        .order_by('-effective_from', '-id')
                        .first()
                    )
                    if active_rule:
                        active_rule.effective_to = now
                        active_rule.save(update_fields=['effective_to'])
                    _create_rule(employee, payroll, effective_from=now)
                elif not _active_rule(employee) and any(field in request.data for field in PAYROLL_FIELDS):
                    _create_rule(employee, payroll)

            return Response(self._serialize_employee(employee))
        except User.DoesNotExist:
            return Response(status=404)
        except Employee.DoesNotExist:
            return Response(status=404)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=400)

    def destroy(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)
        try:
            User.objects.get(id=pk, employee_profile__company=company).delete()
            return Response({'message': 'Видалено'})
        except User.DoesNotExist:
            return Response(status=404)
