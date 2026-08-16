from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, OrderPart, Supplier, SupplierAccount, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class SupplierAccountTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='supplier-account-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Accounts STO', business_type='sto')
        self.supplier = Supplier.objects.create(
            company=self.company,
            name='Vesna-auto',
            api_type=Supplier.API_VESNA,
        )
        self.visit = Visit.objects.create(
            company=self.company,
            client='Тестовий клієнт',
            phone='0501112233',
            plate='AA1234BB',
            status='ORDERED',
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def create_account(self, name, key, is_default=False):
        response = self.client.post('/api/supplier-accounts/', {
            'supplier': self.supplier.id,
            'name': name,
            'api_key': key,
            'is_active': True,
            'is_default': is_default,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('api_key', response.data)
        return SupplierAccount.objects.get(id=response.data['id'])

    def test_default_account_drives_legacy_search_credentials(self):
        first = self.create_account('ФОП Іваненко Денис', '111:first-token')
        self.supplier.refresh_from_db()
        first.refresh_from_db()
        self.assertTrue(first.is_default)
        self.assertEqual(self.supplier.api_key, '111:first-token')

        second = self.create_account('ТОВ Авто Сервіс Київ', '222:second-token', is_default=True)
        self.supplier.refresh_from_db()
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_default)
        self.assertTrue(second.is_default)
        self.assertEqual(self.supplier.api_key, '222:second-token')

        supplier_response = self.client.get(f'/api/suppliers/{self.supplier.id}/')
        self.assertEqual(supplier_response.status_code, 200)
        self.assertEqual(supplier_response.data['accounts_count'], 2)
        self.assertEqual(supplier_response.data['default_account_name'], second.name)
        self.assertEqual([item['name'] for item in supplier_response.data['accounts']], [second.name, first.name])

    def test_order_part_saves_full_account_name_and_can_change_account(self):
        first = self.create_account('ФОП Іваненко Денис', '111:first-token')
        second = self.create_account('ФОП Іваненко Олена', '222:second-token')

        response = self.client.post('/api/order-parts/', {
            'visit': self.visit.id,
            'brand': 'MANN',
            'article': 'W712/95',
            'name': 'Масляний фільтр',
            'buy_price': '100.00',
            'sell_price': '150.00',
            'quantity': 2,
            'supplier': 'Vesna-auto (Київ)',
            'supplier_ref': self.supplier.id,
            'supplier_account': first.id,
            'status': 'WAITING',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        part = OrderPart.objects.get(id=response.data['id'])
        self.assertEqual(part.supplier_account_id, first.id)
        self.assertEqual(part.supplier_account_name, first.name)
        self.assertEqual(len(response.data['supplier_account_options']), 2)

        update = self.client.patch(f'/api/order-parts/{part.id}/', {
            'supplier_account': second.id,
        }, format='json')
        self.assertEqual(update.status_code, 200, update.data)
        part.refresh_from_db()
        self.assertEqual(part.supplier_account_id, second.id)
        self.assertEqual(part.supplier_account_name, second.name)
        self.assertEqual(update.data['supplier_account_name'], second.name)

        delete = self.client.delete(f'/api/supplier-accounts/{second.id}/')
        self.assertEqual(delete.status_code, 204)
        part.refresh_from_db()
        self.assertIsNone(part.supplier_account_id)
        self.assertEqual(part.supplier_account_name, second.name)

    def test_account_from_another_company_cannot_be_assigned(self):
        other_owner = User.objects.create_user(username='other-owner', password='pass12345')
        other_company = Company.objects.create(owner=other_owner, name='Other STO')
        other_supplier = Supplier.objects.create(company=other_company, name='Other', api_type=Supplier.API_VESNA)
        other_account = SupplierAccount.objects.create(supplier=other_supplier, name='Чужий ФОП', api_key='secret', is_default=True)

        response = self.client.post('/api/order-parts/', {
            'visit': self.visit.id,
            'brand': 'MANN',
            'article': 'W712/95',
            'name': 'Масляний фільтр',
            'buy_price': '100.00',
            'sell_price': '150.00',
            'quantity': 1,
            'supplier': 'Other',
            'supplier_account': other_account.id,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(OrderPart.objects.filter(visit=self.visit).exists())
