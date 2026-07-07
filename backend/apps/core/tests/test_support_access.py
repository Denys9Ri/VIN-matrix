from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, PlatformClient, SupportAccessSession


@override_settings(SECRET_KEY='test-secret')
class SupportAccessTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin', password='pass', is_staff=True)
        self.partner = User.objects.create_user('partner', password='pass')
        self.client_user = User.objects.create_user('client', password='pass', first_name='Іван', last_name='Клієнт')
        Company.objects.create(owner=self.client_user, name='СТО Тест')
        self.platform_client = PlatformClient.objects.create(
            user=self.client_user,
            client_code=101,
            phone='+380501112233',
            assigned_owner=self.admin,
        )
        self.api = APIClient()

    def auth(self, user):
        token = AccessToken.for_user(user)
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return token

    def test_non_admin_cannot_start_support_session(self):
        self.auth(self.partner)
        response = self.api.post('/api/support/start/', {'client_id': self.platform_client.id, 'reason': 'test'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(SupportAccessSession.objects.count(), 0)

    def test_admin_can_start_status_and_exit_support_session(self):
        self.auth(self.admin)
        response = self.api.post('/api/support/start/', {'client_id': self.platform_client.id, 'reason': 'Технічна підтримка'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        session = SupportAccessSession.objects.get()
        self.assertEqual(session.admin_user, self.admin)
        self.assertEqual(session.target_user, self.client_user)
        self.assertEqual(session.reason, 'Технічна підтримка')

        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        status_response = self.api.get('/api/support/status/')
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(status_response.data['client_code'], self.platform_client.client_code)
        self.assertEqual(status_response.data['company_name'], 'СТО Тест')

        exit_response = self.api.post('/api/support/exit/')
        self.assertEqual(exit_response.status_code, 200)
        session.refresh_from_db()
        self.assertIsNotNone(session.ended_at)
        self.assertIn(self.api.get('/api/support/status/').status_code, [401, 403])

    def test_expired_support_session_is_rejected_but_normal_jwt_still_works(self):
        session = SupportAccessSession.objects.create(
            admin_user=self.admin,
            platform_client=self.platform_client,
            target_user=self.client_user,
            reason='expired',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        token = AccessToken.for_user(self.client_user)
        token['support_mode'] = True
        token['support_session_id'] = str(session.session_id)
        token['support_actor_id'] = self.admin.id
        token['support_target_user_id'] = self.client_user.id
        token['support_client_id'] = self.platform_client.id
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertIn(self.api.get('/api/support/status/').status_code, [401, 403])

        self.auth(self.client_user)
        response = self.api.get('/api/settings/')
        self.assertNotIn(response.status_code, [401, 403])
