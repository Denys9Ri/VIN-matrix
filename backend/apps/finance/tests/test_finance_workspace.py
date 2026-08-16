from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, OrderPart, OrderService, StoExpense, Visit
from apps.finance.models import FinanceChangeLog, FinanceSourceAllocation, FinanceTransaction, LegalEntity, VisitFinanceAssignment
from apps.finance.services import bootstrap_company_finance, build_ledger, period_bounds


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class FinanceWorkspaceTests(TestCase):
    def setUp(self):
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS core_visitpayment')
            cursor.execute(
                'CREATE TABLE core_visitpayment ('
                'id INTEGER PRIMARY KEY AUTOINCREMENT, '
                'company_id BIGINT NOT NULL, '
                'visit_id BIGINT NOT NULL, '
                'amount DECIMAL NOT NULL, '
                'payment_type VARCHAR(40) NOT NULL, '
                'payment_purpose VARCHAR(40) NOT NULL, '
                'comment TEXT, '
                'created_at DATETIME NOT NULL, '
                'created_by_id BIGINT NULL'
                ')'
            )
        self.owner = User.objects.create_user(username='finance-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Finance STO', business_type='sto')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def tearDown(self):
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE IF EXISTS core_visitpayment')

    def _payment(self, visit, amount, payment_type='cash'):
        with connection.cursor() as cursor:
            cursor.execute(
                'INSERT INTO core_visitpayment '
                '(company_id, visit_id, amount, payment_type, payment_purpose, comment, created_at, created_by_id) '
                'VALUES (%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,%s)',
                [self.company.id, visit.id, amount, payment_type, 'final', 'test payment', self.owner.id],
            )
            return cursor.lastrowid

    def test_bootstrap_single_entity_is_automatic(self):
        entities = bootstrap_company_finance(self.company, self.owner)

        self.assertEqual(len(entities), 1)
        entity = entities[0]
        self.assertTrue(entity.is_primary)
        self.assertTrue(entity.is_default_for_parts)
        self.assertTrue(entity.is_default_for_services)
        self.assertEqual(entity.accounts.filter(is_active=True).count(), 2)
        self.assertTrue(entity.accounts.filter(account_type='cash').exists())
        self.assertTrue(entity.accounts.filter(account_type='bank').exists())

    def test_payment_is_split_between_parts_and_services_entities(self):
        primary = bootstrap_company_finance(self.company, self.owner)[0]
        primary.name = 'ФОП Запчастини'
        primary.save(update_fields=['name', 'updated_at'])
        services_entity = LegalEntity.objects.create(
            company=self.company,
            entity_type='tov',
            name='ТОВ Сервіс',
            is_default_for_services=True,
            sort_order=20,
        )
        primary.is_default_for_services = False
        primary.save(update_fields=['is_default_for_services', 'updated_at'])
        bootstrap_company_finance(self.company, self.owner)

        visit = Visit.objects.create(company=self.company, plate='AA0001AA', client='Клієнт', phone='0500000000')
        OrderPart.objects.create(
            visit=visit,
            brand='Bosch',
            article='P-1',
            name='Запчастина',
            buy_price=Decimal('70.00'),
            sell_price=Decimal('100.00'),
            quantity=Decimal('1.00'),
            supplier='Omega',
        )
        OrderService.objects.create(
            visit=visit,
            name='Робота',
            price=Decimal('50.00'),
            quantity=Decimal('1.00'),
        )
        VisitFinanceAssignment.objects.create(
            company=self.company,
            visit=visit,
            parts_legal_entity=primary,
            services_legal_entity=services_entity,
            updated_by=self.owner,
        )
        self._payment(visit, Decimal('150.00'))

        rows = [item for item in build_ledger(self.company, all_time=True) if item['direction'] == 'income']
        by_entity = {item['legal_entity_name']: Decimal(str(item['amount'])) for item in rows}

        self.assertEqual(by_entity['ФОП Запчастини'], Decimal('100.0'))
        self.assertEqual(by_entity['ТОВ Сервіс'], Decimal('50.0'))

    def test_source_allocation_can_be_corrected_and_audited(self):
        first = bootstrap_company_finance(self.company, self.owner)[0]
        second = LegalEntity.objects.create(company=self.company, entity_type='tov', name='ТОВ Друге', sort_order=20)
        bootstrap_company_finance(self.company, self.owner)
        visit = Visit.objects.create(company=self.company, plate='AA0002AA', client='Клієнт 2', phone='0500000001')
        OrderService.objects.create(visit=visit, name='Діагностика', price=Decimal('200.00'), quantity=Decimal('1.00'))
        payment_id = self._payment(visit, Decimal('200.00'), 'transfer')
        first_account = first.accounts.filter(is_active=True).first()
        second_account = second.accounts.filter(is_active=True).first()

        response = self.client.put(
            '/api/finance/source-allocation/',
            {
                'source_type': 'visit_payment',
                'source_id': payment_id,
                'allocations': [
                    {'legal_entity_id': first.id, 'account_id': first_account.id, 'amount': 80},
                    {'legal_entity_id': second.id, 'account_id': second_account.id, 'amount': 120},
                ],
                'reason': 'Клієнт оплатив на два рахунки',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        allocations = FinanceSourceAllocation.objects.filter(source_type='visit_payment', source_id=payment_id)
        self.assertEqual(allocations.count(), 2)
        self.assertEqual(sum((item.amount for item in allocations), Decimal('0.00')), Decimal('200.00'))
        audit = FinanceChangeLog.objects.filter(object_type='source_allocation').first()
        self.assertIsNotNone(audit)
        self.assertIn('два рахунки', audit.reason)

    def test_salary_payout_changes_cash_flow_without_duplicating_analytics_expense(self):
        entity = bootstrap_company_finance(self.company, self.owner)[0]
        account = entity.accounts.filter(account_type='cash').first()
        response = self.client.post(
            '/api/finance/transactions/',
            {
                'kind': 'expense',
                'source_type': 'salary',
                'occurred_at': '2026-08-16T12:00',
                'amount': 1000,
                'legal_entity_id': entity.id,
                'account_id': account.id,
                'title': 'Виплата зарплати',
                'category': 'salary',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(FinanceTransaction.objects.filter(company=self.company, source_type='salary').count(), 1)
        self.assertEqual(StoExpense.objects.filter(company=self.company).count(), 0)

        bounds = period_bounds('all')
        rows = build_ledger(self.company, bounds=bounds)
        salary_rows = [item for item in rows if item['source_type'] == 'manual_transaction' and item['source_payload'].get('source_type') == 'salary']
        self.assertEqual(len(salary_rows), 1)
        self.assertEqual(Decimal(str(salary_rows[0]['amount'])), Decimal('1000.0'))
