from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from .models import WebPushPreference


User = get_user_model()


class WebPushPreferencesApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='push-owner', password='test-password')
        self.other_user = User.objects.create_user(username='push-other', password='test-password')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_preferences_are_created_with_safe_defaults(self):
        response = self.client.get('/api/push/preferences/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['preferences'], {
            'visit_reminders': True,
            'status_updates': True,
            'payments': True,
            'inventory': True,
            'delivery': True,
            'crm': True,
        })
        self.assertTrue(WebPushPreference.objects.filter(user=self.user).exists())

    def test_user_can_update_one_category_without_touching_other_users(self):
        WebPushPreference.objects.create(user=self.other_user, payments=True)

        response = self.client.patch(
            '/api/push/preferences/',
            {'preferences': {'payments': False}},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['preferences']['payments'])
        self.assertFalse(WebPushPreference.objects.get(user=self.user).payments)
        self.assertTrue(WebPushPreference.objects.get(user=self.other_user).payments)

    def test_preferences_reject_non_boolean_values(self):
        response = self.client.patch(
            '/api/push/preferences/',
            {'preferences': {'delivery': 'yes'}},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
