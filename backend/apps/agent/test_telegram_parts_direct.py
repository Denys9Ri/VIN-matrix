from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, OrderPart, Visit

from .actions import create_add_part_draft
from .models import AgentPendingAction, AgentUserChannel
from .services import get_company_settings
from .telegram_parts_direct import _run_write


class TelegramPartsDirectTests(TestCase):
    def test_part_is_executed_without_confirmation(self):
        user = User.objects.create_user(username='direct-parts-user', password='test-pass')
        company = Company.objects.create(name='Direct parts STO', owner=user, global_margin_percent='20')
        settings = get_company_settings(company)
        settings.is_enabled = True
        settings.require_confirmation_for_writes = True
        settings.save()
        visit = Visit.objects.create(
            company=company,
            plate='AA1234AA',
            client='Тестовий клієнт',
            scheduled_datetime=timezone.now() + timedelta(days=1),
        )
        channel = AgentUserChannel.objects.create(
            company=company,
            user=user,
            channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
            external_user_id='direct-parts-telegram',
            chat_id='direct-parts-chat',
        )
        action = create_add_part_draft(user, visit.id, {
            'brand': 'BOSCH',
            'article': '0986494036',
            'name': 'Гальмівні колодки',
            'source': 'Тестовий постачальник',
            'buy_price': '1000.00',
        })

        reply, intent, result = _run_write(
            channel,
            ('Чернетку додавання створено.', 'part_add_draft_created', {'pending_action_id': action.id}),
        )

        self.assertEqual(reply, '✅ Запчастину додано до запису.')
        self.assertEqual(intent, 'telegram_write_executed')
        self.assertNotIn('pending_action_id', result)
        action.refresh_from_db()
        self.assertEqual(action.status, AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(OrderPart.objects.filter(visit=visit).count(), 1)
