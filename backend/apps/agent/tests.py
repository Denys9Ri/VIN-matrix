from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, Visit

from .models import AgentAuditLog, AgentPendingAction, AgentUserChannel
from .services import create_connection_code, get_company_settings, get_member_access
from .telegram import process_update
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

    def test_wizard_creates_visit_draft_without_creating_visit(self):
        self.assertIn('Як звати клієнта', self._send(1, 'новий запис')['text'])
        self.assertIn('Номер автомобіля', self._send(2, 'Іван Петренко')['text'])
        self.assertIn('Телефон', self._send(3, 'AA5555AA')['text'])
        self.assertIn('Коли записати', self._send(4, '0505555555')['text'])
        self.assertIn('коментар', self._send(5, '2030-06-30 10:30')['text'])
        self.assertIn('Чернетку запису створено', self._send(6, 'Заміна мастила')['text'])

        action = AgentPendingAction.objects.get(company=self.company)
        self.assertEqual(action.action_type, 'create_visit')
        self.assertEqual(action.status, AgentPendingAction.STATUS_PENDING)
        self.assertEqual(action.payload['visit']['client'], 'Іван Петренко')
        self.assertEqual(action.payload['visit']['plate'], 'AA5555AA')
        self.assertEqual(Visit.objects.filter(company=self.company).count(), 0)
        self.channel.refresh_from_db()
        self.assertEqual(self.channel.conversation.context, {})
