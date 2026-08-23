from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, InventoryItem, OrderPart, OrderService, Visit


@override_settings(SECRET_KEY='test-security-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class BackendSecurityBoundaryTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='security-owner',
            password='OwnerPassword2026!',
            first_name='Owner',
        )
        self.company = Company.objects.create(owner=self.owner, name='Secure STO', business_type='sto')
        self.mechanic = User.objects.create_user(
            username='security-mechanic',
            password='MechanicPassword2026!',
            first_name='Mechanic',
        )
        self.employee = Employee.objects.create(
            user=self.mechanic,
            company=self.company,
            role='mechanic',
            can_create_visits=True,
            can_view_clients=False,
            can_manage_inventory=False,
            can_take_payments=False,
            can_view_analytics=False,
            can_view_finances=False,
        )
        self.visit = Visit.objects.create(
            company=self.company,
            plate='SEC1234',
            client='Secure Client',
            phone='+380501234567',
            status='IN_PROGRESS',
            payment_status='unpaid',
            prepayment_amount=0,
            scheduled_datetime=timezone.now(),
        )
        self.part = OrderPart.objects.create(
            visit=self.visit,
            brand='MANN',
            article='SEC-PART',
            name='Security Part',
            buy_price='100.00',
            sell_price='180.00',
            quantity=1,
            supplier='Supplier',
        )
        self.service = OrderService.objects.create(
            visit=self.visit,
            mechanic=self.mechanic,
            name='Security service',
            price='500.00',
            quantity=1,
            commission_percent='40.00',
            commission_base='services_only',
            commission_amount='200.00',
        )
        self.inventory = InventoryItem.objects.create(
            company=self.company,
            brand='MANN',
            article='INV-SEC',
            name='Inventory security item',
            quantity=4,
            buy_price='90.00',
            sell_price='150.00',
        )
        self.client = APIClient()
        self._auth(self.mechanic)

    def _auth(self, user):
        user.refresh_from_db()
        self.client.force_authenticate(user=user)

    def _set_flags(self, **flags):
        for field, value in flags.items():
            setattr(self.employee, field, value)
        self.employee.save(update_fields=list(flags.keys()))
        self._auth(self.mechanic)

    def _visit_row(self):
        response = self.client.get('/api/visits/?history=true')
        self.assertEqual(response.status_code, 200, response.data)
        return next(row for row in response.data if row['id'] == self.visit.id)

    def test_exports_backup_and_import_are_owner_only(self):
        for path in [
            '/api/export/clients/',
            '/api/export/orders/',
            '/api/export/inventory/',
            '/api/export/backup/',
        ]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 403, (path, getattr(response, 'data', None)))

        for path in ['/api/import/clients/', '/api/import/legacy-clients/']:
            response = self.client.post(path, {}, format='multipart')
            self.assertEqual(response.status_code, 403, (path, getattr(response, 'data', None)))

        self._auth(self.owner)
        self.assertEqual(self.client.get('/api/export/backup/').status_code, 200)

    def test_visit_keeps_operational_contact_but_hides_internal_finance(self):
        row = self._visit_row()
        self.assertEqual(row['client'], 'Secure Client')
        self.assertEqual(row['phone'], '+380501234567')
        for field in ['finance', 'payments', 'paid_amount', 'debt_amount', 'prepayment_amount', 'payment_status']:
            self.assertNotIn(field, row)
        self.assertNotIn('buy_price', row['parts'][0])
        for field in ['commission_percent', 'commission_amount', 'commission_base', 'commission_label']:
            self.assertNotIn(field, row['services'][0])

    def test_payment_operator_gets_customer_totals_but_not_profit(self):
        self._set_flags(can_take_payments=True)
        row = self._visit_row()
        self.assertIn('finance', row)
        self.assertIn('grand_total', row['finance'])
        self.assertIn('debt_amount', row['finance'])
        self.assertNotIn('profit', row['finance'])
        self.assertNotIn('margin', row['finance'])
        self.assertNotIn('buy_price', row['parts'][0])
        self.assertNotIn('commission_amount', row['services'][0])

    def test_finance_permission_returns_full_financial_visit_payload(self):
        self._set_flags(can_view_finances=True)
        row = self._visit_row()
        self.assertIn('profit', row['finance'])
        self.assertIn('buy_price', row['parts'][0])
        self.assertIn('commission_amount', row['services'][0])

    def test_mechanic_cannot_patch_payment_fields_directly(self):
        self._set_flags(can_take_payments=True)
        response = self.client.patch(
            f'/api/visits/{self.visit.id}/',
            {'payment_status': 'paid', 'prepayment_amount': '99999.00'},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.data)
        self.visit.refresh_from_db()
        self.assertEqual(self.visit.payment_status, 'unpaid')
        self.assertEqual(float(self.visit.prepayment_amount or 0), 0.0)

    def test_inventory_insights_and_configuration_require_inventory_permission(self):
        for path in ['/api/inventory/insights/', '/api/categories/', '/api/suppliers/', '/api/supplier-accounts/']:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 403, (path, getattr(response, 'data', None)))

        self._set_flags(can_manage_inventory=True)
        for path in ['/api/inventory/insights/', '/api/categories/', '/api/suppliers/', '/api/supplier-accounts/']:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, (path, getattr(response, 'data', None)))

    def test_expenses_and_finance_are_read_only_for_finance_enabled_mechanic(self):
        self._set_flags(can_view_finances=True)
        self.assertEqual(self.client.get('/api/expenses/').status_code, 200)
        self.assertEqual(self.client.get('/api/finance/summary/?period=30d').status_code, 200)

        expense_write = self.client.post(
            '/api/expenses/',
            {'date': str(date.today()), 'category': 'other', 'title': 'Injected expense', 'amount': '1.00', 'payment_method': 'cash'},
            format='json',
        )
        self.assertEqual(expense_write.status_code, 403, expense_write.data)

        finance_write = self.client.post(
            '/api/finance/legal-entities/',
            {'name': 'Injected FOP', 'entity_type': 'fop'},
            format='json',
        )
        self.assertEqual(finance_write.status_code, 403, finance_write.data)

    def test_company_settings_are_redacted_and_owner_only_for_writes(self):
        self.company.payment_requisites = 'SECRET PAYMENT REQUISITES'
        self.company.document_requisites = 'SECRET DOCUMENT REQUISITES'
        self.company.global_margin_percent = 37
        self.company.save()

        response = self.client.get('/api/settings/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['company']['name'], 'Secure STO')
        self.assertNotIn('payment_requisites', response.data['company'])
        self.assertNotIn('document_requisites', response.data['company'])
        self.assertNotIn('global_margin_percent', response.data['company'])
        self.assertNotIn('billing', response.data)

        denied = self.client.patch('/api/settings/', {'company[name]': 'Hacked'}, format='multipart')
        self.assertEqual(denied.status_code, 403, getattr(denied, 'data', None))
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, 'Secure STO')

    def test_company_options_and_onboarding_writes_are_owner_only(self):
        self.assertEqual(self.client.get('/api/settings/dictionaries/?mode=sto').status_code, 200)
        option_write = self.client.post(
            '/api/settings/options/',
            {'group': 'payment_type', 'mode': 'both', 'label': 'Injected'},
            format='json',
        )
        self.assertEqual(option_write.status_code, 403, option_write.data)
        onboarding_write = self.client.patch('/api/onboarding/', {'action': 'business', 'business_type': 'store'}, format='json')
        self.assertEqual(onboarding_write.status_code, 403, onboarding_write.data)

    def test_client_history_crm_apis_require_client_permission(self):
        paths = [
            '/api/recommendations/',
            '/api/crm-tasks/',
            '/api/crm-communications/',
            '/api/crm-client-statuses/',
            '/api/crm-service-reminders/',
        ]
        for path in paths:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 403, (path, getattr(response, 'data', None)))

        self._set_flags(can_view_clients=True)
        for path in paths:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, (path, getattr(response, 'data', None)))

    def test_payment_history_and_debt_reminder_require_payment_access(self):
        payments_url = f'/api/payments/?visit={self.visit.id}'
        reminder_url = f'/api/visits/{self.visit.id}/debt-reminder/'
        self.assertEqual(self.client.get(payments_url).status_code, 403)
        self.assertEqual(self.client.post(reminder_url, {'comment': 'test'}, format='json').status_code, 403)

        self._set_flags(can_take_payments=True)
        self.assertEqual(self.client.get(payments_url).status_code, 200)
        self.assertEqual(self.client.post(reminder_url, {'comment': 'test'}, format='json').status_code, 200)

    def test_dashboard_redacts_ungranted_sensitive_sections(self):
        response = self.client.get('/api/dashboard/summary/')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(data.get('money'), {})
        self.assertEqual(data.get('stock'), {})
        self.assertEqual(data.get('top_clients'), [])
        self.assertEqual(data.get('top_products'), [])
        for period in (data.get('periods') or {}).values():
            self.assertNotIn('revenue', period)
            self.assertNotIn('profit', period)
        self.assertFalse(data['capabilities']['can_view_finances'])
        self.assertFalse(data['capabilities']['can_manage_inventory'])

    def test_notifications_filter_sections_by_permissions(self):
        response = self.client.get('/api/notifications/summary/')
        self.assertEqual(response.status_code, 200, response.data)
        keys = {section.get('key') for section in response.data.get('sections', [])}
        self.assertNotIn('low_stock', keys)
        self.assertNotIn('debts', keys)
        self.assertNotIn('payment_due', keys)
        self.assertNotIn('crm_tasks', keys)
        self.assertNotIn('service_reminders', keys)
        self.assertNotIn('recommendations', keys)

    def test_activity_journal_is_owner_only(self):
        self.assertEqual(self.client.get('/api/activity/').status_code, 403)
        self._auth(self.owner)
        self.assertEqual(self.client.get('/api/activity/').status_code, 200)

    def test_supplier_price_files_are_not_public_media(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/media/supplier_prices/confidential.xlsx')
        self.assertEqual(response.status_code, 404)

    def test_password_change_rejects_weak_password(self):
        response = self.client.post(
            '/api/change-password/',
            {'old_password': 'MechanicPassword2026!', 'new_password': '12345678'},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)

        strong = self.client.post(
            '/api/change-password/',
            {'old_password': 'MechanicPassword2026!', 'new_password': 'NewMechanicPassword2026!'},
            format='json',
        )
        self.assertEqual(strong.status_code, 200, strong.data)

    def test_employee_management_rejects_weak_password(self):
        self._auth(self.owner)
        response = self.client.post(
            '/api/mechanics/',
            {'username': 'new-mechanic', 'password': '12345678', 'first_name': 'New'},
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(User.objects.filter(username='new-mechanic').exists())
