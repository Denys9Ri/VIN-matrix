from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import Category, Company, InventoryItem, PlatformClient, Supplier, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class SystemStabilityTests(TestCase):
    def setUp(self):
        self.owner_a = User.objects.create_user(username='owner_a', password='pass12345')
        self.owner_b = User.objects.create_user(username='owner_b', password='pass12345')
        self.company_a = Company.objects.create(owner=self.owner_a, name='Company A')
        self.company_b = Company.objects.create(owner=self.owner_b, name='Company B')

    def api_for(self, username, password='pass12345'):
        client = APIClient()
        token_response = client.post('/token/', {'username': username, 'password': password}, format='json')
        self.assertEqual(token_response.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")
        return client

    def test_errors_have_stable_json_shape_and_request_id(self):
        client = APIClient()
        response = client.get('/api/visits/')
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.data)
        self.assertIn('code', response.data)
        self.assertIn('request_id', response.data)
        self.assertIn('X-Request-ID', response)

    def test_company_cannot_read_or_edit_another_company_visit(self):
        foreign_visit = Visit.objects.create(company=self.company_b, plate='BB2222BB', client='Other client', phone='+380501112233')
        client = self.api_for('owner_a')

        response = client.get(f'/api/visits/{foreign_visit.id}/')
        self.assertEqual(response.status_code, 404)

        response = client.patch(f'/api/visits/{foreign_visit.id}/', {'client': 'Unexpected'}, format='json')
        self.assertEqual(response.status_code, 404)
        foreign_visit.refresh_from_db()
        self.assertEqual(foreign_visit.client, 'Other client')

    def test_inventory_list_is_scoped_to_authenticated_company(self):
        category_a = Category.objects.create(company=self.company_a, name='A category')
        supplier_a = Supplier.objects.create(company=self.company_a, name='A supplier')
        own_item = InventoryItem.objects.create(company=self.company_a, category=category_a, supplier=supplier_a, brand='A', article='A-1', name='Own item', quantity=1, buy_price=10, sell_price=20)

        category_b = Category.objects.create(company=self.company_b, name='B category')
        supplier_b = Supplier.objects.create(company=self.company_b, name='B supplier')
        foreign_item = InventoryItem.objects.create(company=self.company_b, category=category_b, supplier=supplier_b, brand='B', article='B-1', name='Foreign item', quantity=1, buy_price=10, sell_price=20)

        response = self.api_for('owner_a').get('/api/inventory/')
        self.assertEqual(response.status_code, 200)
        item_ids = {item['id'] for item in response.data}
        self.assertIn(own_item.id, item_ids)
        self.assertNotIn(foreign_item.id, item_ids)

    def test_billing_block_prevents_business_write(self):
        blocked_user = User.objects.create_user(username='blocked_client', password='pass12345')
        Company.objects.create(owner=blocked_user, name='Blocked company')
        PlatformClient.objects.create(
            user=blocked_user,
            client_code=709901,
            assigned_owner=blocked_user,
            payment_status=PlatformClient.PAYMENT_INACTIVE,
            billing_status=PlatformClient.BILLING_BLOCKED,
            is_access_enabled=False,
        )

        response = self.api_for('blocked_client').post('/api/visits/', {'plate': 'AA0001AA', 'client': 'Client', 'phone': '+380501234567'}, format='json')
        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.data['code'], 'billing_access_required')
        self.assertTrue(response.data['billing_required'])
        self.assertEqual(Visit.objects.filter(company__owner=blocked_user).count(), 0)

    def test_system_health_is_restricted_to_platform_admin(self):
        regular_response = self.api_for('owner_a').get('/api/system/health/')
        self.assertEqual(regular_response.status_code, 403)

        admin = User.objects.create_user(username='Denys9Ri', password='pass12345')
        admin_response = self.api_for('Denys9Ri').get('/api/system/health/')
        self.assertIn(admin_response.status_code, (200, 503))
        self.assertIn('status', admin_response.data)
        self.assertIn('checks', admin_response.data)
