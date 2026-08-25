import hashlib
import os
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from django.db import connection
from django.db.models import Q
from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access_control import can_view_client_data
from apps.core.models import Visit
from apps.core.safe_crm_views import safe_ensure_company
from apps.core.visit_workflow_views import ensure_visit_workflow_tables
from .models import VisitAcceptancePhoto


MAX_PHOTO_BYTES = 12 * 1024 * 1024
MAX_PHOTOS_PER_CATEGORY = 20
MAX_PHOTOS_PER_VISIT = 60
ALLOWED_FORMATS = {
    'JPEG': ('image/jpeg', '.jpg'),
    'PNG': ('image/png', '.png'),
    'WEBP': ('image/webp', '.webp'),
}


def _company(request):
    return safe_ensure_company(request.user)


def _visit_for_company(company, visit_id):
    if not company or not visit_id:
        return None
    try:
        return Visit.objects.get(pk=visit_id, company=company)
    except (Visit.DoesNotExist, TypeError, ValueError):
        return None


def _act_completed(company_id, visit_id):
    ensure_visit_workflow_tables()
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT status FROM core_visitacceptanceact WHERE company_id = %s AND visit_id = %s LIMIT 1',
            [company_id, visit_id],
        )
        row = cursor.fetchone()
    return bool(row and str(row[0] or '').lower() == 'completed')


def _user_label(user):
    if not user:
        return ''
    return user.first_name or user.get_full_name() or user.username


def _photo_payload(photo, locked=None):
    if locked is None:
        locked = _act_completed(photo.company_id, photo.visit_id)
    visit = photo.visit
    return {
        'id': photo.id,
        'visit_id': photo.visit_id,
        'category': photo.category,
        'category_label': photo.get_category_display(),
        'file_endpoint': f'/api/visit-acceptance-photos/{photo.id}/file/',
        'original_name': photo.original_name,
        'content_type': photo.content_type,
        'size_bytes': int(photo.size_bytes or 0),
        'sha256': photo.sha256,
        'created_at': photo.created_at.isoformat(),
        'created_by': _user_label(photo.created_by),
        'locked': bool(locked),
        'visit': {
            'id': visit.id,
            'client': visit.client or '',
            'phone': visit.phone or '',
            'plate': visit.plate or '',
            'scheduled_datetime': visit.scheduled_datetime.isoformat() if visit.scheduled_datetime else None,
            'created_at': visit.created_at.isoformat() if visit.created_at else None,
        },
    }


def _validate_upload(upload):
    if not upload:
        raise ValueError('Оберіть фото.')
    if int(getattr(upload, 'size', 0) or 0) <= 0:
        raise ValueError('Файл порожній.')
    if int(upload.size) > MAX_PHOTO_BYTES:
        raise ValueError('Фото завелике. Максимальний розмір — 12 МБ.')

    try:
        upload.seek(0)
        image = Image.open(upload)
        image.verify()
        image_format = str(image.format or '').upper()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValueError('Файл не є коректним зображенням.')
    finally:
        try:
            upload.seek(0)
        except Exception:
            pass

    if image_format not in ALLOWED_FORMATS:
        raise ValueError('Підтримуються фото JPEG, PNG або WebP.')

    expected_content_type, extension = ALLOWED_FORMATS[image_format]
    digest = hashlib.sha256()
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)

    original_name = Path(str(getattr(upload, 'name', '') or 'photo')).name[:255]
    base_name = os.path.splitext(original_name)[0][:180] or 'photo'
    upload.name = f'{base_name}{extension}'
    return expected_content_type, digest.hexdigest(), original_name


class VisitAcceptancePhotoListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        company = _company(request)
        if not company:
            return Response([], status=status.HTTP_200_OK)

        visit_id = request.query_params.get('visit')
        category = str(request.query_params.get('category') or '').strip()
        phone = str(request.query_params.get('phone') or '').strip()
        plate = str(request.query_params.get('plate') or '').strip()

        queryset = VisitAcceptancePhoto.objects.filter(company=company).select_related('visit', 'created_by')

        if visit_id:
            visit = _visit_for_company(company, visit_id)
            if not visit:
                return Response([], status=status.HTTP_200_OK)
            queryset = queryset.filter(visit=visit)
            locked_by_visit = {visit.id: _act_completed(company.id, visit.id)}
        else:
            if not can_view_client_data(request.user):
                return Response({'detail': 'У вас немає доступу до історії клієнта.'}, status=status.HTTP_403_FORBIDDEN)
            if not phone and not plate:
                return Response([], status=status.HTTP_200_OK)
            identity_filter = Q()
            if phone:
                identity_filter |= Q(visit__phone=phone)
            if plate:
                identity_filter |= Q(visit__plate__iexact=plate)
            queryset = queryset.filter(identity_filter)
            locked_by_visit = {}

        if category:
            valid_categories = {key for key, _ in VisitAcceptancePhoto.CATEGORY_CHOICES}
            if category not in valid_categories:
                return Response({'detail': 'Некоректна категорія фото.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(category=category)

        photos = list(queryset.order_by('-visit__created_at', 'category', 'created_at', 'id')[:250])
        for photo in photos:
            if photo.visit_id not in locked_by_visit:
                locked_by_visit[photo.visit_id] = _act_completed(company.id, photo.visit_id)
        return Response([_photo_payload(photo, locked_by_visit[photo.visit_id]) for photo in photos])

    def post(self, request):
        company = _company(request)
        visit = _visit_for_company(company, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        category = str(request.data.get('category') or '').strip()
        valid_categories = {key for key, _ in VisitAcceptancePhoto.CATEGORY_CHOICES}
        if category not in valid_categories:
            return Response({'detail': 'Оберіть категорію фото.'}, status=status.HTTP_400_BAD_REQUEST)

        if _act_completed(company.id, visit.id):
            return Response(
                {'detail': 'Акт уже завершений. Фото зафіксовані та заблоковані від змін.'},
                status=status.HTTP_409_CONFLICT,
            )

        total_count = VisitAcceptancePhoto.objects.filter(company=company, visit=visit).count()
        category_count = VisitAcceptancePhoto.objects.filter(company=company, visit=visit, category=category).count()
        if total_count >= MAX_PHOTOS_PER_VISIT or category_count >= MAX_PHOTOS_PER_CATEGORY:
            return Response(
                {'detail': 'Досягнуто ліміт фото для цього акта.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload = request.FILES.get('photo')
        try:
            content_type, sha256, original_name = _validate_upload(upload)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        photo = VisitAcceptancePhoto.objects.create(
            company=company,
            visit=visit,
            category=category,
            image=upload,
            original_name=original_name,
            content_type=content_type,
            size_bytes=int(upload.size or 0),
            sha256=sha256,
            created_by=request.user,
        )
        photo = VisitAcceptancePhoto.objects.select_related('visit', 'created_by').get(pk=photo.pk)
        return Response(_photo_payload(photo, False), status=status.HTTP_201_CREATED)


class VisitAcceptancePhotoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        company = _company(request)
        photo = VisitAcceptancePhoto.objects.filter(pk=pk, company=company).first()
        if not photo:
            return Response({'detail': 'Фото не знайдено.'}, status=status.HTTP_404_NOT_FOUND)
        if _act_completed(company.id, photo.visit_id):
            return Response(
                {'detail': 'Акт уже завершений. Зафіксовані фото не можна видаляти.'},
                status=status.HTTP_409_CONFLICT,
            )

        image = photo.image
        photo.delete()
        try:
            image.delete(save=False)
        except Exception:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class VisitAcceptancePhotoFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        company = _company(request)
        photo = VisitAcceptancePhoto.objects.filter(pk=pk, company=company).first()
        if not photo or not photo.image:
            return Response({'detail': 'Фото не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            handle = photo.image.open('rb')
        except (FileNotFoundError, OSError):
            return Response({'detail': 'Файл фото недоступний.'}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(
            handle,
            content_type=photo.content_type or 'application/octet-stream',
            as_attachment=False,
            filename=photo.original_name or f'acceptance-photo-{photo.id}.jpg',
        )
        response['Cache-Control'] = 'private, max-age=300'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
