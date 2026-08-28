import hashlib
import os
import re
from collections import defaultdict
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from django.core.files.uploadedfile import SimpleUploadedFile
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
from apps.core.visit_workflow_views import ensure_visit_workflow_tables, row_to_dict
from .models import VisitAcceptanceActRevision, VisitAcceptancePhoto


# One evidence format across iPhone/Android/browser combinations. HEIC/HEIF and
# every other Pillow-decodable still image are decoded here and stored as JPEG.
register_heif_opener()

MAX_PHOTO_BYTES = 12 * 1024 * 1024
MAX_PHOTOS_PER_CATEGORY = 20
MAX_PHOTOS_PER_VISIT = 60
MAX_NORMALIZED_EDGE = 4096
CLOSED_VISIT_STATUSES = {'COMPLETED', 'CANCELLED'}
PLATE_CONFUSABLES = {
    'A': 'AА', 'А': 'AА', 'B': 'BВ', 'В': 'BВ', 'C': 'CС', 'С': 'CС',
    'E': 'EЕ', 'Е': 'EЕ', 'H': 'HН', 'Н': 'HН', 'I': 'IІ', 'І': 'IІ',
    'K': 'KК', 'К': 'KК', 'M': 'MМ', 'М': 'MМ', 'O': 'OО', 'О': 'OО',
    'P': 'PР', 'Р': 'PР', 'T': 'TТ', 'Т': 'TТ', 'X': 'XХ', 'Х': 'XХ',
}


def _company(request):
    return safe_ensure_company(request.user)


def _plate_regex(value):
    """Match visually identical Ukrainian plates across Latin/Cyrillic input."""
    compact = re.sub(r'[^0-9A-ZА-ЯІЇЄ]', '', str(value or '').upper())
    if not compact:
        return ''
    tokens = []
    for char in compact:
        variants = PLATE_CONFUSABLES.get(char)
        tokens.append(f'[{variants}]' if variants else re.escape(char))
    return r'^\s*' + r'[\s-]*'.join(tokens) + r'\s*$'


def _visit_for_company(company, visit_id):
    if not company or not visit_id:
        return None
    try:
        return Visit.objects.get(pk=visit_id, company=company)
    except (Visit.DoesNotExist, TypeError, ValueError):
        return None


def _can_open_visit_photos(user, visit):
    """Client-history permission is required once a visit is closed."""
    if can_view_client_data(user):
        return True
    return str(getattr(visit, 'status', '') or '').upper() not in CLOSED_VISIT_STATUSES


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


def _photo_payload(photo, act_completed=None):
    if act_completed is None:
        act_completed = _act_completed(photo.company_id, photo.visit_id)
    visit = photo.visit
    locked = bool(photo.locked_at) or bool(act_completed)
    return {
        'id': photo.id,
        'visit_id': photo.visit_id,
        'category': photo.category,
        'category_label': photo.get_category_display(),
        'file_endpoint': f'/api/visit-acceptance-photos/{photo.id}/file/',
        'original_name': photo.original_name,
        'content_type': 'image/jpeg',
        'size_bytes': int(photo.size_bytes or 0),
        'sha256': photo.sha256,
        'created_at': photo.created_at.isoformat(),
        'created_by': _user_label(photo.created_by),
        'locked': locked,
        'locked_at': photo.locked_at.isoformat() if photo.locked_at else None,
        'visit': {
            'id': visit.id,
            'client': visit.client or '',
            'phone': visit.phone or '',
            'plate': visit.plate or '',
            'scheduled_datetime': visit.scheduled_datetime.isoformat() if visit.scheduled_datetime else None,
            'created_at': visit.created_at.isoformat() if visit.created_at else None,
        },
    }


def _image_to_jpeg_bytes(source):
    """Return a privacy-safe, browser-safe JPEG representation of an image."""
    try:
        source.seek(0)
    except Exception:
        pass

    with Image.open(source) as opened:
        try:
            opened.seek(0)
        except (EOFError, AttributeError):
            pass
        image = ImageOps.exif_transpose(opened).copy()

    if max(image.size or (0, 0)) > MAX_NORMALIZED_EDGE:
        image.thumbnail((MAX_NORMALIZED_EDGE, MAX_NORMALIZED_EDGE), Image.Resampling.LANCZOS)
    if image.mode != 'RGB':
        if 'A' in image.getbands():
            background = Image.new('RGB', image.size, 'white')
            alpha = image.getchannel('A')
            background.paste(image.convert('RGB'), mask=alpha)
            image = background
        else:
            image = image.convert('RGB')

    output = BytesIO()
    # EXIF is deliberately omitted, stripping GPS/device metadata from evidence.
    image.save(output, format='JPEG', quality=90, optimize=True)
    return output.getvalue()


