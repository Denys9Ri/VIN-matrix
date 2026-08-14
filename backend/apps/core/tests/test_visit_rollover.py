from datetime import date, datetime, time
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, CompanyOption, Visit


TODAY = date(2026, 4, 14)


def scheduled(year, month, day, hour=13, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute))


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class VisitRolloverTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='sto-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Test STO', business_type='sto')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def create_visit(self, *, status, when, plate):
        return Visit.objects.create(
            company=self.company,
            plate=plate,
            client='Client',
            phone='+380501112233',
            status=status,
            scheduled_datetime=when,
        )

    @patch('apps.core.safe_crm_views.timezone.localdate', return_value=TODAY)
    @patch('apps.core.visit_rollover.log_activity')
    def test_today_board_carries_over_only_unfinished_in_progress_visits(self, _log, _localdate):
        carried = self.create_visit(
            status='ORDERED',
            when=scheduled(2026, 4, 13, 13, 30),
            plate='AA0001AA',
        )
        legacy_carried = self.create_visit(
            status='IN_PROGRESS',
            when=scheduled(2026, 4, 12, 9, 15),
            plate='AA0002AA',
        )
        ready = self.create_visit(
            status='DONE',
            when=scheduled(2026, 4, 13, 15, 0),
            plate='AA0003AA',
        )
        future = self.create_visit(
            status='ORDERED',
            when=scheduled(2026, 4, 15, 11, 0),
            plate='AA0004AA',
        )

        response = self.client.get(f'/api/visits/?date={TODAY.isoformat()}')

        self.assertEqual(response.status_code, 200)
        response_ids = {item['id'] for item in response.data}
        self.assertEqual(response_ids, {carried.id, legacy_carried.id})

        second_response = self.client.get(f'/api/visits/?date={TODAY.isoformat()}')
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(_log.call_count, 2)

        carried.refresh_from_db()
        legacy_carried.refresh_from_db()
        ready.refresh_from_db()
        future.refresh_from_db()
        self.assertEqual(timezone.localtime(carried.scheduled_datetime).date(), TODAY)
        self.assertEqual(timezone.localtime(carried.scheduled_datetime).time(), time(13, 30))
        self.assertEqual(timezone.localtime(legacy_carried.scheduled_datetime).date(), TODAY)
        self.assertEqual(timezone.localtime(ready.scheduled_datetime).date(), date(2026, 4, 13))
        self.assertEqual(timezone.localtime(future.scheduled_datetime).date(), date(2026, 4, 15))

    @patch('apps.core.safe_crm_views.timezone.localdate', return_value=TODAY)
    @patch('apps.core.visit_rollover.log_activity')
    def test_custom_in_progress_status_and_unscheduled_visit_are_carried(self, _log, _localdate):
        CompanyOption.objects.create(
            company=self.company,
            mode=CompanyOption.MODE_STO,
            group=CompanyOption.GROUP_STO_VISIT_STATUS,
            key='repairing',
            label='На підйомнику',
            semantic_role='in_progress',
            is_active=True,
        )
        custom = self.create_visit(
            status='repairing',
            when=scheduled(2026, 4, 10, 8, 45),
            plate='AA0005AA',
        )
        unscheduled = self.create_visit(
            status='ORDERED',
            when=None,
            plate='AA0006AA',
        )
        Visit.objects.filter(pk=unscheduled.pk).update(created_at=scheduled(2026, 4, 11, 10, 20))

        response = self.client.get(f'/api/visits/?date={TODAY.isoformat()}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({item['id'] for item in response.data}, {custom.id, unscheduled.id})
        unscheduled.refresh_from_db()
        self.assertEqual(timezone.localtime(unscheduled.scheduled_datetime).date(), TODAY)
        self.assertEqual(timezone.localtime(unscheduled.scheduled_datetime).time(), time(10, 20))

    @patch('apps.core.safe_crm_views.timezone.localdate', return_value=TODAY)
    @patch('apps.core.visit_rollover.log_activity')
    def test_past_board_does_not_trigger_rollover(self, _log, _localdate):
        visit = self.create_visit(
            status='ORDERED',
            when=scheduled(2026, 4, 13, 14, 0),
            plate='AA0007AA',
        )

        response = self.client.get('/api/visits/?date=2026-04-13')

        self.assertEqual(response.status_code, 200)
        self.assertEqual({item['id'] for item in response.data}, {visit.id})
        visit.refresh_from_db()
        self.assertEqual(timezone.localtime(visit.scheduled_datetime).date(), date(2026, 4, 13))

    @patch('apps.core.safe_crm_views.log_activity')
    @patch('apps.core.safe_crm_views.timezone.localdate', return_value=TODAY)
    @patch('apps.core.visit_rollover.log_activity')
    def test_ready_visit_stays_today_and_is_not_carried_tomorrow(
        self,
        _rollover_log,
        localdate_mock,
        _update_log,
    ):
        visit = self.create_visit(
            status='ORDERED',
            when=scheduled(2026, 4, 13, 16, 10),
            plate='AA0008AA',
        )
        self.assertEqual(self.client.get(f'/api/visits/?date={TODAY.isoformat()}').status_code, 200)

        update_response = self.client.patch(
            f'/api/visits/{visit.id}/',
            {'status': 'DONE'},
            format='json',
        )
        self.assertEqual(update_response.status_code, 200)
        today_response = self.client.get(f'/api/visits/?date={TODAY.isoformat()}')
        self.assertEqual({item['id'] for item in today_response.data}, {visit.id})

        localdate_mock.return_value = date(2026, 4, 15)
        tomorrow_response = self.client.get('/api/visits/?date=2026-04-15')
        self.assertEqual(tomorrow_response.status_code, 200)
        self.assertEqual(tomorrow_response.data, [])
        visit.refresh_from_db()
        self.assertEqual(visit.status, 'DONE')
        self.assertEqual(timezone.localtime(visit.scheduled_datetime).date(), TODAY)

    @patch('apps.core.safe_crm_views.timezone.localdate', return_value=TODAY)
    @patch('apps.core.visit_rollover.log_activity')
    def test_rollover_is_scoped_to_sto_company(self, _log, _localdate):
        store_owner = User.objects.create_user(username='store-owner', password='pass12345')
        store = Company.objects.create(owner=store_owner, name='Test store', business_type='store')
        store_visit = Visit.objects.create(
            company=store,
            plate='BB0001BB',
            client='Store client',
            phone='+380501112244',
            status='ORDERED',
            scheduled_datetime=scheduled(2026, 4, 13, 12, 0),
        )
        store_client = APIClient()
        store_client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(store_owner)}')

        response = store_client.get(f'/api/visits/?date={TODAY.isoformat()}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])
        store_visit.refresh_from_db()
        self.assertEqual(timezone.localtime(store_visit.scheduled_datetime).date(), date(2026, 4, 13))
