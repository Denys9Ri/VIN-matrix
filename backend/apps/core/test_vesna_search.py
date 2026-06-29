from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from .models import Company, Supplier
from .vesna_search_view import _credentials, _is_vesna, _map_item


class VesnaCredentialsTests(SimpleTestCase):
    def test_requires_customer_id_and_token(self):
        supplier = type('SupplierStub', (), {'api_key': '12345:Token abc'})()
        self.assertEqual(_credentials(supplier), (12345, 'abc'))

    def test_rejects_token_without_customer_id(self):
        supplier = type('SupplierStub', (), {'api_key': 'Token abc'})()
        self.assertEqual(_credentials(supplier), (None, ''))


class VesnaMappingTests(TestCase):
    def setUp(self):
        owner = User.objects.create_user(username='vesna-owner', password='test-pass')
        self.company = Company.objects.create(name='Vesna test STO', owner=owner)
        self.supplier = Supplier.objects.create(
            company=self.company,
            name='Постачальник без назви Vesna',
            api_type=Supplier.API_VESNA,
            api_key='12345:Token test-token',
        )

    def test_recognizes_api_type_even_when_name_does_not_match(self):
        self.assertTrue(_is_vesna(self.supplier))

    def test_accepts_balance_dictionary_and_filters_zero_stock(self):
        item = {
            'sku': '42',
            'article': 'ABC-123',
            'brand': 'BOSCH',
            'name': 'Деталь',
            'price': '10.5',
            'balance': {
                'items': [
                    {'warehouse_id': 'zero', 'name': 'Нульовий', 'quantity': '0'},
                    {'warehouse_id': 'kyiv', 'name': 'Київ', 'quantity': '3'},
                ],
            },
        }

        result = _map_item(self.supplier, item, 40, 'ABC123', False, '')

        self.assertIsNotNone(result)
        self.assertEqual(result['buy_price'], 420.0)
        self.assertEqual(result['quantity'], '3 шт (Київ)')
        self.assertEqual(len(result['warehouses']), 1)
