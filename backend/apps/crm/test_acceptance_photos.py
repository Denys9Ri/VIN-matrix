from io import BytesIO

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, Visit
from .models import VisitAcceptancePhoto


User = get_user_model()


def jpeg_file(name='car.jpg'):
    stream = BytesIO()
    Image.new('RGB', (40, 30), (230, 230, 230)).save(stream, format='JPEG')
    return SimpleUploadedFile(name, stream.getvalue(), content_type='image/jpeg')


class VisitAcceptancePhotoTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='photo-owner', password='Strong-password-123')
        self.company = Company.objects.create(name='Photo STO', owner=self.owner)
        self.visit = Visit.objects.create(
            company=self.company,
            client='Олександр',
            phone='0501112233',
            plate='AA1234AA',
            status='SELECTION',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.created_photos = []

    def tearDown(self):
        for photo in self.created_photos:
            try:
                photo.image.delete(save=False)
            except Exception:
                pass

    def upload_photo(self, category='damages'):
        response = self.client.post(
            '/api/visit-acceptance-photos/',
            {'visit': self.visit.id, 'category': category, 'photo': jpeg_file()},
            format='multipart',
        )
        if response.status_code == 201:
            photo = VisitAcceptancePhoto.objects.get(pk=response.data['id'])
            self.created_photos.append(photo)
        return response

    def test_owner_can_upload_list_and_fetch_private_photo(self):
        upload = self.upload_photo('damages')
        self.assertEqual(upload.status_code, 201)
        self.assertEqual(upload.data['category_label'], 'Пошкодження кузова')
        self.assertEqual(len(upload.data['sha256']), 64)

        listing = self.client.get(f'/api/visit-acceptance-photos/?visit={self.visit.id}')
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)
        self.assertFalse(listing.data[0]['locked'])
        self.assertTrue(listing.data[0]['file_endpoint'].endswith('/file/'))

        file_response = self.client.get(listing.data[0]['file_endpoint'])
        self.assertEqual(file_response.status_code, 200)
        self.assertEqual(file_response['Content-Type'], 'image/jpeg')
        self.assertEqual(file_response['Cache-Control'], 'private, max-age=300')

    def test_other_company_cannot_fetch_photo(self):
        upload = self.upload_photo('exterior')
        self.assertEqual(upload.status_code, 201)

        other = User.objects.create_user(username='other-owner', password='Strong-password-456')
        Company.objects.create(name='Other STO', owner=other)
        other_client = APIClient()
        other_client.force_authenticate(other)

        response = other_client.get(upload.data['file_endpoint'])
        self.assertEqual(response.status_code, 404)

    def test_client_history_requires_client_permission_for_mechanic(self):
        upload = self.upload_photo('interior')
        self.assertEqual(upload.status_code, 201)

        mechanic = User.objects.create_user(username='photo-mechanic', password='Strong-password-789')
        employee = Employee.objects.create(user=mechanic, company=self.company, role='mechanic', can_view_clients=False)
        mechanic_client = APIClient()
        mechanic_client.force_authenticate(mechanic)

        denied = mechanic_client.get('/api/visit-acceptance-photos/?phone=0501112233')
        self.assertEqual(denied.status_code, 403)

        employee.can_view_clients = True
        employee.save(update_fields=['can_view_clients'])
        allowed = mechanic_client.get('/api/visit-acceptance-photos/?phone=0501112233')
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(len(allowed.data), 1)
        self.assertEqual(allowed.data[0]['visit_id'], self.visit.id)

    def test_completed_acceptance_act_locks_existing_photos_and_rejects_changes(self):
        upload = self.upload_photo('damages')
        self.assertEqual(upload.status_code, 201)
        photo_id = upload.data['id']

        act = self.client.post(
            '/api/visit-acceptance-act/',
            {
                'visit': self.visit.id,
                'client': self.visit.client,
                'phone': self.visit.phone,
                'plate': self.visit.plate,
                'status': 'completed',
            },
            format='json',
        )
        self.assertEqual(act.status_code, 200)

        listing = self.client.get(f'/api/visit-acceptance-photos/?visit={self.visit.id}')
        self.assertTrue(listing.data[0]['locked'])

        delete = self.client.delete(f'/api/visit-acceptance-photos/{photo_id}/')
        self.assertEqual(delete.status_code, 409)
        self.assertTrue(VisitAcceptancePhoto.objects.filter(pk=photo_id).exists())

        second_upload = self.upload_photo('exterior')
        self.assertEqual(second_upload.status_code, 409)

    def test_invalid_file_is_rejected(self):
        bad_file = SimpleUploadedFile('not-photo.jpg', b'not an image', content_type='image/jpeg')
        response = self.client.post(
            '/api/visit-acceptance-photos/',
            {'visit': self.visit.id, 'category': 'damages', 'photo': bad_file},
            format='multipart',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('зображенням', response.data['detail'])
