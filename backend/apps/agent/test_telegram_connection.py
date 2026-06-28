from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import Company

from .services import get_company_settings


class TelegramConnectionWebhookSyncTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username='webhook-owner', password='test-pass')
        self.company = Company.objects.create(name='Webhook STO', owner=self.owner)
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.telegram_enabled = True
        settings.save()

    @patch('apps.agent.telegram_connection_views.sync_telegram_webhook')
    def test_creating_telegram_code_syncs_callback_updates(self, sync_webhook):
        sync_webhook.return_value = {
            'url': 'https://testserver/api/agent/telegram/webhook/',
            'allowed_updates': ['message', 'callback_query'],
        }
        self.api.force_authenticate(user=self.owner)

        response = self.api.post(
            '/api/agent/connect-code/',
            {'channel_type': 'telegram'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['channel_type'], 'telegram')
        self.assertTrue(response.data['webhook_synced'])
        self.assertEqual(response.data['allowed_updates'], ['message', 'callback_query'])
        sync_webhook.assert_called_once_with('https://testserver/api/agent/telegram/webhook/')