def _normalize_to_jpeg(upload, original_name):
    payload = _image_to_jpeg_bytes(upload)
    if not payload:
        raise ValueError('Не вдалося обробити фото.')
    if len(payload) > MAX_PHOTO_BYTES:
        raise ValueError('Фото після обробки завелике. Спробуйте зробити фото з меншою роздільною здатністю.')

    base_name = os.path.splitext(original_name)[0][:180] or 'photo'
    processed = SimpleUploadedFile(
        f'{base_name}.jpg',
        payload,
        content_type='image/jpeg',
    )
    return processed, hashlib.sha256(payload).hexdigest()


def _prepare_upload(upload):
    if not upload:
        raise ValueError('Оберіть фото.')
    if int(getattr(upload, 'size', 0) or 0) <= 0:
        raise ValueError('Файл порожній.')
    if int(upload.size) > MAX_PHOTO_BYTES:
        raise ValueError('Фото завелике. Максимальний розмір — 12 МБ.')

    original_name = Path(str(getattr(upload, 'name', '') or 'photo')).name[:255]
    try:
        upload.seek(0)
        with Image.open(upload) as image:
            image.verify()
        upload.seek(0)
        processed, digest = _normalize_to_jpeg(upload, original_name)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        if isinstance(exc, ValueError) and str(exc):
            raise
        raise ValueError('Файл не є коректним зображенням.')
    finally:
        try:
            upload.seek(0)
        except Exception:
            pass

    return processed, 'image/jpeg', digest, original_name


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
            if not _can_open_visit_photos(request.user, visit):
                return Response({'detail': 'У вас немає доступу до історії цього візиту.'}, status=status.HTTP_403_FORBIDDEN)
            queryset = queryset.filter(visit=visit)
        else:
            if not can_view_client_data(request.user):
                return Response({'detail': 'У вас немає доступу до історії клієнта.'}, status=status.HTTP_403_FORBIDDEN)
            if not phone and not plate:
                return Response([], status=status.HTTP_200_OK)
            identity_filter = Q()
            if plate:
                identity_filter |= Q(visit__plate__iexact=plate)
            if phone:
                identity_filter |= Q(visit__phone=phone)
            queryset = queryset.filter(identity_filter)

        if category:
            valid_categories = {key for key, _ in VisitAcceptancePhoto.CATEGORY_CHOICES}
            if category not in valid_categories:
                return Response({'detail': 'Некоректна категорія фото.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(category=category)

        photos = list(queryset.order_by('-visit__created_at', 'category', 'created_at', 'id')[:250])
        completed_by_visit = {}
        for photo in photos:
            if photo.visit_id not in completed_by_visit:
                completed_by_visit[photo.visit_id] = _act_completed(company.id, photo.visit_id)
        return Response([_photo_payload(photo, completed_by_visit[photo.visit_id]) for photo in photos])

    def post(self, request):
        company = _company(request)
        visit = _visit_for_company(company, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_open_visit_photos(request.user, visit):
            return Response({'detail': 'У вас немає доступу до історії цього візиту.'}, status=status.HTTP_403_FORBIDDEN)

        category = str(request.data.get('category') or '').strip()
        valid_categories = {key for key, _ in VisitAcceptancePhoto.CATEGORY_CHOICES}
        if category not in valid_categories:
            return Response({'detail': 'Оберіть категорію фото.'}, status=status.HTTP_400_BAD_REQUEST)

        if _act_completed(company.id, visit.id):
            return Response(
                {'detail': 'Акт зафіксовано. Спочатку відкрийте коригування акта.'},
                status=status.HTTP_409_CONFLICT,
            )

        total_count = VisitAcceptancePhoto.objects.filter(company=company, visit=visit).count()
        category_count = VisitAcceptancePhoto.objects.filter(company=company, visit=visit, category=category).count()
        if total_count >= MAX_PHOTOS_PER_VISIT or category_count >= MAX_PHOTOS_PER_CATEGORY:
            return Response({'detail': 'Досягнуто ліміт фото для цього акта.'}, status=status.HTTP_400_BAD_REQUEST)

        upload = request.FILES.get('photo')
        try:
            upload, content_type, sha256, original_name = _prepare_upload(upload)
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


class VehicleConditionHistoryView(APIView):
    """Return acceptance evidence for one vehicle, grouped by visit."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = _company(request)
        if not company:
            return Response([], status=status.HTTP_200_OK)
        if not can_view_client_data(request.user):
            return Response(
                {'detail': 'У вас немає доступу до історії клієнта та авто.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        plate = str(request.query_params.get('plate') or '').strip()
        vin_code = str(request.query_params.get('vin_code') or '').strip()
        phone = str(request.query_params.get('phone') or '').strip()
        visit_ids = []
        for raw_id in str(request.query_params.get('visit_ids') or '').split(',')[:100]:
            try:
                visit_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if visit_id > 0:
                visit_ids.append(visit_id)
        visits = Visit.objects.filter(company=company)
        # Plate is the primary vehicle identity and VIN is the safe fallback.
        # Phone may only recover legacy rows that have neither vehicle identity;
        # it must never pull another numbered/VIN vehicle owned by the same client.
        if visit_ids:
            visits = visits.filter(id__in=visit_ids)
        elif plate:
            plate_pattern = _plate_regex(plate)
            visits = visits.filter(plate__iregex=plate_pattern) if plate_pattern else visits.none()
        elif vin_code:
            visits = visits.filter(vin_code__iexact=vin_code)
        elif phone:
            visits = visits.filter(phone=phone).filter(
                Q(plate__isnull=True) | Q(plate=''),
                Q(vin_code__isnull=True) | Q(vin_code=''),
            )
        else:
            return Response([], status=status.HTTP_200_OK)

        visits = list(visits.order_by('-scheduled_datetime', '-created_at', '-id')[:100])
        if not visits:
            return Response([], status=status.HTTP_200_OK)
        visit_ids = [visit.id for visit in visits]

        ensure_visit_workflow_tables()
        placeholders = ', '.join(['%s'] * len(visit_ids))
        with connection.cursor() as cursor:
            cursor.execute(
                f'SELECT * FROM core_visitacceptanceact WHERE company_id = %s AND visit_id IN ({placeholders})',
                [company.id, *visit_ids],
            )
            act_rows = [row_to_dict(cursor, row) for row in cursor.fetchall()]
        acts = {row['visit_id']: row for row in act_rows if row}

        revision_count = defaultdict(int)
        for visit_id in VisitAcceptanceActRevision.objects.filter(
            company=company,
            visit_id__in=visit_ids,
        ).values_list('visit_id', flat=True):
            revision_count[visit_id] += 1

        photos_by_visit = defaultdict(list)
        photos = VisitAcceptancePhoto.objects.filter(
            company=company,
            visit_id__in=visit_ids,
        ).select_related('visit', 'created_by').order_by('created_at', 'id')
        for photo in photos:
            act_completed = str((acts.get(photo.visit_id) or {}).get('status') or '').lower() == 'completed'
            photos_by_visit[photo.visit_id].append(_photo_payload(photo, act_completed))

        history = []
        for visit in visits:
            act = acts.get(visit.id) or {}
            visit_photos = photos_by_visit.get(visit.id, [])
            if not act and not visit_photos:
                continue
            if act:
                act = dict(act)
                act['locked'] = str(act.get('status') or '').lower() == 'completed'
                act['revision_count'] = int(revision_count.get(visit.id, 0))
            history.append({
                'visit': {
                    'id': visit.id,
                    'plate': visit.plate or '',
                    'vin_code': visit.vin_code or '',
                    'client': visit.client or '',
                    'phone': visit.phone or '',
                    'status': visit.status or '',
                    'scheduled_datetime': visit.scheduled_datetime.isoformat() if visit.scheduled_datetime else None,
                    'created_at': visit.created_at.isoformat() if visit.created_at else None,
                },
                'act': act,
                'photos': visit_photos,
                'revision_count': int(revision_count.get(visit.id, 0)),
            })
        return Response(history, status=status.HTTP_200_OK)


class VisitAcceptancePhotoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        company = _company(request)
        photo = VisitAcceptancePhoto.objects.filter(pk=pk, company=company).select_related('visit').first()
        if not photo:
            return Response({'detail': 'Фото не знайдено.'}, status=status.HTTP_404_NOT_FOUND)
        if not _can_open_visit_photos(request.user, photo.visit):
            return Response({'detail': 'Фото не знайдено.'}, status=status.HTTP_404_NOT_FOUND)
        if photo.locked_at or _act_completed(company.id, photo.visit_id):
            return Response(
                {'detail': 'Це фото вже зафіксоване як доказ і не може бути видалене.'},
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
        photo = VisitAcceptancePhoto.objects.filter(pk=pk, company=company).select_related('visit').first()
        if not photo or not photo.image or not _can_open_visit_photos(request.user, photo.visit):
            return Response({'detail': 'Фото не знайдено.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            handle = photo.image.open('rb')
        except (FileNotFoundError, OSError):
            return Response(
                {'detail': 'Файл фото недоступний у сховищі. Перевірте persistent storage.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # New evidence is always JPEG. Legacy PNG/WebP/HEIC records are converted
        # on read so old photos remain viewable on every iPhone/Android browser.
        if str(photo.content_type or '').lower() != 'image/jpeg':
            try:
                payload = _image_to_jpeg_bytes(handle)
                handle.close()
                handle = BytesIO(payload)
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
                try:
                    handle.close()
                except Exception:
                    pass
                return Response({'detail': 'Не вдалося прочитати старий файл фото.'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        response = FileResponse(
            handle,
            content_type='image/jpeg',
            as_attachment=False,
            filename=f'acceptance-photo-{photo.id}.jpg',
        )
        response['Cache-Control'] = 'private, max-age=300'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
