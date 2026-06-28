from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, Employee, Visit, WorkPost

from .models import AgentPendingAction, AgentUserChannel
from .services import get_company_settings
from .telegram import BUTTON_SEARCH, process_update


class TelegramVisitCardTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='telegram-card-owner', password='test-pass')
        self.company = Company.objects.create(name='Telegram cards STO', owner=self.owner)
        self.mechanic = User.objects.create_user(username='telegram-card-mechanic', password='test-pass')
        Employee.objects.create(user=self.mechanic, company=self.company, role='mechanic')
        self.work_post = WorkPost.objects.create(company=self.company, name='Пост 1', number=1)
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.telegram_enabled = True
        settings.save()
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Іван Петренко',
            phone='0501234567',
            scheduled_datetime=timezone.now() + timedelta(days=1),
            responsible_mechanic=self.mechanic,
        )
        self.owner_channel = AgentUserChannel.objects.create(
            company=self.company,
            user=self.owner,
            channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
            external_user_id='501',
            chat_id='701',
            display_name='Власник',
        )
        self.mechanic_channel = AgentUserChannel.objects.create(
            company=self.company,
            user=self.mechanic,
            channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
            external_user_id='502',
            chat_id='702',
            display_name='Майстер',
        )

    def _message(self, message_id, text, sender_id='501', chat_id='701'):
        return process_update({
            'update_id': message_id,
            'message': {
                'message_id': message_id,
                'text': text,
                'from': {'id': int(sender_id), 'first_name': 'Тест'},
                'chat': {'id': int(chat_id)},
            },
        })

    def _callback(self, callback_id, data, sender_id='501', chat_id='701'):
        return process_update({
            'update_id': 10000 + int(callback_id),
            'callback_query': {
                'id': f'callback-{callback_id}',
                'data': data,
                'from': {'id': int(sender_id), 'first_name': 'Тест'},
                'message': {
                    'message_id': 9000 + int(callback_id),
                    'chat': {'id': int(chat_id)},
                },
            },
        })

    def _callback_data(self, response):
        rows = response['inline_markup']['inline_keyboard']
        return [button['callback_data'] for row in rows for button in row]

    def test_search_returns_open_buttons_and_card_actions(self):
        search_start = self._message(1, BUTTON_SEARCH)
        self.assertIn('Що знайти', search_start['text'])

        found = self._message(2, 'AA1234AA')
        self.assertIn('Іван Петренко', found['text'])
        self.assertIn(f'v:{self.visit.id}', self._callback_data(found))

        card = self._callback(1, f'v:{self.visit.id}')
        self.assertIn('Іван Петренко', card['text'])
        callbacks = self._callback_data(card)
        self.assertIn(f'st:{self.visit.id}:IN_PROGRESS', callbacks)
        self.assertIn(f'rs:{self.visit.id}', callbacks)
        self.assertIn(f'as:{self.visit.id}', callbacks)
        self.assertIn(f'cn:{self.visit.id}', callbacks)

    def test_reschedule_callback_creates_draft_without_updating_visit(self):
        old_time = self.visit.scheduled_datetime
        started = self._callback(2, f'rs:{self.visit.id}')
        self.assertIn('Введіть нові дату', started['text'])
        self.assertEqual(started['reply_markup']['keyboard'][0][0], '✖️ Скасувати')

        reply = self._message(3, '2030-06-30 10:30')
        self.assertIn('Чернетку перенесення створено', reply['text'])
        action = AgentPendingAction.objects.get(company=self.company, action_type='reschedule_visit')
        self.assertEqual(action.status, AgentPendingAction.STATUS_PENDING)
        self.assertEqual(action.user_id, self.owner.id)

        self.visit.refresh_from_db()
        self.assertEqual(self.visit.scheduled_datetime, old_time)

    def test_status_and_assignment_callbacks_only_create_drafts(self):
        status_reply = self._callback(3, f'st:{self.visit.id}:IN_PROGRESS')
        self.assertIn('Чернетку зміни статусу', status_reply['text'])
        self.assertTrue(AgentPendingAction.objects.filter(
            company=self.company,
            action_type='update_visit_status',
            status=AgentPendingAction.STATUS_PENDING,
        ).exists())
        self.visit.refresh_from_db()
        self.assertEqual(self.visit.status, 'SELECTION')

        menu = self._callback(4, f'as:{self.visit.id}')
        self.assertIn('Оберіть', menu['text'])
        self.assertIn(f'ap:{self.visit.id}:{self.work_post.id}', self._callback_data(menu))

        assigned = self._callback(5, f'ap:{self.visit.id}:{self.work_post.id}')
        self.assertIn('Чернетку призначення', assigned['text'])
        self.assertTrue(AgentPendingAction.objects.filter(
            company=self.company,
            action_type='assign_visit',
            status=AgentPendingAction.STATUS_PENDING,
        ).exists())
        self.visit.refresh_from_db()
        self.assertIsNone(self.visit.work_post_id)

    def test_mechanic_card_hides_update_controls_without_permission(self):
        card = self._callback(6, f'v:{self.visit.id}', sender_id='502', chat_id='702')
        callbacks = self._callback_data(card)
        self.assertNotIn(f'rs:{self.visit.id}', callbacks)
        self.assertNotIn(f'cn:{self.visit.id}', callbacks)
        self.assertNotIn(f'as:{self.visit.id}', callbacks)
        self.assertNotIn(f'st:{self.visit.id}:IN_PROGRESS', callbacks)
