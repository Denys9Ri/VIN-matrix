from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import Category, Company, InventoryItem, ServiceCatalog, Supplier, VehicleRecommendation, Visit


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

    def test_public_landing_lead_is_accepted(self):
        response = self.client.post(
            '/api/landing/leads/',
            {'name': 'Ірина', 'phone': '+380501112233', 'type': 'СТО', 'team': '4–10'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['ok'])

    def test_manual_visit_service_is_added_to_sto_price_list_once(self):
        visit = Visit.objects.create(company=self.company, plate='AA1234BB', client='Client', phone='+380501112233')
        self.authenticate()

        first = self.client.post('/api/order-services/', {
            'visit': visit.id,
            'name': 'Заміна передніх колодок',
            'price': '800.00',
            'quantity': 1,
        }, format='json')
        self.assertEqual(first.status_code, 201, first.data)

        catalog = ServiceCatalog.objects.get(company=self.company, name='Заміна передніх колодок')
        self.assertEqual(str(catalog.price), '800.00')

        second = self.client.post('/api/order-services/', {
            'visit': visit.id,
            'name': 'заміна передніх колодок',
            'price': '650.00',
            'quantity': 1,
        }, format='json')
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(ServiceCatalog.objects.filter(company=self.company, name__iexact='Заміна передніх колодок').count(), 1)

        catalog.refresh_from_db()
        self.assertEqual(str(catalog.price), '800.00')

    def test_store_order_service_does_not_pollute_sto_price_list(self):
        self.company.business_type = 'store'
        self.company.save(update_fields=['business_type'])
        visit = Visit.objects.create(company=self.company, plate='STORE1', client='Buyer', phone='+380501112233')
        self.authenticate()

        response = self.client.post('/api/order-services/', {
            'visit': visit.id,
            'name': 'Доставка',
            'price': '200.00',
            'quantity': 1,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(ServiceCatalog.objects.filter(company=self.company, name='Доставка').exists())

    def test_attention_diagnostic_item_creates_recommendation_without_duplicates(self):
        visit = Visit.objects.create(
            company=self.company,
            plate='AA5678BB',
            client='Diagnostic Client',
            phone='+380501234567',
            delivery_data='{"mileage":"100000"}',
        )
        self.authenticate()
        payload = {
            'visit': visit.id,
            'status': 'completed',
            'checklist': {
                'brakes': {'status': 'attention', 'note': 'Заміна колодок через 2000 км'},
            },
            'summary': 'Гальмівна система потребує уваги.',
        }
        first = self.client.post('/api/visit-diagnostic-checklist/', payload, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data['recommendation_sync']['created'], 1)
        recommendation = VehicleRecommendation.objects.get(visit=visit)
        self.assertEqual(recommendation.due_mileage, 102000)

        payload['checklist'] = first.data['checklist']
        second = self.client.post('/api/visit-diagnostic-checklist/', payload, format='json')
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(VehicleRecommendation.objects.filter(visit=visit).count(), 1)
