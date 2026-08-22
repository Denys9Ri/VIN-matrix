from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Company, VehicleRecommendation, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class DiagnosticRecommendationFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='diagnostic-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.user, name='Diagnostic STO', business_type='sto')
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234BB',
            vin_code='WVWZZZ1JZXW000001',
            client='Іван Петренко',
            phone='+380501112233',
            delivery_data='{"brand":"Skoda","model":"Octavia","mileage":"100000"}',
        )
        self.client = APIClient()
        token = self.client.post('/token/', {'username': 'diagnostic-owner', 'password': 'pass12345'}, format='json')
        self.assertEqual(token.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")

    def diagnostic_payload(self, brakes_status='attention', brakes_note='Заміна колодок через 2000 км'):
        return {
            'visit': self.visit.id,
            'client': self.visit.client,
            'phone': self.visit.phone,
            'plate': self.visit.plate,
            'status': 'completed',
            'summary': 'Перевірено автомобіль.',
            'checklist': {
                'engine': {'status': 'ok', 'note': ''},
                'brakes': {'status': brakes_status, 'note': brakes_note},
                'suspension': {'status': 'not_checked', 'note': ''},
                'fluids': {'status': 'not_checked', 'note': ''},
                'tires': {'status': 'not_checked', 'note': ''},
                'lights': {'status': 'not_checked', 'note': ''},
                'battery': {'status': 'not_checked', 'note': ''},
                'computer': {'status': 'not_checked', 'note': ''},
            },
        }

    def test_attention_creates_one_recommendation_and_infers_due_mileage(self):
        response = self.client.post('/api/visit-diagnostic-checklist/', self.diagnostic_payload(), format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['recommendation_sync']['created'], 1)
        self.assertEqual(VehicleRecommendation.objects.filter(visit=self.visit).count(), 1)

        recommendation = VehicleRecommendation.objects.get(visit=self.visit)
        self.assertEqual(recommendation.title, 'Заміна колодок через 2000 км')
        self.assertEqual(recommendation.due_mileage, 102000)
        self.assertEqual(recommendation.status, VehicleRecommendation.STATUS_ACTIVE)
        self.assertEqual(response.data['checklist']['brakes']['recommendation_id'], recommendation.id)

        second_payload = self.diagnostic_payload()
        second_payload['checklist'] = response.data['checklist']
        second = self.client.post('/api/visit-diagnostic-checklist/', second_payload, format='json')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(VehicleRecommendation.objects.filter(visit=self.visit).count(), 1)
        self.assertEqual(second.data['recommendation_sync']['created'], 0)

    def test_manual_recommendation_edit_survives_next_diagnostic_save(self):
        first = self.client.post('/api/visit-diagnostic-checklist/', self.diagnostic_payload(), format='json')
        recommendation = VehicleRecommendation.objects.get(visit=self.visit)
        recommendation.title = 'Передні колодки — погодити з клієнтом'
        recommendation.description = 'Клієнт просив передзвонити перед заміною.'
        recommendation.save(update_fields=['title', 'description', 'updated_at'])

        payload = self.diagnostic_payload(brakes_note='Заміна колодок найближчим часом')
        payload['checklist'] = first.data['checklist']
        payload['checklist']['brakes']['note'] = 'Заміна колодок найближчим часом'
        response = self.client.post('/api/visit-diagnostic-checklist/', payload, format='json')
        self.assertEqual(response.status_code, 200)

        recommendation.refresh_from_db()
        self.assertEqual(recommendation.title, 'Передні колодки — погодити з клієнтом')
        self.assertEqual(recommendation.description, 'Клієнт просив передзвонити перед заміною.')

    def test_ok_status_cancels_auto_recommendation(self):
        first = self.client.post('/api/visit-diagnostic-checklist/', self.diagnostic_payload(), format='json')
        recommendation = VehicleRecommendation.objects.get(visit=self.visit)

        payload = self.diagnostic_payload(brakes_status='ok', brakes_note='Виправлено')
        payload['checklist'] = first.data['checklist']
        payload['checklist']['brakes']['status'] = 'ok'
        payload['checklist']['brakes']['note'] = 'Виправлено'
        response = self.client.post('/api/visit-diagnostic-checklist/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['recommendation_sync']['cancelled'], 1)

        recommendation.refresh_from_db()
        self.assertEqual(recommendation.status, VehicleRecommendation.STATUS_CANCELLED)

    def test_service_act_shows_recommendation_and_scheduled_followup(self):
        first = self.client.post('/api/visit-diagnostic-checklist/', self.diagnostic_payload(), format='json')
        recommendation = VehicleRecommendation.objects.get(visit=self.visit)
        followup_time = timezone.now() + timedelta(days=7)
        Visit.objects.create(
            company=self.company,
            plate=self.visit.plate,
            vin_code=self.visit.vin_code,
            client=self.visit.client,
            phone=self.visit.phone,
            scheduled_datetime=followup_time,
            comment=f'[З рекомендації] {recommendation.title}',
        )
        recommendation.status = VehicleRecommendation.STATUS_DONE
        recommendation.save(update_fields=['status', 'updated_at'])

        response = self.client.get(f'/api/documents/visits/{self.visit.id}/service_act/')
        self.assertEqual(response.status_code, 200)
        html = response.content.decode('utf-8')
        self.assertIn('Рекомендації та наступні роботи', html)
        self.assertIn('Заміна колодок через 2000 км', html)
        self.assertIn('Наступний запис на СТО', html)
        self.assertIn(timezone.localtime(followup_time).strftime('%d.%m.%Y'), html)
