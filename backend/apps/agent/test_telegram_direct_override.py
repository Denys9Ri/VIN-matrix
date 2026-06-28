from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, OrderPart, Visit

from .actions import create_add_part_draft
from .services import get_company_settings
from .telegram_write_execution import finalize_telegram_write


class TelegramWriteExecutionTests(TestCase):
    def test_telegram_runs_when_confirmation_setting_is_on(self):
        user = User.objects.create_user(username='telegram-direct-owner', password='test-pass')
        company = Company.objects.create(name='Telegram direct STO', owner=user, global_margin_percent='20')
        settings = get_company_settings(company)
        settings.is_enabled = True
        settings.require_confirmation_for_writes = True
        settings.save()
        visit = Visit.objects.create(
            company=company,
            plate='AA1234AA',
            client='Тест',
            scheduled_datetime=timezone.now() + timedelta(days=1),
        )
        action = create_add_part_draft(user, visit.id, {
            'brand': 'BOSCH',
            'article': '0986494036',
            'name': 'Колодки',
            'source': 'Постачальник',
            'buy_price': '1000.00',
        })

        result = finalize_telegram_write({'pending_action_id': action.id})

        self.assertEqual(result['text'], '✅ Запчастину додано до запису.')
        self.assertEqual(OrderPart.objects.filter(visit=visit).count(), 1)
