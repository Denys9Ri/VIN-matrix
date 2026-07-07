from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, Visit, WorkPost

from .models import AgentAuditLog, AgentPendingAction, AgentUserChannel
from .services import create_connection_code, get_company_settings, get_member_access
from .telegram import (
    BUTTON_CANCEL,
    BUTTON_FREE_SLOTS,
    BUTTON_NEW_VISIT,
    BUTTON_SEARCH,
    MAIN_REPLY_MARKUP,
    WORKFLOW_REPLY_MARKUP,
    process_update,
)
from .tools.visits import find_visits


class AgentAccessIsolationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='test-pass')
        self.company = Company.objects.create(name='Main STO', owner=self.owner)
        self.worker = User.objects.create_user(username='worker', password='test-pass')
        Employee.objects.create(
            user=self.worker,
            company=self.company,
            role='mechanic',
            can_create_visits=False,
            can_view_finances=False,
        )

        self.other_owner = User.objects.create_user(username='other-owner', password='test-pass')
        self.other_company = Company.objects.create(name='Other STO', owner=self.other_owner)

        config = get_company_settings(self.company)
        config.is_enabled = True
        config.telegram_enabled = True
        config.save()

    def test_mechanic_sees_only_assigned_visits(self):
        own_visit = Visit.objects.create(
            company=self.company,
            plate='AA1111AA',
            client='Іван',
            phone='0501111111',
            responsible_mechanic=self.worker,
            scheduled_datetime=timezone.now(),
        )
        Visit.objects.create(
            company=self.company,
            plate='BB2222BB',
            client='Петро',
            phone='0502222222',
            scheduled_datetime=timezone.now(),
        )
        Visit.objects.create(
            company=self.other_company,
            plate='CC3333CC',
            client='Іван',
            phone='0503333333',
            scheduled_datetime=timezone.now(),
        )

        results = find_visits(self.worker, 'Іван')

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], own_visit.id)

    def test_owner_receives_full_access_defaults(self):
        access = get_member_access(self.company, self.owner)
        self.assertTrue(access.is_enabled)
        self.assertTrue(access.can_view_all_visits)
        self.assertTrue(access.can_view_finances)

    def test_connection_code_is_created_only_for_enabled_channel(self):
        code = create_connection_code(self.owner, 'telegram')
        self.assertEqual(code.company_id, self.company.id)
        self.assertTrue(code.is_usable)


class AgentAuditLogApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username='owner', password='test-pass')
        self.company = Company.objects.create(name='Main STO', owner=self.owner)
        self.worker = User.objects.create_user(username='worker', password='test-pass')
        Employee.objects.create(user=self.worker, company=self.company, role='mechanic')

        self.other_owner = User.objects.create_user(username='other-owner', password='test-pass')
        self.other_company = Company.objects.create(name='Other STO', owner=self.other_owner)

        config = get_company_settings(self.company)
        config.is_enabled = True
        config.save()

        self.owner_log = AgentAuditLog.objects.create(
            company=self.company,
            user=self.owner,
            recognized_intent='connection_code_created',
            tool_name='create_connection_code',
        )
        self.worker_log = AgentAuditLog.objects.create(
            company=self.company,
            user=self.worker,
            recognized_intent='daily_schedule',
            tool_name='telegram_text_router',
            request_text='розклад',
        )
        self.other_log = AgentAuditLog.objects.create(
            company=self.other_company,
            user=self.other_owner,
            recognized_intent='find_visit',
            tool_name='telegram_text_router',
        )

    def test_owner_sees_only_company_audit_log(self):
        self.api.force_authenticate(user=self.owner)

        response = self.api.get('/api/agent/audit-log/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['scope'], 'company')
        returned_ids = {item['id'] for item in response.data['items']}
        self.assertEqual(returned_ids, {self.owner_log.id, self.worker_log.id})
        self.assertNotIn(self.other_log.id, returned_ids)

    def test_employee_sees_only_personal_audit_log(self):
        self.api.force_authenticate(user=self.worker)

        response = self.api.get('/api/agent/audit-log/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['scope'], 'personal')
        self.assertEqual([item['id'] for item in response.data['items']], [self.worker_log.id])


class TelegramVisitWizardTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='telegram-owner', password='test-pass')
        self.company = Company.objects.create(name='Telegram STO', owner=self.owner)
        config = get_company_settings(self.company)
        config.is_enabled = True
        config.telegram_enabled = True
        config.save()
        self.channel = AgentUserChannel.objects.create(
            company=self.company,
            user=self.owner,
            channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
            external_user_id='1001',
            chat_id='2002',
            display_name='Тестовий користувач',
        )

    def _send(self, message_id, text):
        return process_update({
            'update_id': message_id,
            'message': {
                'message_id': message_id,
                'text': text,
                'from': {'id': 1001, 'first_name': 'Тестовий'},
                'chat': {'id': 2002},
            },
        })


    def _callback(self, update_id, callback_data):
        return process_update({
            'update_id': update_id,
            'callback_query': {
                'id': f'cb-{update_id}',
                'data': callback_data,
                'from': {'id': 1001, 'first_name': 'Тестовий'},
                'message': {'message_id': update_id, 'chat': {'id': 2002}},
            },
        })

    def test_free_slots_button_is_in_reply_keyboard(self):
        flat = [button for row in MAIN_REPLY_MARKUP['keyboard'] for button in row]
        self.assertIn(BUTTON_FREE_SLOTS, flat)

    def test_free_slots_tomorrow_shows_slots_and_slot_starts_create_visit(self):
        WorkPost.objects.create(company=self.company, number=1, name='Пост 1', is_active=True)

        start = self._send(10, BUTTON_FREE_SLOTS)
        self.assertIn('Оберіть дату', start['text'])
        self.assertEqual(start['reply_markup'], MAIN_REPLY_MARKUP)
        tomorrow_button = start['inline_markup']['inline_keyboard'][0][1]
        self.assertEqual(tomorrow_button['text'], 'Завтра')

        slots = self._callback(11, tomorrow_button['callback_data'])
        self.assertIn('Вільні вікна', slots['text'])
        self.assertNotIn('Оберіть дату', slots['text'])
        slot_callback = slots['inline_markup']['inline_keyboard'][0][0]['callback_data']
        self.assertTrue(slot_callback.startswith('fsi:'), slot_callback)
        self.assertEqual(slots['reply_markup'], MAIN_REPLY_MARKUP)

        selected = self._callback(12, slot_callback)
        self.assertIn('Як звати клієнта', selected['text'])
        self.assertNotIn('Вільні вікна', selected['text'])
        self.channel.refresh_from_db()
        context = self.channel.conversation.context
        self.assertEqual(context['flow'], 'create_visit')
        self.assertEqual(context['step'], 'client')
        self.assertIn('scheduled_datetime', context['visit'])
        self.assertIsNotNone(context['visit']['work_post_id'])

        stale = self._callback(13, slot_callback)
        self.assertIn('неактуальна', stale['text'])
        self.assertNotIn('Вільні вікна на', stale['text'])

    def test_free_slot_flow_creates_one_visit_and_duplicate_update_is_ignored(self):
        WorkPost.objects.create(company=self.company, number=1, name='Пост 1', is_active=True)
        menu = self._send(20, BUTTON_FREE_SLOTS)
        slots = self._callback(21, menu['inline_markup']['inline_keyboard'][0][1]['callback_data'])
        self._callback(22, slots['inline_markup']['inline_keyboard'][0][0]['callback_data'])

        self.assertIn('Номер автомобіля', self._send(23, 'Іван Петренко')['text'])
        self.assertIn('Телефон', self._send(24, 'AA1234AA')['text'])
        self.assertIn('коментар', self._send(25, '0501234567')['text'])
        created = self._send(26, 'Без коментаря')
        duplicate = self._send(26, 'Без коментаря')

        self.assertIn('✅ Запис створено', created['text'])
        self.assertIsNone(duplicate)
        self.assertEqual(Visit.objects.filter(company=self.company).count(), 1)

    def test_wizard_creates_visit_without_pending_action(self):
        self.assertIn('Як звати клієнта', self._send(1, 'новий запис')['text'])
        self.assertIn('Номер автомобіля', self._send(2, 'Іван Петренко')['text'])
        self.assertIn('Телефон', self._send(3, 'AA5555AA')['text'])
        self.assertIn('На яку дату', self._send(4, '0505555555')['text'])
        slots = self._send(5, '2030-06-30')
        self.assertIn('Вільні вікна', slots['text'])
        callback_data = slots['inline_markup']['inline_keyboard'][0][0]['callback_data']
        self.assertTrue(callback_data.startswith('cvslot:'), callback_data)
        from .telegram_visit_actions import handle_visit_callback
        from .models import AgentConversation
        conversation = AgentConversation.objects.get(channel=self.channel)
        self.assertIn('коментар', handle_visit_callback(self.channel, conversation, callback_data)[0])
        self.assertIn('✅ Запис створено', self._send(6, 'Заміна мастила')['text'])

        self.assertFalse(AgentPendingAction.objects.filter(company=self.company).exists())
        self.assertEqual(Visit.objects.filter(company=self.company).count(), 1)
        self.channel.refresh_from_db()
        self.assertEqual(self.channel.conversation.context, {})

    def test_quick_action_menu_uses_workflow_keyboard_and_cancels(self):
        start = self._send(1, BUTTON_NEW_VISIT)
        self.assertIn('Як звати клієнта', start['text'])
        self.assertEqual(start['reply_markup'], WORKFLOW_REPLY_MARKUP)

        cancelled = self._send(2, BUTTON_CANCEL)
        self.assertIn('скасовано', cancelled['text'])
        self.assertEqual(cancelled['reply_markup'], MAIN_REPLY_MARKUP)

    def test_search_button_collects_query_then_restores_main_menu(self):
        Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Іван Петренко',
            phone='0501234567',
            scheduled_datetime=timezone.now(),
        )

        start = self._send(1, BUTTON_SEARCH)
        self.assertIn('Що знайти', start['text'])
        self.assertEqual(start['reply_markup'], WORKFLOW_REPLY_MARKUP)

        found = self._send(2, 'AA1234AA')
        self.assertIn('Іван Петренко', found['text'])
        self.assertEqual(found['reply_markup'], MAIN_REPLY_MARKUP)
        self.channel.refresh_from_db()
        self.assertEqual(self.channel.conversation.context, {})
