from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, OrderPart, Visit

from .actions import create_add_part_draft, create_visit_draft, execute_confirmed_action
from .models import AgentPendingAction
from .services import get_company_settings


class AgentConfirmedActionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username='action-owner', password='test-pass')
        self.company = Company.objects.create(
            name='Action STO',
            owner=self.owner,
            global_margin_percent='20.00',
        )
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.save()
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Тестовий клієнт',
            phone='0501234567',
        )
        self.offer = {
            'brand': 'FEBI',
            'article': '12345',
            'name': 'Тестова деталь',
            'source': 'Постачальник',
            'buy_price': '100.00',
        }

    def test_confirmed_draft_creates_one_order_part_only_once(self):
        action = create_add_part_draft(
            self.owner,
            visit_id=self.visit.id,
            offer=self.offer,
            quantity=2,
        )
        self.assertEqual(action.status, AgentPendingAction.STATUS_PENDING)
        self.assertIn('120.00', action.summary_text)

        action.status = AgentPendingAction.STATUS_CONFIRMED
        action.save(update_fields=['status'])

        first = execute_confirmed_action(self.owner, action.id)
        second = execute_confirmed_action(self.owner, action.id)

        self.assertEqual(first['status'], AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(second['result'], 'already_executed')
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)

        part = OrderPart.objects.get(visit=self.visit)
        self.assertEqual(part.brand, 'FEBI')
        self.assertEqual(part.article, '12345')
        self.assertEqual(str(part.quantity), '2.00')
        self.assertEqual(str(part.buy_price), '100.00')
        self.assertEqual(str(part.sell_price), '120.00')

    def test_confirmed_draft_creates_visit_only_once(self):
        scheduled = timezone.now() + timedelta(days=1)
        action = create_visit_draft(
            self.owner,
            client='Іван Петренко',
            plate='AA7777AA',
            phone='0507777777',
            scheduled_datetime=scheduled,
            comment='Заміна мастила',
        )
        self.assertEqual(action.status, AgentPendingAction.STATUS_PENDING)
        self.assertIn('Іван Петренко', action.summary_text)

        action.status = AgentPendingAction.STATUS_CONFIRMED
        action.save(update_fields=['status'])

        first = execute_confirmed_action(self.owner, action.id)
        second = execute_confirmed_action(self.owner, action.id)

        self.assertEqual(first['status'], AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(second['result'], 'already_executed')
        self.assertEqual(Visit.objects.filter(company=self.company, plate='AA7777AA').count(), 1)

        created_visit = Visit.objects.get(company=self.company, plate='AA7777AA')
        self.assertEqual(created_visit.client, 'Іван Петренко')
        self.assertEqual(created_visit.phone, '0507777777')
        self.assertEqual(created_visit.comment, 'Заміна мастила')

    def test_confirmation_endpoint_executes_action(self):
        action = create_add_part_draft(
            self.owner,
            visit_id=self.visit.id,
            offer=self.offer,
            quantity=1,
        )
        self.api.force_authenticate(user=self.owner)

        response = self.api.post(
            f'/api/agent/pending-actions/{action.id}/decision/',
            {'decision': 'confirm'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)

        retry = self.api.post(
            f'/api/agent/pending-actions/{action.id}/decision/',
            {'decision': 'confirm'},
            format='json',
        )
        self.assertEqual(retry.status_code, 409)
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)
