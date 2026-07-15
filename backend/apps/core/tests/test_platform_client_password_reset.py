import re

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, Employee, PlatformClient
from apps.core.platform_client_views import PASSWORD_SPECIAL_CHARS


@override_settings(SECRET_KEY='test-secret-key')
class PlatformClientPasswordResetTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('Denys9Ri', password='admin-old')
        self.partner = User.objects.create_user('partner', password='partner-pass')
        self.other_partner = User.objects.create_user('other_partner', password='partner-pass')
        self.regular_user = User.objects.create_user('regular', password='regular-pass')
        self.client_user = User.objects.create_user('client', password='old-client-pass')
        self.other_client_user = User.objects.create_user('other_client', password='old-other-pass')
        self.inactive_user = User.objects.create_user('inactive_client', password='old-inactive-pass', is_active=False)

        self.partner_company = Company.objects.create(owner=self.partner, name='Partner Company')
        self.other_partner_company = Company.objects.create(owner=self.other_partner, name='Other Partner Company')
        self.regular_company = Company.objects.create(owner=self.regular_user, name='Regular Company')
        Company.objects.create(owner=self.client_user, name='Client Company')
        Company.objects.create(owner=self.other_client_user, name='Other Client Company')
        Company.objects.create(owner=self.inactive_user, name='Inactive Client Company')

        Employee.objects.create(user=self.partner, company=self.partner_company, role='partner')
        Employee.objects.create(user=self.other_partner, company=self.other_partner_company, role='partner')

        self.platform_client = PlatformClient.objects.create(user=self.client_user, client_code=7001, assigned_owner=self.partner)
        self.other_platform_client = PlatformClient.objects.create(user=self.other_client_user, client_code=7002, assigned_owner=self.other_partner)
        self.inactive_platform_client = PlatformClient.objects.create(user=self.inactive_user, client_code=7003, assigned_owner=self.partner)
        self.staff_target = User.objects.create_user('staff_target', password='staff-old', is_staff=True)
        self.admin_platform_client = PlatformClient.objects.create(user=self.staff_target, client_code=7004, assigned_owner=self.admin)
        self.api = APIClient()

    def auth(self, user):
        token = AccessToken.for_user(user)
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def reset_password(self, client_id):
        return self.api.post(f'/api/platform-clients/{client_id}/reset-password/', {}, format='json')

    def assert_secure_password_shape(self, password):
        self.assertGreaterEqual(len(password), 12)
        self.assertLessEqual(len(password), 16)
        self.assertRegex(password, r'[A-Z]')
        self.assertRegex(password, r'[a-z]')
        self.assertRegex(password, r'\d')
        self.assertTrue(any(char in PASSWORD_SPECIAL_CHARS for char in password))
        self.assertNotIn(password, {'12345678', 'password', 'Password1!'})

    def test_platform_admin_can_reset_client_password_and_new_password_works(self):
        self.auth(self.admin)
        response = self.reset_password(self.platform_client.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Пароль успішно скинуто.')
        self.assertEqual(response.data['username'], self.client_user.username)
        new_password = response.data['temporary_password']
        self.assert_secure_password_shape(new_password)

        self.client_user.refresh_from_db()
        self.assertFalse(self.client_user.check_password('old-client-pass'))
        self.assertTrue(self.client_user.check_password(new_password))

    def test_assigned_partner_can_reset_own_client_password(self):
        self.auth(self.partner)
        response = self.reset_password(self.platform_client.id)

        self.assertEqual(response.status_code, 200)
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.check_password(response.data['temporary_password']))

    def test_partner_cannot_reset_another_partner_client_password(self):
        self.auth(self.partner)
        response = self.reset_password(self.other_platform_client.id)

        self.assertEqual(response.status_code, 403)
        self.other_client_user.refresh_from_db()
        self.assertTrue(self.other_client_user.check_password('old-other-pass'))

    def test_regular_user_gets_forbidden(self):
        self.auth(self.regular_user)
        response = self.reset_password(self.platform_client.id)

        self.assertEqual(response.status_code, 403)
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.check_password('old-client-pass'))

    def test_main_admin_is_protected(self):
        self.auth(self.admin)
        response = self.reset_password(self.admin_platform_client.id)

        self.assertEqual(response.status_code, 400)
        self.staff_target.refresh_from_db()
        self.assertTrue(self.staff_target.check_password('staff-old'))

    def test_inactive_user_is_protected(self):
        self.auth(self.admin)
        response = self.reset_password(self.inactive_platform_client.id)

        self.assertEqual(response.status_code, 400)
        self.inactive_user.refresh_from_db()
        self.assertTrue(self.inactive_user.check_password('old-inactive-pass'))

    def test_password_is_not_written_to_safe_audit_log_payload(self):
        self.auth(self.admin)
        with self.assertLogs('apps.core.platform_client_views', level='INFO') as logs:
            response = self.reset_password(self.platform_client.id)

        self.assertEqual(response.status_code, 200)
        password = response.data['temporary_password']
        combined_logs = '\n'.join(logs.output)
        self.assertIn('admin_password_reset', combined_logs)
        self.assertNotIn(password, combined_logs)
        self.assertNotRegex(combined_logs, re.escape(password))
