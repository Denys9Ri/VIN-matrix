from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.models import Company


@override_settings(
    SECRET_KEY='test-secret-key-that-is-long-enough-for-hs256-signing',
    DEBUG=False,
    ENABLE_API_DOCS=False,
    ALLOWED_HOSTS=['testserver'],
)
class SecurityHardeningTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='ClientA1', password='Correct!Pass1')
        Company.objects.create(owner=self.user, name='Client company')

    def authenticated_client(self):
        client = APIClient()
        token = client.post('/token/', {'username': 'ClientA1', 'password': 'Correct!Pass1'}, format='json')
        self.assertEqual(token.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
        return client

    def test_schema_and_docs_are_closed_in_production_by_default(self):
        client = APIClient()
        self.assertEqual(client.get('/schema/').status_code, 404)
        self.assertEqual(client.get('/docs/').status_code, 404)

    def test_regular_client_cannot_access_billing_admin(self):
        response = self.authenticated_client().get('/api/billing/admin/clients/')
        self.assertEqual(response.status_code, 403)

    def test_login_rate_limit_blocks_repeated_invalid_attempts(self):
        client = APIClient()
        for _ in range(5):
            response = client.post('/token/', {'username': 'ClientA1', 'password': 'Wrong!Pass1'}, format='json')
            self.assertIn(response.status_code, (400, 401))
        blocked = client.post('/token/', {'username': 'ClientA1', 'password': 'Wrong!Pass1'}, format='json')
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['code'], 'rate_limited')

    def test_registration_rate_limit_blocks_automation(self):
        client = APIClient()
        invalid_payload = {'username': '', 'password': '', 'full_name': '', 'phone': ''}
        for _ in range(5):
            response = client.post('/api/register/', invalid_payload, format='json')
            self.assertEqual(response.status_code, 400)
        blocked = client.post('/api/register/', invalid_payload, format='json')
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.data['code'], 'rate_limited')
