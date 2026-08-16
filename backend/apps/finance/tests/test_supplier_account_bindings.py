from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, OrderPart, Supplier, SupplierAccount, Visit
from apps.finance.models import LegalEntity, SupplierAccountBinding, VisitFinanceAssignment
from apps.finance.supplier_bindings import cleanup_runtime_legacy_supplier_account_duplicates


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class SupplierAccountBindingTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='binding-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Binding STO', business_type='sto')
        self.supplier = Supplier.objects.create(
            company=self.company,
            name='Vesna-auto',
            api_type=Supplier.API_VESNA,
        )
        self.parts_fop = LegalEntity.objects.create(
            company=self.company,
            entity_type=LegalEntity.TYPE_FOP,
            name='Драгун Таїсія Вікторівна',
            is_active=True,
            is_default_for_parts=True,
            sort_order=10,
        )
        self.other_fop = LegalEntity.objects.create(
            company=self.company,
            entity_type=LegalEntity.TYPE_FOP,
            name='Драгун Валентин Вікторович',
            is_active=True,
            sort_order=20,
        )
        self.visit = Visit.objects.create(
            company=self.company,
            client='Клієнт',
            phone='0501112233',
            plate='AA1234BB',
            status='ORDERED',
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def create_account(self, name, key, legal_entity_id=None):
        payload = {
            'supplier': self.supplier.id,
            'name': name,
            'api_key': key,
            'is_active': True,
        }
        if legal_entity_id is not None:
            payload['legal_entity_id'] = legal_entity_id
        response = self.client.post('/api/supplier-accounts/', payload, format='json')
        return response

    def test_supplier_account_can_be_explicitly_bound_to_finance_entity(self):
        response = self.create_account('Vesna доступ Таїсія', '111:key', self.parts_fop.id)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['legal_entity_id'], self.parts_fop.id)
        self.assertEqual(response.data['legal_entity_name'], self.parts_fop.name)
        account = SupplierAccount.objects.get(id=response.data['id'])
        binding = SupplierAccountBinding.objects.get(supplier_account=account)
        self.assertEqual(binding.legal_entity_id, self.parts_fop.id)
        self.assertEqual(binding.supplier_id, self.supplier.id)

        detail = self.client.get(f'/api/suppliers/{self.supplier.id}/')
        self.assertEqual(detail.status_code, 200, detail.data)
        nested = next(item for item in detail.data['accounts'] if item['id'] == account.id)
        self.assertEqual(nested['legal_entity_id'], self.parts_fop.id)

    def test_legacy_account_name_auto_matches_finance_entity(self):
        response = self.create_account('ФОП Драгун Валентин Вікторович', '222:key')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['legal_entity_id'], self.other_fop.id)
        account = SupplierAccount.objects.get(id=response.data['id'])
        self.assertTrue(
            SupplierAccountBinding.objects.filter(
                supplier_account=account,
                legal_entity=self.other_fop,
            ).exists()
        )

    def test_order_part_uses_account_mapped_to_selected_parts_entity(self):
        wrong = self.create_account('Vesna Таїсія', '111:key', self.parts_fop.id)
        right = self.create_account('Vesna Валентин', '222:key', self.other_fop.id)
        self.assertEqual(wrong.status_code, 201, wrong.data)
        self.assertEqual(right.status_code, 201, right.data)

        VisitFinanceAssignment.objects.create(
            company=self.company,
            visit=self.visit,
            parts_legal_entity=self.other_fop,
            services_legal_entity=self.parts_fop,
            updated_by=self.owner,
        )

        response = self.client.post('/api/order-parts/', {
            'visit': self.visit.id,
            'brand': 'MANN',
            'article': 'W712/95',
            'name': 'Масляний фільтр',
            'buy_price': '100.00',
            'sell_price': '150.00',
            'quantity': 1,
            'supplier': 'Vesna-auto',
            'supplier_ref': self.supplier.id,
            # Simulate the old frontend sending its generic/default account.
            # The Finance parts entity must win on initial creation.
            'supplier_account': wrong.data['id'],
            'status': 'WAITING',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        part = OrderPart.objects.get(id=response.data['id'])
        self.assertEqual(part.supplier_account_id, right.data['id'])
        self.assertEqual(part.supplier_account_name, 'Vesna Валентин')

    def test_same_supplier_cannot_have_two_accounts_for_one_legal_entity(self):
        first = self.create_account('Vesna 1', '111:key', self.parts_fop.id)
        self.assertEqual(first.status_code, 201, first.data)
        before_count = SupplierAccount.objects.filter(supplier=self.supplier).count()

        second = self.create_account('Vesna 2', '222:key', self.parts_fop.id)

        self.assertEqual(second.status_code, 400, second.data)
        self.assertIn('legal_entity_id', second.data.get('details', {}))
        self.assertEqual(SupplierAccount.objects.filter(supplier=self.supplier).count(), before_count)

    def test_runtime_legacy_duplicate_is_removed_but_single_account_is_kept(self):
        renamed = SupplierAccount.objects.create(
            supplier=self.supplier,
            name='Драгун Таїсія Вікторівна',
            api_key='same:key',
            is_active=True,
            is_default=True,
        )
        ghost = SupplierAccount.objects.create(
            supplier=self.supplier,
            name='Основний акаунт',
            api_key='same:key',
            is_active=True,
            is_default=False,
        )

        removed = cleanup_runtime_legacy_supplier_account_duplicates()

        self.assertEqual(removed, 1)
        self.assertTrue(SupplierAccount.objects.filter(id=renamed.id).exists())
        self.assertFalse(SupplierAccount.objects.filter(id=ghost.id).exists())

        other_supplier = Supplier.objects.create(
            company=self.company,
            name='Omega',
            api_type=Supplier.API_OMEGA,
        )
        sole = SupplierAccount.objects.create(
            supplier=other_supplier,
            name='Основний акаунт',
            api_key='unique:key',
            is_active=True,
            is_default=True,
        )

        removed_again = cleanup_runtime_legacy_supplier_account_duplicates()

        self.assertEqual(removed_again, 0)
        self.assertTrue(SupplierAccount.objects.filter(id=sole.id).exists())
