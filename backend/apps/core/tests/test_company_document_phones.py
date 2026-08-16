from pathlib import Path

from django.contrib.auth.models import User
from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class CompanyDocumentPhoneTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='document-phone-owner', password='pass12345')
        self.company = Company.objects.create(
            owner=self.owner,
            name='Phone Test STO',
            phone='+380501111111',
            business_type='sto',
        )
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234BB',
            client='Тестовий клієнт',
            phone='+380999999999',
            status='COMPLETED',
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def test_legacy_company_phone_is_returned_as_visible_phone(self):
        response = self.client.get('/api/settings/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['company']['phones'], [{
            'number': '+380501111111',
            'show_in_documents': True,
        }])

    def test_selected_phone_numbers_are_saved_and_used_by_every_document(self):
        phones = [
            {'number': '+380501111111', 'show_in_documents': False},
            {'number': '+380672222222', 'show_in_documents': True},
            {'number': '+380933333333', 'show_in_documents': True},
        ]
        response = self.client.patch('/api/settings/', {'company[phones]': phones}, format='json')

        self.assertEqual(response.status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.phone, '+380501111111')
        self.assertEqual(self.company.phones, phones)

        for document_type in ['receipt', 'invoice', 'waybill', 'service_act', 'warranty', 'return_note']:
            with self.subTest(document_type=document_type):
                document = self.client.get(f'/api/documents/visits/{self.visit.id}/{document_type}/')
                html = document.content.decode('utf-8')
                self.assertEqual(document.status_code, 200)
                self.assertNotIn('+380501111111', html)
                self.assertIn('+380672222222 · +380933333333', html)

    def test_all_company_phone_numbers_can_be_hidden_from_documents(self):
        self.company.phones = [
            {'number': '+380501111111', 'show_in_documents': False},
            {'number': '+380672222222', 'show_in_documents': False},
        ]
        self.company.save(update_fields=['phones'])

        document = self.client.get(f'/api/documents/visits/{self.visit.id}/service_act/')
        html = document.content.decode('utf-8')

        self.assertEqual(document.status_code, 200)
        self.assertNotIn('+380501111111', html)
        self.assertNotIn('+380672222222', html)

    def test_production_repair_script_adds_and_backfills_company_phones(self):
        repair_script = (Path(settings.BASE_DIR) / 'fix_db.py').read_text(encoding='utf-8')

        self.assertIn(
            "ALTER TABLE core_company ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb;",
            repair_script,
        )
        self.assertIn("jsonb_build_object('number', BTRIM(phone), 'show_in_documents', true)", repair_script)
