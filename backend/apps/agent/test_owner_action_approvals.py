from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, Visit

from .actions import create_reschedule_visit_draft
from .models import AgentPendingAction
from .services import get_company_settings, get_member_access


class AgentOwnerApprovalTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username='approval-owner', password='test-pass')
        self.worker = User.objects.create_user(username='approval-worker', password='test-pass')
        self.company = Company.objects.create(name='Approval STO', owner=self.owner)
        Employee.objects.create(
            user=self.worker,
            company=self.company,
            role='mechanic',
            can_create_visits=True,
        )
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.save()
        worker_access = get_member_access(self.company, self.worker)
        worker_access.can_update_visits = True
        worker_access.save(update_fields=['can_update_visits', 'updated_at'])
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA4321AA',
            client='Клієнт працівника',
            phone='0504321432',
            scheduled_datetime=timezone.now() + timedelta(days=1),
            responsible_mechanic=self.worker,
        )

    def test_owner_lists_and_confirms_worker_draft(self):
        new_time = timezone.now() + timedelta(days=2)
        action = create_reschedule_visit_draft(self.worker, self.visit.id, new_time)

        self.api.force_authenticate(user=self.owner)
        listed = self.api.get('/api/agent/pending-actions/')

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]['id'], action.id)
        self.assertEqual(listed.data[0]['created_by']['user_id'], self.worker.id)

        confirmed = self.api.post(
            f'/api/agent/pending-actions/{action.id}/decision/',
            {'decision': 'confirm'},
            format='json',
        )

        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(confirmed.data['status'], AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(confirmed.data['created_by'], self.worker.username)
        self.assertEqual(confirmed.data['approved_by'], self.owner.username)
        self.visit.refresh_from_db()
        self.assertEqual(self.visit.scheduled_datetime.replace(microsecond=0), new_time.replace(microsecond=0))

    def test_worker_cannot_view_owner_drafts(self):
        owner_action = create_reschedule_visit_draft(
            self.owner,
            self.visit.id,
            timezone.now() + timedelta(days=3),
        )
        worker_action = create_reschedule_visit_draft(
            self.worker,
            self.visit.id,
            timezone.now() + timedelta(days=2),
        )

        self.api.force_authenticate(user=self.worker)
        listed = self.api.get('/api/agent/pending-actions/')

        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item['id'] for item in listed.data], [worker_action.id])
        self.assertNotEqual(worker_action.id, owner_action.id)
