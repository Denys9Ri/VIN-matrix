from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, OrderService, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class ClientDebtPaymentMethodTests(TestCase):
    def setUp(self):
        with connection.cursor() as cursor:
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
        self.owner = User.objects.create_user(username='payment-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Payment STO', business_type='sto')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def tearDown(self):
        with connection.cursor() as cursor:
            cursor.execute('DROP TABLE core_visitpayment')

    @patch('apps.core.payment_views.log_activity')
    def test_mark_paid_records_selected_payment_method_for_analytics(self, _log_activity):
        visit = Visit.objects.create(
            company=self.company,
            plate='AA1234BB',
            client='Андрій Гуцуленко',
            phone='0934563578',
            payment_status='unpaid',
        )
        OrderService.objects.create(
            visit=visit,
            name='Ремонт автомобіля',
            price=Decimal('1350.00'),
            quantity=Decimal('1.00'),
        )

        response = self.client.post(
            f'/api/visits/{visit.id}/mark-paid/',
            {
                'payment_type': 'card',
                'comment': 'Оплата карткою в CRM',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(str(response.data['finance']['debt_amount'])), Decimal('0'))

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT amount, payment_type, payment_purpose, comment '
                'FROM core_visitpayment WHERE visit_id=%s',
                [visit.id],
            )
            payment = cursor.fetchone()

        self.assertIsNotNone(payment)
        self.assertEqual(Decimal(str(payment[0])), Decimal('1350'))
        self.assertEqual(payment[1], 'card')
        self.assertEqual(payment[2], 'final')
        self.assertEqual(payment[3], 'Оплата карткою в CRM')

        visit.refresh_from_db()
        self.assertEqual(visit.payment_status, 'paid')
