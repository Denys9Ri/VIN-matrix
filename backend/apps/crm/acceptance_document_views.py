import base64
import hashlib
import io
import json
from html import escape

from PIL import Image, ImageOps
from django.db import connection
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access_control import CompanyOwnerOrPlatformAdmin, is_company_owner_or_platform_admin
from apps.core.activity import log_activity
from apps.core.company_phones import document_phone_text
from apps.core.models import CompanyOption
from apps.core.visit_workflow_views import ensure_visit_workflow_tables, get_visit_for_user, row_to_dict

from .models import VisitAcceptanceActRevision, VisitAcceptancePhoto


PHOTO_CATEGORY_ORDER = ['damages', 'exterior', 'interior', 'general']
PHOTO_CATEGORY_LABELS = dict(VisitAcceptancePhoto.CATEGORY_CHOICES)
TERMS_TEMPLATE_GROUP = 'document_template'
TERMS_TEMPLATE_KEY = 'acceptance_act_terms'


def _txt(value, fallback='—'):
    value = fallback if value in [None, ''] else value
    return escape(str(value))


def _nl2br(value):
    return _txt(value, '').replace('\n', '<br>')


def _read_act(company_id, visit_id):
    ensure_visit_workflow_tables()
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT * FROM core_visitacceptanceact WHERE company_id = %s AND visit_id = %s LIMIT 1',
            [company_id, visit_id],
        )
        return row_to_dict(cursor, cursor.fetchone())


def _default_terms(company):
    option = CompanyOption.objects.filter(
        company=company,
        group=TERMS_TEMPLATE_GROUP,
        key=TERMS_TEMPLATE_KEY,
        is_active=True,
    ).first()
    return str(getattr(option, 'description', '') or '').strip()


def _save_default_terms(company, terms):
    CompanyOption.objects.update_or_create(
        company=company,
        group=TERMS_TEMPLATE_GROUP,
        key=TERMS_TEMPLATE_KEY,
        defaults={
            'mode': CompanyOption.MODE_STO,
            'label': 'Умови акта приймання',
            'description': terms,
            'is_active': True,
            'is_system': True,
            'sort_order': 900,
        },
    )


def _format_datetime(value):
    if not value:
        return '—'
    try:
        if timezone.is_naive(value):
            value = timezone.make_aware(value, timezone.get_current_timezone())
        return timezone.localtime(value).strftime('%d.%m.%Y о %H:%M')
    except Exception:
        return str(value)


def _vehicle_payload(visit):
    payload = {}
    raw = getattr(visit, 'delivery_data', '') or ''
    if isinstance(raw, str) and raw.strip().startswith('{'):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payload = parsed
        except Exception:
            payload = {}
    elif isinstance(raw, dict):
        payload = raw
    return {
        'make': payload.get('brand') or payload.get('make') or '',
        'model': payload.get('model') or '',
        'year': payload.get('year') or '',
        'color': payload.get('color') or payload.get('colour') or '',
        'engine': payload.get('engine') or payload.get('engine_code') or '',
    }


def _photo_data_uri(photo):
    try:
        with photo.image.open('rb') as source:
            image = Image.open(source)
            image = ImageOps.exif_transpose(image)
            if image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
            elif image.mode == 'L':
                image = image.convert('RGB')
            image.thumbnail((1400, 1000), Image.Resampling.LANCZOS)
            stream = io.BytesIO()
            image.save(stream, format='JPEG', quality=78, optimize=True)
            encoded = base64.b64encode(stream.getvalue()).decode('ascii')
            return f'data:image/jpeg;base64,{encoded}'
    except Exception:
        return ''


