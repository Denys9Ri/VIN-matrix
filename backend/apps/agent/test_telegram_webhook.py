from unittest.mock import patch

from django.test import SimpleTestCase


class TelegramWebhookDiagnosticsTests(SimpleTestCase):
    @patch('apps.agent.telegram_views.answer_callback_query')
    @patch('apps.agent.telegram_views.process_update', side_effect=RuntimeError('failure'))
    @patch('apps.agent.telegram_views.webhook_secret_is_valid', return_value=True)
    def test_failed_callback_is_acknowledged(self, _secret_valid, _process_update, answer_callback):
        response = self.client.post(
            '/api/agent/telegram/webhook/',
            data={
                'update_id': 1001,
                'callback_query': {'id': 'callback-123'},
            },
            content_type='application/json',
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN='test-secret',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'ok': True})
        answer_callback.assert_called_once_with('callback-123')
