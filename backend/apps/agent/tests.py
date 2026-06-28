from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, Employee, Visit

from .services import create_connection_code, get_company_settings, get_member_access
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
