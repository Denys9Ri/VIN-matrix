from decimal import Decimal
from html import escape

from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .activity import log_activity
from .models import OrderPart, OrderService, Visit
from .partner_views import repair_legacy_account


DOCUMENT_TYPES = {
    'receipt': 'Товарний чек',
    'invoice': 'Рахунок на оплату',
    'waybill': 'Видаткова накладна',
    'service_act': 'Акт виконаних робіт',
    'warranty': 'Гарантійний талон',
    'return_note': 'Акт повернення товару',
}

DOCUMENT_ACTIONS = {
    'viewed': ('document_viewed', 'Документ переглянуто'),
    'printed': ('document_printed', 'Документ надруковано'),
    'downloaded': ('document_downloaded', 'Документ скачано'),
    'sent': ('document_sent', 'Документ надіслано клієнту'),
    'email': ('document_sent', 'Документ надіслано email'),
    'sms': ('document_sent', 'Документ надіслано SMS'),
    'copied': ('document_message_copied', 'Текст документа скопійовано'),
}


def get_user_company(user):
    try:
        return user.company
    except Exception:
        pass
    try:
        return user.employee_profile.company
    except Exception:
        return None


def txt(value, fallback='—'):
    value = fallback if value in [None, ''] else value
    return escape(str(value))


def nl2br(value):
    return txt(value, '').replace('\n', '<br>')


def money_value(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal('0.00')


def money(value):
    return f"{money_value(value):,.2f}".replace(',', ' ') + ' ₴'


def quantity(value):
    try:
        raw = Decimal(str(value or 0))
        return str(raw.normalize()) if raw == raw.to_integral() else str(raw)
    except Exception:
        return str(value or '1')


def payment_total(visit):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT COALESCE(SUM(amount), 0) FROM core_visitpayment WHERE visit_id=%s', [visit.id])
            value = cursor.fetchone()[0]
        paid = money_value(value)
        if paid > 0:
            return paid
    except Exception:
        pass
    return money_value(getattr(visit, 'prepayment_amount', 0))


def document_rows(doc_type, services, parts):
    service_rows = [
        {
            'kind': 'Робота',
            'article': 'Послуга',
            'name': service.name,
            'qty': service.quantity,
            'price': service.price,
            'sum': money_value(service.price) * money_value(service.quantity or 1),
        }
        for service in services
    ]
    part_rows = [
        {
            'kind': 'Товар',
            'article': f"{part.brand or ''} {part.article or ''}".strip() or '—',
            'name': part.name,
            'qty': part.quantity,
            'price': part.sell_price,
            'sum': money_value(part.sell_price) * money_value(part.quantity or 1),
        }
        for part in parts
    ]
    if doc_type in ['waybill', 'warranty', 'return_note']:
        return part_rows
    if doc_type == 'service_act':
        return service_rows + part_rows
    return part_rows + service_rows


def logo_url(request, company):
    logo = getattr(company, 'logo', None)
    if not logo:
        return ''
    try:
        return request.build_absolute_uri(logo.url)
    except Exception:
        return ''


def car_label(visit):
    return getattr(visit, 'plate', '') or '—'


def file_slug(value):
    safe = ''.join(ch if ch.isalnum() else '-' for ch in str(value or 'document').lower())
    while '--' in safe:
        safe = safe.replace('--', '-')
    return safe.strip('-') or 'document'


def resolve_visit(request, visit_id, doc_type):
    repair_legacy_account(request.user)
    company = get_user_company(request.user)
    if not company:
        return None, None, JsonResponse({'error': 'Немає компанії.'}, status=403)
    if doc_type not in DOCUMENT_TYPES:
        return None, None, JsonResponse({'error': 'Невідомий тип документа.'}, status=404)
    try:
        return company, Visit.objects.get(id=visit_id, company=company), None
    except Visit.DoesNotExist:
        return company, None, JsonResponse({'error': 'Замовлення не знайдено.'}, status=404)


def log_document_event(company, user, visit, doc_type, action_key, channel='', silent=False):
    action_type, title = DOCUMENT_ACTIONS.get(action_key, DOCUMENT_ACTIONS['viewed'])
    document_title = DOCUMENT_TYPES.get(doc_type, 'Документ')
    description = f"{document_title} №{visit.id}"
    if channel:
        description = f"{description} · {channel}"
    log_activity(
        company=company,
        user=user,
        visit=visit,
        action_type=action_type,
        title=title,
        description=description,
        metadata={
            'document_type': doc_type,
            'document_title': document_title,
            'document_action': action_key,
            'channel': channel,
            'client': getattr(visit, 'client', '') or '',
            'phone': getattr(visit, 'phone', '') or '',
            'plate': getattr(visit, 'plate', '') or '',
        },
    )
    if not silent:
        return {'ok': True, 'message': title}
    return None


class VisitDocumentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, visit_id, doc_type):
        company, visit, error = resolve_visit(request, visit_id, doc_type)
        if error:
            return error

        services = list(OrderService.objects.filter(visit=visit).order_by('id'))
        parts = list(OrderPart.objects.filter(visit=visit).order_by('id'))
        auto_print = request.GET.get('print') == '1'
        download = request.GET.get('download') == '1'
        html = build_document_html(request, visit, company, doc_type, services, parts, auto_print=auto_print)
        response = HttpResponse(html, content_type='text/html; charset=utf-8')
        filename = f"{file_slug(DOCUMENT_TYPES[doc_type])}-{visit.id}.html"
        disposition = 'attachment' if download else 'inline'
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'

        if download:
            action = 'downloaded'
        elif auto_print:
            action = 'printed'
        else:
            action = 'viewed'
        log_document_event(company, request.user, visit, doc_type, action, silent=True)
        return response

    def post(self, request, visit_id, doc_type):
        company, visit, error = resolve_visit(request, visit_id, doc_type)
        if error:
            return error
        action = request.data.get('action') or 'sent'
        channel = request.data.get('channel') or ''
        result = log_document_event(company, request.user, visit, doc_type, action, channel=channel)
        return Response(result)


