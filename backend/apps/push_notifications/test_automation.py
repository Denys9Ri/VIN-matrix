from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, Visit

from .models import WebPushDispatchLog, WebPushPreference, WebPushSubscription
from .scheduler import process_scheduled_pushes


User = get_user_model()


def make_subscription(user):
    return WebPushSubscription.objects.create(
        user=user,
        endpoint=f'https://push.example.test/{user.id}',
        p256dh='p256dh-test',
        auth='auth-test',
        is_active=True,
    )


class OperationalPushTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner', password='test-password')
        self.company = Company.objects.create(name='Test STO', owner=self.user)
        make_subscription(self.user)
        self.preference = WebPushPreference.objects.create(
            user=self.user,
            quiet_hours_enabled=False,
            visit_reminder_minutes=60,
            debt_notification_times=['10:00'],
        )

    @patch('apps.push_notifications.service.send_web_push', return_value=(True, None, ''))
    def test_visit_status_change_sends_immediate_push(self, mocked_send):
        visit = Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Олександр',
            phone='0500000000',
            status='SELECTION',
        )

        visit.status = 'IN_PROGRESS'
        visit.save(update_fields=['status', 'updated_at'])

        self.assertEqual(mocked_send.call_count, 1)
        payload = mocked_send.call_args.args[1]
        self.assertIn('статус змінено', payload['title'])
        self.assertIn('В обробці', payload['body'])
        self.assertIn('В роботі', payload['body'])
        self.assertIn(f'visit_id={visit.id}', payload['url'])

    @patch('apps.push_notifications.service.send_web_push', return_value=(True, None, ''))
    def test_visit_reminder_is_sent_once_even_when_scheduler_runs_twice(self, mocked_send):
        now = timezone.now().replace(second=0, microsecond=0)
        visit = Visit.objects.create(
            company=self.company,
            plate='BB7777BB',
            client='Іван',
            phone='0670000000',
            status='SELECTION',
            scheduled_datetime=now + timedelta(minutes=60),
        )

        first = process_scheduled_pushes(now=now)
        second = process_scheduled_pushes(now=now + timedelta(minutes=1))

        self.assertEqual(first['visit_reminders'], 1)
        self.assertEqual(second['visit_reminders'], 0)
        self.assertEqual(mocked_send.call_count, 1)
        self.assertEqual(WebPushDispatchLog.objects.filter(user=self.user, event_key__startswith=f'visit-reminder:{visit.id}:').count(), 1)

    def test_automation_preferences_api_validates_and_saves_schedule(self):
        client = APIClient()
        client.force_authenticate(self.user)

        response = client.patch(
            '/api/push/preferences/',
            {
                'automation': {
                    'visit_reminder_minutes': 120,
                    'debt_schedule_days': 'daily',
                    'debt_notification_times': ['09:30', '17:00'],
                    'crm_reminder_days_before': 1,
                    'crm_notification_time': '09:00',
                    'quiet_hours_enabled': True,
                    'quiet_hours_start': '21:00',
                    'quiet_hours_end': '08:00',
                }
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.preference.refresh_from_db()
        self.assertEqual(self.preference.visit_reminder_minutes, 120)
        self.assertEqual(self.preference.debt_schedule_days, 'daily')
        self.assertEqual(self.preference.debt_notification_times, ['09:30', '17:00'])
        self.assertEqual(response.data['automation']['crm_notification_time'], '09:00')

    def test_debt_times_are_limited_to_three_per_day(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.patch(
            '/api/push/preferences/',
            {'automation': {'debt_notification_times': ['08:00', '10:00', '14:00', '18:00']}},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
