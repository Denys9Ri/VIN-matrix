from io import BytesIO

from PIL import Image
from pillow_heif import register_heif_opener
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import Company, Employee, Visit
from .models import VisitAcceptanceActRevision, VisitAcceptancePhoto


register_heif_opener()
User = get_user_model()


def image_file(name='car.jpg', image_format='JPEG', content_type='image/jpeg', size=(40, 30)):
    stream = BytesIO()
    Image.new('RGB', size, (220, 225, 230)).save(stream, format=image_format)
    return SimpleUploadedFile(name, stream.getvalue(), content_type=content_type)


def jpeg_file(name='car.jpg'):
    return image_file(name, 'JPEG', 'image/jpeg', (40, 30))


def png_file(name='android-photo.png'):
    return image_file(name, 'PNG', 'image/png', (52, 38))


def webp_file(name='android-photo.webp'):
    return image_file(name, 'WEBP', 'image/webp', (54, 40))


def heic_file(name='iphone-photo.HEIC'):
    return image_file(name, 'HEIF', 'image/heic', (64, 48))


def tiff_file(name='camera-container.tiff'):
    return image_file(name, 'TIFF', 'image/tiff', (56, 42))


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

    def _remember_photo(self, response):
        if response.status_code == 201:
            photo = VisitAcceptancePhoto.objects.get(pk=response.data['id'])
            self.created_photos.append(photo)
            return photo
        return None

    def upload_photo(self, category='damages', file=None):
        response = self.client.post(
            '/api/visit-acceptance-photos/',
            {'visit': self.visit.id, 'category': category, 'photo': file or jpeg_file()},
            format='multipart',
        )
        self._remember_photo(response)
        return response

    def complete_act(self, damages='Подряпина була при прийманні'):
        return self.client.post(
            '/api/visit-acceptance-act/',
            {
                'visit': self.visit.id,
                'client': self.visit.client,
                'phone': self.visit.phone,
                'plate': self.visit.plate,
                'damages': damages,
                'exterior_note': 'Скол на капоті',
                'status': 'completed',
            },
            format='json',
        )

    def test_owner_can_upload_list_and_fetch_private_photo(self):
        upload = self.upload_photo('damages')
        self.assertEqual(upload.status_code, 201)
        self.assertEqual(upload.data['category_label'], 'Пошкодження кузова')
        self.assertEqual(upload.data['content_type'], 'image/jpeg')
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

    def test_every_supported_device_format_is_stored_as_jpeg(self):
        cases = [
            (png_file(), 'android-photo.png', (52, 38)),
            (webp_file(), 'android-photo.webp', (54, 40)),
            (heic_file(), 'iphone-photo.HEIC', (64, 48)),
            (tiff_file(), 'camera-container.tiff', (56, 42)),
        ]
        for index, (upload_file, original_name, expected_size) in enumerate(cases):
            response = self.upload_photo('exterior', upload_file)
            photo = VisitAcceptancePhoto.objects.get(pk=response.data['id'])
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data['original_name'], original_name)
            self.assertEqual(response.data['content_type'], 'image/jpeg')
            self.assertTrue(photo.image.name.lower().endswith('.jpg'))
            file_response = self.client.get(response.data['file_endpoint'])
            self.assertEqual(file_response.status_code, 200)
            self.assertEqual(file_response['Content-Type'], 'image/jpeg')
            with photo.image.open('rb') as stored:
                normalized = Image.open(stored)
                self.assertEqual(normalized.format, 'JPEG')
                self.assertEqual(normalized.size, expected_size)
            if photo not in self.created_photos:
                self.created_photos.append(photo)
            self.assertEqual(index + 1, VisitAcceptancePhoto.objects.filter(visit=self.visit).count())

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
        denied_history = mechanic_client.get('/api/visit-acceptance-photos/vehicle-history/?plate=AA1234AA')
        self.assertEqual(denied_history.status_code, 403)
        self.assertEqual(mechanic_client.get(upload.data['file_endpoint']).status_code, 200)

        self.visit.status = 'COMPLETED'
        self.visit.save(update_fields=['status', 'updated_at'])
        self.assertEqual(mechanic_client.get(upload.data['file_endpoint']).status_code, 404)
        self.assertEqual(mechanic_client.get(f'/api/visit-acceptance-photos/?visit={self.visit.id}').status_code, 403)

        employee.can_view_clients = True
        employee.save(update_fields=['can_view_clients'])
        allowed = mechanic_client.get('/api/visit-acceptance-photos/?phone=0501112233')
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(len(allowed.data), 1)
        self.assertEqual(allowed.data[0]['visit_id'], self.visit.id)
        self.assertEqual(mechanic_client.get(upload.data['file_endpoint']).status_code, 200)

    def test_completed_act_is_immutable_until_owner_opens_audited_correction(self):
        upload = self.upload_photo('damages')
        self.assertEqual(upload.status_code, 201)
        photo_id = upload.data['id']
        act = self.complete_act()
        self.assertEqual(act.status_code, 200)
        self.assertEqual(act.data['status'], 'completed')
        self.assertTrue(act.data['locked'])
        self.assertTrue(act.data['can_correct'])

        photo = VisitAcceptancePhoto.objects.get(pk=photo_id)
        self.assertIsNotNone(photo.locked_at)
        self.assertEqual(photo.locked_by_id, self.owner.id)

        delete = self.client.delete(f'/api/visit-acceptance-photos/{photo_id}/')
        self.assertEqual(delete.status_code, 409)
        self.assertEqual(self.upload_photo('exterior').status_code, 409)

        tamper = self.client.post(
            '/api/visit-acceptance-act/',
            {'visit': self.visit.id, 'damages': 'Пошкоджень не було', 'status': 'draft'},
            format='json',
        )
        self.assertEqual(tamper.status_code, 200)
        self.assertEqual(tamper.data['status'], 'completed')
        self.assertEqual(tamper.data['damages'], 'Подряпина була при прийманні')

        reopen = self.client.post(
            '/api/visit-acceptance-act/reopen/',
            {'visit': self.visit.id, 'reason': 'Не внесли скол на дверях'},
            format='json',
        )
        self.assertEqual(reopen.status_code, 200)
        self.assertEqual(reopen.data['status'], 'draft')
        self.assertEqual(reopen.data['revision_count'], 1)
        revision = VisitAcceptanceActRevision.objects.get(visit=self.visit)
        self.assertEqual(revision.reason, 'Не внесли скол на дверях')
        self.assertEqual(revision.snapshot['damages'], 'Подряпина була при прийманні')
        self.assertEqual(revision.snapshot['photos'][0]['id'], photo_id)

        # Old evidence remains locked, but a new photo can be appended to the correction.
        self.assertEqual(self.client.delete(f'/api/visit-acceptance-photos/{photo_id}/').status_code, 409)
        new_upload = self.upload_photo('exterior', png_file('correction.png'))
        self.assertEqual(new_upload.status_code, 201)
        new_photo = VisitAcceptancePhoto.objects.get(pk=new_upload.data['id'])
        self.assertIsNone(new_photo.locked_at)

        corrected = self.client.post(
            '/api/visit-acceptance-act/',
            {
                'visit': self.visit.id,
                'client': self.visit.client,
                'phone': self.visit.phone,
                'plate': self.visit.plate,
                'damages': 'Подряпина та скол на дверях',
                'status': 'completed',
            },
            format='json',
        )
        self.assertEqual(corrected.status_code, 200)
        new_photo.refresh_from_db()
        self.assertIsNotNone(new_photo.locked_at)

    def test_mechanic_cannot_reopen_completed_evidence(self):
        self.complete_act()
        mechanic = User.objects.create_user(username='evidence-mechanic', password='Strong-password-321')
        Employee.objects.create(user=mechanic, company=self.company, role='mechanic', can_view_clients=True)
        mechanic_client = APIClient()
        mechanic_client.force_authenticate(mechanic)
        response = mechanic_client.post(
            '/api/visit-acceptance-act/reopen/',
            {'visit': self.visit.id, 'reason': 'Хочу змінити'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_vehicle_history_is_plate_scoped_and_contains_damage_text_and_photos(self):
        upload = self.upload_photo('damages')
        self.assertEqual(upload.status_code, 201)
        self.complete_act('Подряпина на правих дверях')

        other_visit = Visit.objects.create(
            company=self.company,
            client='Олександр',
            phone='0501112233',
            plate='BB5678BB',
            status='SELECTION',
        )
        other_upload = self.client.post(
            '/api/visit-acceptance-photos/',
            {'visit': other_visit.id, 'category': 'damages', 'photo': jpeg_file('other.jpg')},
            format='multipart',
        )
        other_photo = self._remember_photo(other_upload)
        self.assertIsNotNone(other_photo)

        response = self.client.get('/api/visit-acceptance-photos/vehicle-history/?plate=AA1234AA')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['visit']['id'], self.visit.id)
        self.assertEqual(response.data[0]['act']['damages'], 'Подряпина на правих дверях')
        self.assertEqual(len(response.data[0]['photos']), 1)
        self.assertEqual(response.data[0]['photos'][0]['id'], upload.data['id'])

    def test_invalid_file_is_rejected(self):
        bad_file = SimpleUploadedFile('not-photo.jpg', b'not an image', content_type='image/jpeg')
        response = self.client.post(
            '/api/visit-acceptance-photos/',
            {'visit': self.visit.id, 'category': 'damages', 'photo': bad_file},
            format='multipart',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('зображенням', response.data['detail'])