def _photo_sections(company, visit):
    rows = list(
        VisitAcceptancePhoto.objects.filter(company=company, visit=visit)
        .select_related('created_by')
        .order_by('category', 'created_at', 'id')
    )
    grouped = {key: [] for key in PHOTO_CATEGORY_ORDER}
    for photo in rows:
        grouped.setdefault(photo.category, []).append(photo)

    sections = []
    for category in PHOTO_CATEGORY_ORDER:
        items = grouped.get(category) or []
        if not items:
            continue
        cards = []
        for photo in items:
            data_uri = _photo_data_uri(photo)
            if data_uri:
                visual = f"<img src='{data_uri}' alt='{_txt(PHOTO_CATEGORY_LABELS.get(category, 'Фото'))}'>"
            else:
                visual = "<div class='photo-missing'>Файл фото недоступний</div>"
            created_by = ''
            if photo.created_by_id:
                created_by = photo.created_by.get_full_name() or photo.created_by.username
            cards.append(
                "<figure class='photo-card'>"
                f"{visual}"
                "<figcaption>"
                f"{_txt(_format_datetime(photo.created_at))}"
                + (f" · {_txt(created_by)}" if created_by else '')
                + "</figcaption></figure>"
            )
        sections.append(
            "<section class='photo-section'>"
            f"<div class='section-title'>{_txt(PHOTO_CATEGORY_LABELS.get(category, 'Фото'))}</div>"
            f"<div class='photo-grid'>{''.join(cards)}</div>"
            "</section>"
        )
    return ''.join(sections), rows


def _evidence_code(company_id, visit_id, act, photos):
    stable = {
        'company_id': company_id,
        'visit_id': visit_id,
        'act': {
            key: act.get(key)
            for key in [
                'client', 'phone', 'plate', 'mileage', 'fuel_level', 'exterior_note',
                'interior_note', 'damages', 'customer_complaint', 'note', 'terms_text', 'status',
            ]
        },
        'photos': [photo.sha256 for photo in photos],
    }
    raw = json.dumps(stable, ensure_ascii=False, sort_keys=True, default=str).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()[:16].upper()


def _info_block(label, value):
    return f"<div class='info'><span>{_txt(label)}</span><b>{_txt(value)}</b></div>"


def _text_section(title, value):
    if not str(value or '').strip():
        return ''
    return f"<section class='text-section'><div class='section-title'>{_txt(title)}</div><div class='text-box'>{_nl2br(value)}</div></section>"


