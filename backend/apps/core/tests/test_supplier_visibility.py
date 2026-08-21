from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, Supplier, SupplierAccount


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class SupplierVisibilityTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='supplier-visibility-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Visibility STO', business_type='sto')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def supplier_rows(self):
        response = self.client.get('/api/suppliers/')
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        return data.get('results', []) if isinstance(data, dict) else data

    def test_legacy_default_placeholders_are_not_shown(self):
        for name in ['Vesna-auto', 'Omega', 'Technomir']:
            Supplier.objects.create(
                company=self.company,
                name=name,
                api_type=Supplier.API_CUSTOM,
                api_key='',
            )

        self.assertEqual(self.supplier_rows(), [])

    def test_supplier_explicitly_added_by_user_is_shown(self):
        supplier = Supplier.objects.create(
            company=self.company,
            name='Vesna-auto',
            api_type=Supplier.API_VESNA,
        )

        rows = self.supplier_rows()
        self.assertEqual([row['id'] for row in rows], [supplier.id])
        self.assertEqual(rows[0]['api_type'], Supplier.API_VESNA)

    def test_configured_legacy_supplier_is_preserved_and_normalized(self):
        supplier = Supplier.objects.create(
            company=self.company,
            name='Technomir',
            api_type=Supplier.API_CUSTOM,
            api_key='real-key',
        )

        rows = self.supplier_rows()
        self.assertEqual([row['id'] for row in rows], [supplier.id])
        self.assertEqual(rows[0]['api_type'], Supplier.API_TEHNOMIR)
        self.assertTrue(rows[0]['api_key_set'])

    def test_legacy_supplier_with_account_is_not_hidden(self):
        supplier = Supplier.objects.create(
            company=self.company,
            name='Vesna-auto',
            api_type=Supplier.API_CUSTOM,
            api_key='',
        )
        SupplierAccount.objects.create(
            supplier=supplier,
            name='ФОП Тест',
            api_key='account-key',
            is_active=True,
            is_default=True,
        )

        rows = self.supplier_rows()
        self.assertEqual([row['id'] for row in rows], [supplier.id])
        self.assertEqual(rows[0]['api_type'], Supplier.API_VESNA)
        self.assertEqual(rows[0]['accounts_count'], 1)

    def test_manual_supplier_is_shown_without_api_credentials(self):
        supplier = Supplier.objects.create(
            company=self.company,
            name='Локальний постачальник',
            api_type=Supplier.API_CUSTOM,
        )

        rows = self.supplier_rows()
        self.assertEqual([row['id'] for row in rows], [supplier.id])
