import json

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import Company, Visit


@override_settings(SECRET_KEY='test-secret-key', DEBUG=False, ALLOWED_HOSTS=['testserver'])
class ClientVehicleIdentityTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='vehicle-owner', password='pass12345')
        self.company = Company.objects.create(owner=self.owner, name='Vehicle STO', business_type='sto')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(self.owner)}')

    def create_visit(self, delivery_data, vin_code='TMBJG7NE0J0123456'):
        return Visit.objects.create(
            company=self.company,
            plate='AA1234BB',
            vin_code=vin_code,
            client='Костя Шеремет',
            phone='0506663235',
            delivery_data=delivery_data,
        )

    def test_clients_list_returns_plate_make_model_and_year(self):
        self.create_visit(json.dumps({
            'brand': 'Skoda',
            'model': 'Octavia',
            'year': 2018,
            'mileage': 148500,
        }))
        self.create_visit('{}', vin_code=None)

        response = self.client.get('/api/store-clients/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)
        car = response.data['results'][0]['cars'][0]
        self.assertEqual(car, {
            'plate': 'AA1234BB',
            'vin_code': 'TMBJG7NE0J0123456',
            'brand': 'Skoda',
            'model': 'Octavia',
            'year': '2018',
            'mileage': '148500',
        })

    def test_clients_can_be_found_by_vehicle_make_or_model(self):
        self.create_visit(json.dumps({'brand': 'Skoda', 'model': 'Octavia'}))

        make_response = self.client.get('/api/store-clients/?search=Skoda')
        model_response = self.client.get('/api/store-clients/?search=Octavia')

        self.assertEqual(make_response.status_code, 200)
        self.assertEqual(model_response.status_code, 200)
        self.assertEqual(len(make_response.data['results']), 1)
        self.assertEqual(len(model_response.data['results']), 1)
