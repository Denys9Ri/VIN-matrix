from datetime import datetime, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.models import Company, Employee, Visit, WorkPost
from .models import AgentCompanySettings, AgentMemberAccess, AgentPendingAction, AgentUserChannel
from .telegram import process_update
from .visit_slots import create_visit_now, find_available_slots, validate_slot_available


class TelegramVisitSlotsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user('owner')
        self.worker = User.objects.create_user('worker')
        self.other = User.objects.create_user('other')
        self.company = Company.objects.create(name='STO', owner=self.owner)
        self.settings = AgentCompanySettings.objects.create(company=self.company, is_enabled=True, telegram_enabled=True, default_visit_duration_minutes=60)
        Employee.objects.create(company=self.company, user=self.worker, role='mechanic', can_create_visits=True)
        Employee.objects.create(company=self.company, user=self.other, role='mechanic', can_create_visits=True)
        self.post = WorkPost.objects.create(company=self.company, name='Post 1', number=1)
        self.post2 = WorkPost.objects.create(company=self.company, name='Post 2', number=2)
        AgentMemberAccess.objects.create(company=self.company, user=self.owner, is_enabled=True, can_view_all_visits=True, can_view_client_phone=True, can_create_visits=True)
        AgentMemberAccess.objects.create(company=self.company, user=self.worker, is_enabled=True, can_view_all_visits=False, can_view_client_phone=False, can_create_visits=True)
        self.start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=1), datetime.min.time()).replace(hour=10))

    def test_get_available_slots(self):
        result = find_available_slots(self.owner, self.start.date(), limit=8)
        self.assertTrue(result['slots'])
        self.assertLessEqual(len(result['slots']), 8)
        self.assertIn('available_posts', result['slots'][0])

    def test_busy_post(self):
        Visit.objects.create(company=self.company, client='A', plate='AA', phone='', scheduled_datetime=self.start, work_post=self.post)
        with self.assertRaises(ValidationError):
            validate_slot_available(self.company, self.start, 60, work_post_id=self.post.id)

    def test_busy_mechanic(self):
        Visit.objects.create(company=self.company, client='A', plate='AA', phone='', scheduled_datetime=self.start, responsible_mechanic=self.worker)
        with self.assertRaises(ValidationError):
            validate_slot_available(self.company, self.start, 60, mechanic_id=self.worker.id)

    def test_time_overlap(self):
        Visit.objects.create(company=self.company, client='A', plate='AA', phone='', scheduled_datetime=self.start)
        with self.assertRaises(ValidationError):
            validate_slot_available(self.company, self.start + timedelta(minutes=30), 60)

    def test_create_visit_without_pending_action(self):
        visit = create_visit_now(self.owner, client='Ivan', plate='AA', phone='1', scheduled_datetime=self.start, work_post_id=self.post.id, mechanic_id=self.worker.id)
        self.assertTrue(Visit.objects.filter(id=visit.id).exists())
        self.assertFalse(AgentPendingAction.objects.exists())

    def test_slot_taken_between_show_and_create(self):
        find_available_slots(self.owner, self.start.date(), limit=3)
        Visit.objects.create(company=self.company, client='A', plate='AA', phone='', scheduled_datetime=self.start, work_post=self.post)
        with self.assertRaises(ValidationError):
            create_visit_now(self.owner, client='Ivan', plate='AA', phone='', scheduled_datetime=self.start, work_post_id=self.post.id)

    def test_worker_sees_only_own_assignable_slots(self):
        result = find_available_slots(self.worker, self.start.date(), limit=3)
        self.assertTrue(result['slots'])
        self.assertTrue(all(slot['mechanic_id'] == self.worker.id for slot in result['slots']))

    def test_repeated_telegram_update_does_not_duplicate_visit(self):
        channel = AgentUserChannel.objects.create(company=self.company, user=self.owner, channel_type='telegram', external_user_id='42', chat_id='42')
        payload = {'update_id': 1, 'message': {'message_id': 99, 'from': {'id': 42}, 'chat': {'id': 42}, 'text': 'вільні вікна завтра'}}
        with patch('apps.agent.telegram.send_message'):
            first = process_update(payload)
            second = process_update(payload)
        self.assertIsNotNone(first)
        self.assertIsNone(second)
