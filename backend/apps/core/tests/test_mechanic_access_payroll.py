from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.test import APIClient

from apps.core.analytics_views import fixed_salary_payout_dates
from apps.core.models import Company, Employee, InventoryItem, OrderPart, OrderService, Visit
from apps.core.safe_crm_views import _payroll_values, service_commission_amount


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class MechanicAccessTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='access-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Access STO')
        self.mechanic = User.objects.create_user(username='access-mechanic', password='pass12345', first_name='Іван')
        self.employee = Employee.objects.create(
            user=self.mechanic,
            company=self.company,
            role='mechanic',
            can_create_visits=False,
            can_view_clients=False,
            can_manage_inventory=False,
            can_take_payments=False,
            can_view_analytics=False,
            can_view_finances=False,
        )
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234BB',
            client='Тестовий клієнт',
            phone='+380501112233',
            status='IN_PROGRESS',
            scheduled_datetime=timezone.now(),
        )
        self.client = APIClient()
        self._authenticate_mechanic()

    def _authenticate_mechanic(self):
        self.mechanic = User.objects.get(pk=self.mechanic.pk)
        self.client.force_authenticate(user=self.mechanic)

    def _set_flag(self, field, value=True):
        Employee.objects.filter(pk=self.employee.pk).update(**{field: value})
        self.employee.refresh_from_db()
        self._authenticate_mechanic()

    def test_client_database_is_denied_but_visit_contact_remains_visible(self):
        key = '380501112233'

        self.assertEqual(self.client.get('/api/store-clients/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/store-clients/detail/?key={key}').status_code, 403)
        self.assertEqual(
            self.client.patch('/api/store-clients/update/', {'key': key, 'client': 'Інше імʼя'}, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                '/api/store-clients/repeat-sale/',
                {'key': key, 'mode': 'sto', 'create_empty': True},
                format='json',
            ).status_code,
            403,
        )

        response = self.client.get('/api/visits/?history=true')
        self.assertEqual(response.status_code, 200, response.data)
        row = next(item for item in response.data if item['id'] == self.visit.id)
        self.assertEqual(row['client'], 'Тестовий клієнт')
        self.assertEqual(row['phone'], '+380501112233')

    def test_client_database_works_after_owner_enables_permission(self):
        self._set_flag('can_view_clients', True)

        response = self.client.get('/api/store-clients/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['results']), 1)
        key = response.data['results'][0]['key']

        detail = self.client.get(f'/api/store-clients/detail/?key={key}')
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data['client'], 'Тестовий клієнт')
        self.assertEqual(detail.data['phone'], '+380501112233')

    def test_create_visit_permission_is_enforced(self):
        payload = {'plate': 'KA7777AA', 'client': 'Новий клієнт', 'phone': '+380671234567'}
        denied = self.client.post('/api/visits/', payload, format='json')
        self.assertEqual(denied.status_code, 403, denied.data)

        self._set_flag('can_create_visits', True)
        allowed = self.client.post('/api/visits/', payload, format='json')
        self.assertEqual(allowed.status_code, 201, allowed.data)
        self.assertTrue(Visit.objects.filter(company=self.company, plate='KA7777AA').exists())

    def test_inventory_read_and_write_are_hidden_without_permission(self):
        InventoryItem.objects.create(
            company=self.company,
            brand='MANN',
            article='W712/95',
            name='Oil filter',
            quantity=3,
            buy_price='100.00',
            sell_price='150.00',
        )

        denied = self.client.get('/api/inventory/')
        self.assertEqual(denied.status_code, 403, getattr(denied, 'data', None))

        self._set_flag('can_manage_inventory', True)
        allowed = self.client.get('/api/inventory/')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertEqual(len(allowed.data), 1)
        self.assertEqual(allowed.data[0]['article'], 'W712/95')

    def test_payment_write_permission_is_enforced(self):
        OrderService.objects.create(
            visit=self.visit,
            name='Діагностика',
            price='500.00',
            quantity=1,
        )
        url = f'/api/visits/{self.visit.id}/add-payment/'

        denied = self.client.post(url, {'amount': '100.00', 'payment_type': 'cash'}, format='json')
        self.assertEqual(denied.status_code, 403, denied.data)

        self._set_flag('can_take_payments', True)
        allowed = self.client.post(url, {'amount': '100.00', 'payment_type': 'cash'}, format='json')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertEqual(allowed.data['finance']['paid_amount'], 100.0)

    def test_analytics_permission_is_enforced(self):
        denied = self.client.get('/api/analytics/summary/?period=today')
        self.assertEqual(denied.status_code, 403, denied.data)

        self._set_flag('can_view_analytics', True)
        allowed = self.client.get('/api/analytics/summary/?period=today')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertEqual(allowed.data['company']['id'], self.company.id)

    def test_finance_permission_is_enforced(self):
        denied = self.client.get('/api/finance/summary/?period=30d')
        self.assertEqual(denied.status_code, 403, denied.data)

        self._set_flag('can_view_finances', True)
        allowed = self.client.get('/api/finance/summary/?period=30d')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertIn('summary', allowed.data)

    def test_employee_and_payroll_management_is_owner_only(self):
        denied = self.client.get('/api/mechanics/')
        self.assertEqual(denied.status_code, 403, denied.data)

        self.client.force_authenticate(user=self.owner)
        allowed = self.client.get('/api/mechanics/')
        self.assertEqual(allowed.status_code, 200, allowed.data)
        self.assertEqual(len(allowed.data), 1)
        self.assertEqual(allowed.data[0]['username'], 'access-mechanic')
        self.assertIn('commission_percent', allowed.data[0])

    def test_owner_is_not_restricted_by_mechanic_feature_flags(self):
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get('/api/store-clients/').status_code, 200)
        self.assertEqual(self.client.get('/api/inventory/').status_code, 200)
        self.assertEqual(self.client.get('/api/analytics/summary/?period=today').status_code, 200)
        self.assertEqual(self.client.get('/api/finance/summary/?period=30d').status_code, 200)


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class PayrollRulesTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='payroll-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Payroll STO')
        self.mechanic = User.objects.create_user(username='payroll-mechanic', password='pass12345', first_name='Петро')
        self.employee = Employee.objects.create(
            user=self.mechanic,
            company=self.company,
            role='mechanic',
            commission_percent='40.00',
            parts_commission_percent='20.00',
            salary_scheme=Employee.SALARY_SERVICES_ONLY,
            payout_period=Employee.PAYOUT_MONTHLY,
            is_salary_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def _service(self, scheme, percent='40.00'):
        visit = Visit.objects.create(
            company=self.company,
            plate=f'TEST-{Visit.objects.count() + 1}',
            client='Payroll client',
            phone='+380501110000',
            status='DONE',
            responsible_mechanic=self.mechanic,
            scheduled_datetime=timezone.now(),
        )
        return OrderService(
            visit=visit,
            mechanic=self.mechanic,
            name='Робота',
            price='1000.00',
            quantity=1,
            commission_percent=percent,
            commission_base=scheme,
        )

    def _mechanic_row(self, response):
        rows = response.data['mechanics']['items']
        return next(item for item in rows if item['id'] == self.mechanic.id)

    def _analytics_today(self):
        response = self.client.get('/api/analytics/summary/?period=today')
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_work_commission_math_is_only_applied_to_work_based_schemes(self):
        services_only = self._service(Employee.SALARY_SERVICES_ONLY)
        combined = self._service(Employee.SALARY_SERVICES_AND_PARTS_PROFIT)
        parts_only = self._service(Employee.SALARY_PARTS_PROFIT_ONLY)
        fixed = self._service(Employee.SALARY_FIXED)
        order_profit = self._service(Employee.SALARY_ORDER_PROFIT)

        self.assertEqual(service_commission_amount(services_only), Decimal('400.00'))
        self.assertEqual(service_commission_amount(combined), Decimal('400.00'))
        self.assertEqual(service_commission_amount(parts_only), Decimal('0.00'))
        self.assertEqual(service_commission_amount(fixed), Decimal('0.00'))
        self.assertEqual(service_commission_amount(order_profit), Decimal('0.00'))

    def test_payroll_validation_rejects_invalid_values_and_accepts_last_day(self):
        with self.assertRaises(serializers.ValidationError):
            _payroll_values({'salary_scheme': Employee.SALARY_FIXED, 'fixed_salary_amount': 0})

        with self.assertRaises(serializers.ValidationError):
            _payroll_values({'commission_percent': 101})

        values = _payroll_values({
            'salary_scheme': Employee.SALARY_FIXED,
            'fixed_salary_amount': '30000.00',
            'payout_period': Employee.PAYOUT_MONTHLY,
            'payout_month_day': 'last',
        })
        self.assertEqual(values['fixed_salary_amount'], Decimal('30000.00'))
        self.assertEqual(values['payout_month_day'], 'last')

    def test_services_only_salary_is_reflected_in_analytics(self):
        self.employee.salary_scheme = Employee.SALARY_SERVICES_ONLY
        self.employee.commission_percent = Decimal('40.00')
        self.employee.save()
        visit = Visit.objects.create(
            company=self.company,
            plate='SERV-ONLY',
            client='Client',
            phone='+380501111001',
            status='DONE',
            responsible_mechanic=self.mechanic,
            scheduled_datetime=timezone.now(),
        )
        OrderService.objects.create(
            visit=visit,
            mechanic=self.mechanic,
            name='Робота',
            price='1000.00',
            quantity=1,
            commission_percent='40.00',
            commission_base=Employee.SALARY_SERVICES_ONLY,
            commission_amount='400.00',
        )

        response = self._analytics_today()
        row = self._mechanic_row(response)
        self.assertEqual(row['service_commission'], 400.0)
        self.assertEqual(row['parts_commission'], 0.0)
        self.assertEqual(row['commission_total'], 400.0)
        self.assertEqual(response.data['summary']['mechanic_commission'], 400.0)

    def test_parts_profit_only_salary_is_reflected_in_analytics(self):
        self.employee.salary_scheme = Employee.SALARY_PARTS_PROFIT_ONLY
        self.employee.parts_commission_percent = Decimal('20.00')
        self.employee.save()
        visit = Visit.objects.create(
            company=self.company,
            plate='PARTS-ONLY',
            client='Client',
            phone='+380501111002',
            status='DONE',
            responsible_mechanic=self.mechanic,
            scheduled_datetime=timezone.now(),
        )
        OrderService.objects.create(
            visit=visit,
            mechanic=self.mechanic,
            name='Робота без відсотка',
            price='1000.00',
            quantity=1,
            commission_percent='0.00',
            commission_base=Employee.SALARY_PARTS_PROFIT_ONLY,
            commission_amount='0.00',
        )
        OrderPart.objects.create(
            visit=visit,
            brand='ATE',
            article='P1',
            name='Колодки',
            buy_price='500.00',
            sell_price='1000.00',
            quantity=1,
            supplier='Test supplier',
        )

        response = self._analytics_today()
        row = self._mechanic_row(response)
        self.assertEqual(row['service_commission'], 0.0)
        self.assertEqual(row['parts_commission'], 100.0)
        self.assertEqual(row['commission_total'], 100.0)
        self.assertEqual(response.data['summary']['mechanic_commission'], 100.0)

    def test_combined_salary_adds_work_and_parts_commissions(self):
        self.employee.salary_scheme = Employee.SALARY_SERVICES_AND_PARTS_PROFIT
        self.employee.commission_percent = Decimal('40.00')
        self.employee.parts_commission_percent = Decimal('20.00')
        self.employee.save()
        visit = Visit.objects.create(
            company=self.company,
            plate='COMBINED',
            client='Client',
            phone='+380501111003',
            status='DONE',
            responsible_mechanic=self.mechanic,
            scheduled_datetime=timezone.now(),
        )
        OrderService.objects.create(
            visit=visit,
            mechanic=self.mechanic,
            name='Робота',
            price='1000.00',
            quantity=1,
            commission_percent='40.00',
            commission_base=Employee.SALARY_SERVICES_AND_PARTS_PROFIT,
            commission_amount='400.00',
        )
        OrderPart.objects.create(
            visit=visit,
            brand='ATE',
            article='P2',
            name='Колодки',
            buy_price='500.00',
            sell_price='1000.00',
            quantity=1,
            supplier='Test supplier',
        )

        response = self._analytics_today()
        row = self._mechanic_row(response)
        self.assertEqual(row['service_commission'], 400.0)
        self.assertEqual(row['parts_commission'], 100.0)
        self.assertEqual(row['commission_total'], 500.0)
        self.assertEqual(response.data['summary']['mechanic_commission'], 500.0)

    def test_order_profit_salary_uses_real_order_profit_and_keeps_historical_percent(self):
        self.employee.salary_scheme = Employee.SALARY_ORDER_PROFIT
        self.employee.commission_percent = Decimal('20.00')
        self.employee.save()
        visit = Visit.objects.create(
            company=self.company,
            plate='ORDER-PROFIT',
            client='Client',
            phone='+380501111004',
            status='DONE',
            responsible_mechanic=self.mechanic,
            scheduled_datetime=timezone.now(),
        )
        service = OrderService.objects.create(
            visit=visit,
            mechanic=self.mechanic,
            name='Робота',
            price='1000.00',
            quantity=1,
            commission_percent='20.00',
            commission_base=Employee.SALARY_ORDER_PROFIT,
            commission_amount='0.00',
        )
        service.refresh_from_db()
        self.assertEqual(service.commission_amount, Decimal('200.00'))

        part = OrderPart.objects.create(
            visit=visit,
            brand='ATE',
            article='P3',
            name='Колодки',
            buy_price='500.00',
            sell_price='800.00',
            quantity=1,
            supplier='Test supplier',
        )
        service.refresh_from_db()
        self.assertEqual(service.commission_amount, Decimal('260.00'))

        # A later payroll change must not rewrite the old service snapshot.
        self.employee.commission_percent = Decimal('50.00')
        self.employee.salary_scheme = Employee.SALARY_FIXED
        self.employee.fixed_salary_amount = Decimal('30000.00')
        self.employee.save()
        part.sell_price = Decimal('1000.00')
        part.save(update_fields=['sell_price'])
        service.refresh_from_db()
        self.assertEqual(service.commission_percent, Decimal('20.00'))
        self.assertEqual(service.commission_base, Employee.SALARY_ORDER_PROFIT)
        self.assertEqual(service.commission_amount, Decimal('300.00'))

    def test_fixed_salary_schedule_supports_daily_weekly_monthly_last_and_custom(self):
        today = timezone.localdate()
        previous_month_end = today.replace(day=1) - timedelta(days=1)
        previous_month_start = previous_month_end.replace(day=1)

        self.employee.salary_scheme = Employee.SALARY_FIXED
        self.employee.fixed_salary_amount = Decimal('30000.00')
        self.employee.salary_effective_from = previous_month_start
        self.employee.is_salary_active = True

        self.employee.payout_period = Employee.PAYOUT_MONTHLY
        self.employee.payout_month_day = 'last'
        dates = fixed_salary_payout_dates(self.employee, {
            'start_date': previous_month_start.isoformat(),
            'end_date': previous_month_end.isoformat(),
        })
        self.assertEqual(dates, [previous_month_end])

        weekly_start = today - timedelta(days=14)
        self.employee.salary_effective_from = weekly_start
        self.employee.payout_period = Employee.PAYOUT_WEEKLY
        self.employee.payout_weekday = today.weekday()
        dates = fixed_salary_payout_dates(self.employee, {
            'start_date': weekly_start.isoformat(),
            'end_date': today.isoformat(),
        })
        self.assertTrue(dates)
        self.assertEqual(dates[-1], today)
        self.assertTrue(all(item.weekday() == today.weekday() for item in dates))

        daily_start = today - timedelta(days=2)
        self.employee.salary_effective_from = daily_start
        self.employee.payout_period = Employee.PAYOUT_DAILY
        dates = fixed_salary_payout_dates(self.employee, {
            'start_date': daily_start.isoformat(),
            'end_date': today.isoformat(),
        })
        self.assertEqual(len(dates), 3)

        self.employee.payout_period = Employee.PAYOUT_CUSTOM
        self.assertEqual(fixed_salary_payout_dates(self.employee, {
            'start_date': daily_start.isoformat(),
            'end_date': today.isoformat(),
        }), [])

    def test_fixed_salary_effective_date_prevents_backdated_payroll(self):
        today = timezone.localdate()
        if today.day > 1:
            start = today.replace(day=1)
            due_day = min(today.day - 1, 28)
            end = today
        else:
            end = today - timedelta(days=1)
            start = end.replace(day=1)
            due_day = min(end.day, 28)

        due_date = start.replace(day=due_day)
        self.employee.salary_scheme = Employee.SALARY_FIXED
        self.employee.fixed_salary_amount = Decimal('30000.00')
        self.employee.payout_period = Employee.PAYOUT_MONTHLY
        self.employee.payout_month_day = str(due_day)
        self.employee.salary_effective_from = due_date + timedelta(days=1)

        dates = fixed_salary_payout_dates(self.employee, {
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
        })
        self.assertEqual(dates, [])

    def test_due_fixed_salary_is_counted_once_in_analytics(self):
        today = timezone.localdate()
        if today.day > 1:
            start = today.replace(day=1)
            due_day = min(today.day - 1, 28)
            end = today
        else:
            end = today - timedelta(days=1)
            start = end.replace(day=1)
            due_day = min(end.day, 28)

        self.employee.salary_scheme = Employee.SALARY_FIXED
        self.employee.fixed_salary_amount = Decimal('30000.00')
        self.employee.payout_period = Employee.PAYOUT_MONTHLY
        self.employee.payout_month_day = str(due_day)
        self.employee.salary_effective_from = start
        self.employee.save()

        response = self.client.get(
            f'/api/analytics/summary/?period=custom&date_from={start.isoformat()}&date_to={end.isoformat()}'
        )
        self.assertEqual(response.status_code, 200, response.data)
        row = self._mechanic_row(response)
        self.assertEqual(row['fixed_salary_total'], 30000.0)
        self.assertEqual(row['fixed_salary_payments'], 1)
        self.assertEqual(row['commission_total'], 30000.0)
        self.assertEqual(response.data['summary']['fixed_salary_total'], 30000.0)
        self.assertEqual(response.data['summary']['mechanic_commission'], 30000.0)