def build_acceptance_document_html(request, company, visit, act, auto_print=False):
    vehicle = _vehicle_payload(visit)
    photo_html, photos = _photo_sections(company, visit)
    revision_count = VisitAcceptanceActRevision.objects.filter(company=company, visit=visit).count()
    completed = str(act.get('status') or '').lower() == 'completed'
    terms = str(act.get('terms_text') or '').strip()
    # A draft may inherit the current template. A completed act never does:
    # its stored text is the immutable historical snapshot.
    if not completed and not terms:
        terms = _default_terms(company)

    logo = ''
    try:
        if company.logo:
            logo = request.build_absolute_uri(company.logo.url)
    except Exception:
        logo = ''

    car_name = ' '.join(str(v).strip() for v in [vehicle['make'], vehicle['model']] if str(v or '').strip())
    acceptance_time = act.get('updated_at') if completed else act.get('created_at')
    code = _evidence_code(company.id, visit.id, act, photos)
    company_phones = document_phone_text(company)
    representative = str(getattr(company, 'document_signature', '') or '').strip() or 'Представник СТО'
    status_label = 'ЗАФІКСОВАНО' if completed else 'ЧЕРНЕТКА'
    status_class = 'fixed' if completed else 'draft'

    details = ''.join([
        _info_block('Держномер', act.get('plate') or visit.plate),
        _info_block('Марка / модель', car_name or '—'),
        _info_block('VIN', visit.vin_code or '—'),
        _info_block('Рік', vehicle['year'] or '—'),
        _info_block('Пробіг', f"{int(act.get('mileage')):,} км".replace(',', ' ') if act.get('mileage') not in [None, ''] else '—'),
        _info_block('Паливо', act.get('fuel_level') or '—'),
    ])

    terms_html = ''
    if terms:
        terms_html = (
            "<section class='terms'><div class='section-title'>Додаткові умови / примітка СТО</div>"
            f"<div>{_nl2br(terms)}</div></section>"
        )

    photo_notice = "<p class='photo-note'>Фотофіксація є частиною цього акта та прив’язана до візиту в VIN Matrix.</p>" if photos else ''
    auto_script = "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script>" if auto_print else ''
    toolbar = '' if auto_print else "<div class='toolbar'><button onclick='window.print()'>Друк / зберегти PDF</button></div>"

    return f"""<!doctype html>
<html lang='uk'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Акт приймання авто №{visit.id}</title>
<style>
@page{{size:A4;margin:10mm}}*{{box-sizing:border-box}}body{{margin:0;background:#e8eef6;color:#0f172a;font-family:Arial,sans-serif}}.toolbar{{position:sticky;top:0;z-index:20;background:#0f172a;padding:10px 16px;text-align:right}}.toolbar button{{border:0;border-radius:12px;background:#2563eb;color:white;padding:11px 16px;font-weight:900;cursor:pointer}}.sheet{{width:210mm;min-height:297mm;margin:0 auto;background:white;padding:13mm 14mm}}.top{{display:flex;justify-content:space-between;gap:18px;padding-bottom:14px;border-bottom:3px solid #0f172a}}.brand{{display:flex;align-items:center;gap:12px;min-width:0}}.logo{{width:62px;height:62px;border:1px solid #e2e8f0;border-radius:16px;object-fit:contain;padding:5px}}.company h1{{font-size:21px;margin:0 0 5px;font-weight:900}}.company p{{font-size:10px;color:#64748b;margin:2px 0}}.doc-head{{text-align:right;min-width:210px}}.doc-head h2{{font-size:18px;margin:0;font-weight:900;text-transform:uppercase}}.doc-head .number{{font-size:12px;font-weight:800;margin-top:5px}}.badge{{display:inline-block;margin-top:8px;border-radius:999px;padding:5px 9px;font-size:9px;font-weight:900;letter-spacing:.08em}}.badge.fixed{{background:#dcfce7;color:#166534}}.badge.draft{{background:#fef3c7;color:#92400e}}.meta{{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}}.info{{border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;min-height:52px}}.info span{{display:block;color:#64748b;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}}.info b{{font-size:11px;line-height:1.35}}.client{{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:10px}}.section-title{{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#334155;margin-bottom:6px}}.text-section,.photo-section,.terms{{break-inside:avoid;page-break-inside:avoid;margin:10px 0}}.text-box,.terms{{border:1px solid #dbe4ef;border-radius:12px;padding:10px 12px;font-size:10px;line-height:1.55;background:#f8fafc}}.terms{{border-color:#bfdbfe;background:#eff6ff}}.photo-grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}}.photo-card{{margin:0;border:1px solid #e2e8f0;border-radius:12px;padding:6px;break-inside:avoid;background:#fff}}.photo-card img{{display:block;width:100%;height:58mm;object-fit:cover;border-radius:8px;background:#f1f5f9}}.photo-card figcaption{{font-size:8px;color:#64748b;margin-top:5px;line-height:1.3}}.photo-missing{{height:45mm;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#f8fafc;color:#94a3b8;font-size:9px;font-weight:800}}.photo-note{{font-size:8px;color:#64748b;margin:8px 0 0}}.signatures{{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:24px;break-inside:avoid}}.sign{{padding-top:20px;border-top:1px solid #64748b;font-size:9px;color:#475569}}.sign b{{display:block;color:#0f172a;font-size:10px;margin-bottom:4px}}.audit{{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;gap:10px;color:#94a3b8;font-size:7.5px}}@media print{{body{{background:#fff}}.sheet{{width:auto;min-height:auto;margin:0;padding:0}}.toolbar{{display:none}}}}@media(max-width:800px){{.sheet{{width:100%;min-height:0;padding:18px}}.meta{{grid-template-columns:1fr 1fr}}.client{{grid-template-columns:1fr}}.photo-grid{{grid-template-columns:1fr}}.photo-card img{{height:auto;max-height:70vh}}}}
</style></head><body>{toolbar}<main class='sheet'>
<header class='top'><div class='brand'>{f"<img class='logo' src='{_txt(logo)}' alt='Логотип'>" if logo else ''}<div class='company'><h1>{_txt(company.name)}</h1><p>{_txt(company.address, '')}</p><p>{_txt(company_phones, '')}</p></div></div><div class='doc-head'><h2>Акт приймання автомобіля</h2><div class='number'>Акт №{visit.id} · Візит №{visit.id}</div><span class='badge {status_class}'>{status_label}</span></div></header>
<div class='client'>{_info_block('Клієнт', act.get('client') or visit.client)}{_info_block('Телефон', act.get('phone') or visit.phone)}</div>
<div class='meta'>{details}</div>
{_text_section('Скарга клієнта', act.get('customer_complaint'))}
{_text_section('Пошкодження кузова', act.get('damages'))}
{_text_section('Зовнішній стан / примітка', act.get('exterior_note'))}
{_text_section('Салон / речі в авто', act.get('interior_note'))}
{_text_section('Загальна примітка', act.get('note'))}
{photo_html}{photo_notice}{terms_html}
<div class='signatures'><div class='sign'><b>Авто передав</b>{_txt(act.get('client') or visit.client)}<br>Підпис: ____________________</div><div class='sign'><b>Авто прийняв</b>{_txt(representative)}<br>Підпис: ____________________</div></div>
<div class='audit'><span>Дата оформлення: {_txt(_format_datetime(acceptance_time))} · Коригувань: {revision_count}</span><span>Код фіксації: {code}</span></div>
</main>{auto_script}</body></html>"""


