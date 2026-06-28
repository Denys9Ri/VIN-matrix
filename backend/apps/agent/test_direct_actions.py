from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, OrderPart, Visit

from .actions import create_add_part_draft, create_visit_draft
from .direct_actions import execute_or_queue_action
from .models import AgentPendingAction
from .services import get_company_settings
from .telegram_write_execution import finalize_telegram_write


class DirectAgentActionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='direct-owner', password='test-pass')
        self.company = Company.objects.create(name='Direct action STO', owner=self.owner, global_margin_percent='20')
        self.settings = get_company_settings(self.company)
        self.settings.is_enabled = True
        self.settings.require_confirmation_for_writes = False
        self.settings.save()
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Тестовий клієнт',
            phone='0501234567',
            scheduled_datetime=timezone.now() + timedelta(days=1),
        )
        self.offer = {
            'brand': 'BOSCH',
            'article': '0986494036',
            'name': 'Гальмівні колодки',
            'source': 'Тестовий постачальник',
            'buy_price': '1000.00',
        }

    def test_direct_mode_executes_pending_action_once(self):
        action = create_add_part_draft(self.owner, self.visit.id, self.offer, quantity=2)

        outcome = execute_or_queue_action(self.owner, action)

        self.assertFalse(outcome['requires_confirmation'])
        self.assertEqual(outcome['execution']['status'], AgentPendingAction.STATUS_EXECUTED)
        action.refresh_from_db()
        self.assertEqual(action.status, AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)

    def test_control_mode_keeps_action_pending(self):
        self.settings.require_confirmation_for_writes = True
        self.settings.save(update_fields=['require_confirmation_for_writes', 'updated_at'])
        action = create_visit_draft(
            self.owner,
            client='Іван Петренко',
            plate='AA7777AA',
            phone='0507777777',
            scheduled_datetime=timezone.now() + timedelta(days=2),
        )

        outcome = execute_or_queue_action(self.owner, action)

        self.assertTrue(outcome['requires_confirmation'])
        action.refresh_from_db()
        self.assertEqual(action.status, AgentPendingAction.STATUS_PENDING)
        self.assertFalse(Visit.objects.filter(company=self.company, plate='AA7777AA').exists())

    def test_telegram_result_is_replaced_with_success_after_direct_execution(self):
        action = create_add_part_draft(self.owner, self.visit.id, self.offer, quantity=1)

        result = finalize_telegram_write({
            'chat_id': '123',
            'text': 'Чернетку додавання створено.',
            'pending_action_id': action.id,
        })

        self.assertEqual(result['text'], '✅ Запчастину додано до запису.')
        self.assertNotIn('pending_action_id', result)
        self.assertEqual(result['executed_action_id'], action.id)
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)
