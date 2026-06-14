from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import Category, Company, InventoryItem, Supplier, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class ApiSmokeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner', password='pass12345')
        self.company = Company.objects.create(owner=self.user, name='Test STO')
        self.client = APIClient()

    def authenticate(self):
        response = self.client.post('/token/', {'username': 'owner', 'password': 'pass12345'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_auth_token_pair(self):
        response = self.client.post('/token/', {'username': 'owner', 'password': 'pass12345'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_visits_list_requires_auth_then_returns_company_visits(self):
        Visit.objects.create(company=self.company, plate='AA1234BB', client='Client', phone='+380501112233')
        self.assertEqual(self.client.get('/api/visits/').status_code, 401)
        self.authenticate()
        response = self.client.get('/api/visits/?history=true')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_payments_list_is_available_for_authenticated_user(self):
        Visit.objects.create(company=self.company, plate='AA1234BB', client='Client', phone='+380501112233')
        self.authenticate()
        response = self.client.get('/api/payments/')
        self.assertEqual(response.status_code, 200)

    def test_inventory_list_returns_company_items(self):
        category = Category.objects.create(company=self.company, name='Filters')
        supplier = Supplier.objects.create(company=self.company, name='Supplier')
        InventoryItem.objects.create(company=self.company, category=category, supplier=supplier, brand='MANN', article='W712/95', name='Oil filter', quantity=3, buy_price=100, sell_price=150)
        self.authenticate()
        response = self.client.get('/api/inventory/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