class AcceptanceActTermsView(APIView):
    def get_permissions(self):
        classes = [IsAuthenticated]
        if self.request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            classes.append(CompanyOwnerOrPlatformAdmin)
        return [permission() for permission in classes]

    def get(self, request):
        visit, company = get_visit_for_user(request.user, request.query_params.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=404)
        act = _read_act(company.id, visit.id)
        completed = bool(act and str(act.get('status') or '').lower() == 'completed')
        saved_terms = str((act or {}).get('terms_text') or '').strip()
        default_terms = _default_terms(company)
        terms = saved_terms if (completed or saved_terms) else default_terms
        return Response({
            'visit': visit.id,
            'has_act': bool(act),
            'locked': completed,
            'can_edit': bool(not completed and is_company_owner_or_platform_admin(request.user)),
            'terms_text': terms,
            'default_terms': default_terms,
            'uses_default': bool(not saved_terms and bool(default_terms)),
        })

    def patch(self, request):
        visit, company = get_visit_for_user(request.user, request.data.get('visit'))
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=404)
        terms = str(request.data.get('terms_text') or '').strip()[:12000]
        save_as_default = request.data.get('save_as_default') in [True, 'true', '1', 1]
        act = _read_act(company.id, visit.id)
        if act and str(act.get('status') or '').lower() == 'completed':
            return Response({'detail': 'Зафіксований акт не можна змінювати. Створіть коригування.'}, status=409)

        ensure_visit_workflow_tables()
        with connection.cursor() as cursor:
            if act:
                cursor.execute(
                    'UPDATE core_visitacceptanceact SET terms_text = %s, updated_at = CURRENT_TIMESTAMP WHERE company_id = %s AND visit_id = %s',
                    [terms, company.id, visit.id],
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO core_visitacceptanceact (
                        company_id, visit_id, client, phone, plate, terms_text, status,
                        created_by_id, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'draft', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    [company.id, visit.id, visit.client, visit.phone, visit.plate, terms, request.user.id],
                )
        if save_as_default:
            _save_default_terms(company, terms)
        return Response({'ok': True, 'terms_text': terms, 'saved_as_default': save_as_default, 'has_act': True})


class AcceptanceActDocumentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, visit_id):
        visit, company = get_visit_for_user(request.user, visit_id)
        if not visit:
            return Response({'detail': 'Візит не знайдено.'}, status=404)
        act = _read_act(company.id, visit.id)
        if not act:
            return Response({'detail': 'Спочатку збережіть акт приймання.'}, status=409)

        auto_print = request.query_params.get('print') == '1'
        html = build_acceptance_document_html(request, company, visit, act, auto_print=auto_print)
        response = HttpResponse(html, content_type='text/html; charset=utf-8')
        response['Content-Disposition'] = f'inline; filename="acceptance-act-{visit.id}.html"'
        try:
            log_activity(
                company=company,
                user=request.user,
                visit=visit,
                action_type='document_printed' if auto_print else 'document_viewed',
                title='Акт приймання авто надруковано' if auto_print else 'Акт приймання авто переглянуто',
                description=f'Акт приймання авто №{visit.id}',
                metadata={'document_type': 'acceptance_act', 'visit_id': visit.id},
            )
        except Exception:
            pass
        return response