def build_document_html(request, visit, company, doc_type, services, parts, auto_print=False):
    title = DOCUMENT_TYPES.get(doc_type, 'Документ')
    rows = document_rows(doc_type, services, parts)
    total = sum((row['sum'] for row in rows), Decimal('0.00'))
    paid = payment_total(visit)
    debt = max(total - paid, Decimal('0.00'))
    logo = logo_url(request, company)
    date = timezone.localtime(timezone.now()).strftime('%d.%m.%Y')
    requisites = getattr(company, 'document_requisites', '') or ''
    footer = getattr(company, 'document_footer', '') or 'Дякуємо за довіру. Зберігайте цей документ до завершення гарантійного терміну.'
    signature = getattr(company, 'document_signature', '') or 'Підпис відповідальної особи'
    warranty = getattr(company, 'document_warranty_text', '') or 'Гарантія діє за умови встановлення та використання товару згідно з рекомендаціями виробника. Повернення можливе згідно з чинним законодавством та умовами продавця.'
    is_invoice = doc_type == 'invoice'
    is_warranty = doc_type == 'warranty'
    is_return = doc_type == 'return_note'

    row_html = ''.join(
        f"<tr><td><span class='kind'>{txt(row['kind'])}</span></td><td>{txt(row['article'])}</td><td>{txt(row['name'])}</td><td class='num'>{quantity(row['qty'])}</td><td class='num'>{money(row['price'])}</td><td class='num'>{money(row['sum'])}</td></tr>"
        for row in rows
    ) or "<tr><td colspan='6' class='empty'>Позицій немає</td></tr>"

    return f"""<!doctype html><html><head><meta charset='utf-8'><title>{txt(title)} №{visit.id}</title><style>
@page{{size:A4;margin:12mm}}*{{box-sizing:border-box}}body{{margin:0;background:#e2e8f0;color:#0f172a;font-family:Arial,sans-serif}}.sheet{{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:15mm 16mm}}.toolbar{{position:sticky;top:0;z-index:10;background:#0f172a;color:#fff;padding:10px 14px;text-align:right}}.toolbar button{{border:0;border-radius:12px;background:#2563eb;color:#fff;padding:10px 14px;font-weight:900;text-transform:uppercase;font-size:11px}}.top{{display:flex;justify-content:space-between;gap:22px;border-bottom:3px solid #0f172a;padding-bottom:16px}}.brand{{display:flex;gap:14px;align-items:center;min-width:0}}.logo{{width:68px;height:68px;object-fit:contain;border:1px solid #e2e8f0;border-radius:18px;padding:6px}}.company h1{{margin:0;font-size:24px;line-height:1.05;font-weight:900;letter-spacing:-.03em}}.muted{{color:#64748b;font-size:12px;line-height:1.45}}.req{{text-align:right;max-width:82mm}}.doc-head{{margin:22px 0 18px;display:flex;justify-content:space-between;gap:18px;align-items:flex-end}}.doc-title{{font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:-.04em;margin:0}}.pill{{display:inline-flex;background:#eff6ff;color:#1d4ed8;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:900;text-transform:uppercase}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}}.box{{border:1px solid #e2e8f0;border-radius:18px;padding:13px;background:#f8fafc;min-height:72px}}.box b{{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:6px}}.box p{{margin:0;font-size:14px;font-weight:800;line-height:1.35}}.section-title{{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#334155;margin:20px 0 8px}}table{{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}}th{{background:#0f172a;color:#fff;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px}}td{{border-bottom:1px solid #e2e8f0;padding:10px;font-size:12px;vertical-align:top}}tr:last-child td{{border-bottom:0}}.num{{text-align:right;white-space:nowrap}}.empty{{text-align:center;color:#94a3b8;padding:18px}}.kind{{display:inline-flex;border-radius:999px;background:#f1f5f9;color:#475569;padding:4px 7px;font-size:10px;font-weight:900;text-transform:uppercase}}.summary{{margin-left:auto;margin-top:16px;width:300px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden}}.summary div{{display:flex;justify-content:space-between;gap:12px;padding:11px 13px;border-bottom:1px solid #e2e8f0;font-size:13px}}.summary div:last-child{{border-bottom:0}}.summary .pay{{background:#0f172a;color:#fff;font-weight:900}}.summary .debt{{color:#be123c;font-weight:900}}.note{{margin-top:18px;border:1px dashed #cbd5e1;border-radius:18px;padding:14px;color:#475569;font-size:12px;line-height:1.5;background:#f8fafc}}.note b{{display:block;color:#0f172a;text-transform:uppercase;font-size:11px;margin-bottom:6px}}.sign{{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:46px}}.line{{border-top:1px solid #0f172a;padding-top:8px;color:#475569;font-size:11px}}.footer{{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;color:#64748b;font-size:11px;line-height:1.45}}@media print{{body{{background:#fff}}.sheet{{width:auto;min-height:auto;margin:0;padding:0}}.toolbar{{display:none}}.box,.note,tr{{break-inside:avoid;page-break-inside:avoid}}}}
</style></head><body>{'' if auto_print else "<div class='toolbar'><button onclick='window.print()'>Друк / зберегти PDF</button></div>"}<main class='sheet'>
<header class='top'><div class='brand'>{f"<img class='logo' src='{txt(logo)}' alt='logo'>" if logo else ''}<div class='company'><h1>{txt(getattr(company, 'name', '') or 'VIN-matrix')}</h1><div class='muted'>{txt(getattr(company, 'address', '') or '')}</div><div class='muted'>{txt(getattr(company, 'phone', '') or '')}</div></div></div><div class='muted req'><b>{txt(date)}</b><br>{nl2br(requisites)}</div></header>
<section class='doc-head'><div><h2 class='doc-title'>{txt(title)}</h2><span class='pill'>№{visit.id} · {txt(getattr(visit, 'status', '') or '')}</span></div><div class='muted' style='text-align:right'>{'Призначення платежу:<br>Оплата за замовлення №' + str(visit.id) if is_invoice else ''}</div></section>
<section class='grid'><div class='box'><b>Клієнт</b><p>{txt(visit.client)}</p><div class='muted'>{txt(visit.phone, '')}</div></div><div class='box'><b>Авто / VIN</b><p>{txt(car_label(visit))}</p><div class='muted'>{txt(visit.plate, '')}{' · VIN: ' + txt(visit.vin_code) if getattr(visit, 'vin_code', None) else ''}</div></div></section>
<div class='section-title'>Позиції документа</div><table><thead><tr><th>Тип</th><th>Артикул</th><th>Назва</th><th class='num'>К-сть</th><th class='num'>Ціна</th><th class='num'>Сума</th></tr></thead><tbody>{row_html}</tbody></table>
<section class='summary'><div><span>Разом</span><b>{money(total)}</b></div><div><span>Оплачено</span><b>{money(paid)}</b></div><div><span>Борг</span><b class='debt'>{money(debt)}</b></div><div class='pay'><span>До сплати</span><b>{money(debt)}</b></div></section>
{f"<section class='note'><b>Умови гарантії</b>{nl2br(warranty)}</section>" if is_warranty else ''}
{"<section class='note'><b>Повернення товару</b>Товар прийнято до повернення після перевірки стану, комплектності та відповідності умовам повернення. Остаточне рішення приймається відповідальною особою компанії.</section>" if is_return else ''}
{f"<section class='note'><b>Примітка</b>{nl2br(footer)}</section>" if not is_warranty and not is_return else ''}
<section class='sign'><div class='line'>{txt(signature)}</div><div class='line'>Підпис клієнта</div></section><footer class='footer'>{nl2br(footer)}<br>Документ сформовано у VIN-matrix · {txt(getattr(company, 'name', '') or '')}</footer></main>{"<script>window.onload=()=>setTimeout(()=>window.print(),250);</script>" if auto_print else ''}</body></html>"""
