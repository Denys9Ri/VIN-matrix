from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.finance import finance_for_visit
from apps.core.models import Company, OrderPart, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class SupplierPartQuantityTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='quantity-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Quantity STO', business_type='sto')
        self.visit = Visit.objects.create(
            company=self.company,
            client='Тестовий клієнт',
            phone='0501112233',
            plate='AA1234BB',
            status='ORDERED',
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def test_supplier_part_quantity_is_saved_and_included_in_visit_totals(self):
        response = self.client.post('/api/order-parts/', {
            'visit': self.visit.id,
            'brand': 'MANN',
            'article': 'W712/95',
            'name': 'Масляний фільтр',
            'buy_price': '100.00',
            'sell_price': '150.00',
            'quantity': 2,
            'supplier': 'Vesna-auto (Київ)',
            'status': 'WAITING',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        part = OrderPart.objects.get(visit=self.visit)
        self.assertEqual(part.quantity, Decimal('2'))

        visit_response = self.client.get(f'/api/visits/{self.visit.id}/')
        self.assertEqual(visit_response.status_code, 200)
        self.assertEqual(Decimal(str(visit_response.data['parts'][0]['quantity'])), Decimal('2'))

        finance = finance_for_visit(self.visit)
        self.assertEqual(Decimal(str(finance['parts_total'])), Decimal('300'))
        self.assertEqual(Decimal(str(finance['profit'])), Decimal('100'))
