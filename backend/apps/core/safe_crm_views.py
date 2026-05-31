import json
from datetime import datetime, timedelta, time as dt_time
from decimal import Decimal
from html import escape

from django.contrib.auth.models import User
from django.db import connection
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, Employee, InventoryItem, OrderPart, OrderService, ServiceCatalog, Supplier, Visit, VehicleRecommendation, CRMTask
from .serializers import (
    CategorySerializer,
    InventoryItemSerializer,
    OrderPartSerializer,
    OrderServiceSerializer,
    ServiceCatalogSerializer,
    SupplierSerializer,
    VisitSerializer,
    VehicleRecommendationSerializer,
)
from .views import VisitViewSet as BaseVisitViewSet


SUPPLIER_BADGE_KEYS = {
    'supplier-local',
    'supplier-vesna',
    'supplier-omega',
    'supplier-tehnomir',
    'supplier-bm',
    'supplier-default',
}


def safe_text(value, max_len=80):
    return str(value or '').strip()[:max_len]


def has_value(value):
    return value not in [None, '', [], {}] and str(value).strip() not in ['', '—', 'None']


def html_text(value, fallback='—'):
    value = fallback if not has_value(value) else value
    return escape(str(value))


def money_value(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal('0.00')


def money_display(value):
    return f"{money_value(value):,.2f}".replace(',', ' ') + ' ₴'


def qty_display(value):
    try:
        qty = Decimal(str(value or 0))
        return str(qty.normalize()) if qty == qty.to_integral() else str(qty)
    except Exception:
        return str(value or '1')


def status_label(value):
    return {
        'WAITING': 'Очікується',
        'IN_TRANSIT': 'В дорозі',
        'ARRIVED': 'Доставлено',
        'UNAVAILABLE': 'Відмова',
        'PENDING': 'Очікується',
        'IN_PROGRESS': 'В роботі',
        'ORDERED': 'Замовлено',
        'DONE': 'Готово',
        'COMPLETED': 'Завершено',
        'SELECTION': 'Підбір',
        'DRAFT': 'Чернетка',
        'active': 'Активна',
        'done': 'Виконана',
        'cancelled': 'Скасована',
        'draft': 'Чернетка',
        'completed': 'Готово',
        'ok': 'ОК',
        'attention': 'Увага',
        'critical': 'Критично',
        'not_checked': 'Не перевірено',
    }.get(str(value or ''), str(value or '—'))


def workflow_row(table_name, company_id, visit_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT * FROM {table_name} WHERE company_id = %s AND visit_id = %s LIMIT 1", [company_id, visit_id])
            row = cursor.fetchone()
            if not row:
                return {}
            columns = [col[0] for col in cursor.description]
            data = dict(zip(columns, row))
            if isinstance(data.get('checklist'), str):
                try:
                    data['checklist'] = json.loads(data['checklist'])
                except Exception:
                    data['checklist'] = {}
            return data
    except Exception:
        return {}


class CRMTaskSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField()
    state_label = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = CRMTask
        fields = [
            'id', 'visit', 'client', 'phone', 'plate', 'title', 'description', 'due_date',
            'status', 'state', 'state_label', 'days_left', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def _days_left(self, obj):
        if not obj.due_date:
            return None
        return (obj.due_date - timezone.localdate()).days

    def get_days_left(self, obj):
        return self._days_left(obj)

    def get_state(self, obj):
        if obj.status == CRMTask.STATUS_DONE:
            return 'done'
        if obj.status == CRMTask.STATUS_IN_PROGRESS:
            return 'in_progress'
        days = self._days_left(obj)
        if days is not None and days < 0:
            return 'overdue'
        return obj.status or 'new'

    def get_state_label(self, obj):
        return {
            'new': 'Нова',
            'in_progress': 'В роботі',
            'done': 'Виконана',
            'overdue': 'Прострочена',
        }.get(self.get_state(obj), 'Нова')


def safe_get_company(user):
    try:
        return user.company
    except Exception:
        pass

    try:
        return user.employee_profile.company
    except Exception:
        pass

    return None


def safe_ensure_company(user):
    company = safe_get_company(user)
    if company:
        return company

    try:
        from .partner_views import repair_legacy_account
        repair_legacy_account(user)
    except Exception:
        pass

    return safe_get_company(user)


def supplier_badge_class(supplier_name, is_local=False):
    """Return a short badge key, not a long Tailwind class.

    OrderPart.supplier_color is varchar(80). Long arbitrary Tailwind classes
    can crash PostgreSQL with StringDataRightTruncation, especially for BM-Parts.
    The frontend maps these compact keys to real responsive badge styles.
    """
    if is_local:
        return 'supplier-local'
    name = str(supplier_name or '').upper()
    if 'VESNA' in name or 'ВЕСНА' in name:
        return 'supplier-vesna'
    if 'OMEGA' in name or 'ОМЕГА' in name:
        return 'supplier-omega'
    if 'TEHNO' in name or 'ТЕХНО' in name:
        return 'supplier-tehnomir'
    if 'ТЕХНО' in name or 'ТЕХНОМИР' in name:
        return 'supplier-tehnomir'
    if 'BM' in name or 'BM-PARTS' in name or 'BM PARTS' in name:
        return 'supplier-bm'
    return 'supplier-default'


def normalize_supplier_badge_key(value, supplier_name='', is_local=False):
    value = safe_text(value, 80)
    if value in SUPPLIER_BADGE_KEYS:
        return value
    return supplier_badge_class(supplier_name, is_local)


class VisitViewSet(BaseVisitViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = Visit.objects.filter(company=company) if company else Visit.objects.none()
        if self.action != 'list':
            return queryset

        search = self.request.query_params.get('search', '').strip()
        date_str = self.request.query_params.get('date', '').strip()
        history_mode = self.request.query_params.get('history', '').strip()

        if history_mode == 'true':
            if search:
                queryset = queryset.filter(
                    Q(plate__icontains=search)
                    | Q(vin_code__icontains=search)
                    | Q(client__icontains=search)
                    | Q(phone__icontains=search)
                )
            return queryset.order_by('-created_at')

        if search:
            queryset = queryset.filter(
                Q(plate__icontains=search)
                | Q(vin_code__icontains=search)
                | Q(client__icontains=search)
                | Q(phone__icontains=search)
            )
            return queryset.order_by('-created_at')

        if date_str and len(date_str) == 10:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except Exception:
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()

        start_of_day = timezone.make_aware(datetime.combine(target_date, dt_time.min))
        end_of_day = start_of_day + timedelta(days=1)

        queryset = queryset.filter(
            Q(scheduled_datetime__gte=start_of_day, scheduled_datetime__lt=end_of_day)
            | Q(scheduled_datetime__isnull=True, created_at__gte=start_of_day, created_at__lt=end_of_day)
        ).distinct()

        return queryset.order_by('scheduled_datetime' if date_str else '-created_at')

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення візиту.')
        serializer.save(company=company)

    @action(detail=True, methods=['get'], url_path='pdf')
    def export_pdf(self, request, pk=None):
        visit = self.get_object()
        company = visit.company

        car_data = {}
        if visit.delivery_data and str(visit.delivery_data).strip().startswith('{'):
            try:
                car_data = json.loads(visit.delivery_data)
            except Exception:
                car_data = {}

        acceptance = workflow_row('core_visitacceptanceact', company.id if company else None, visit.id)
        diagnostic = workflow_row('core_visitdiagnosticchecklist', company.id if company else None, visit.id)
        checklist = diagnostic.get('checklist') or {}

        services = list(getattr(visit, 'services', OrderService.objects.none()).all())
        parts = list(getattr(visit, 'parts', OrderPart.objects.none()).all())
        recommendations = list(VehicleRecommendation.objects.filter(company=company, status=VehicleRecommendation.STATUS_ACTIVE).filter(
            Q(visit=visit) | Q(plate__iexact=visit.plate) | Q(phone__iexact=visit.phone)
        ).distinct().order_by('due_date', '-created_at')[:12]) if company else []

        services_total = sum((money_value(s.price) * money_value(s.quantity or 1) for s in services), Decimal('0.00'))
        parts_total = sum((money_value(p.sell_price) * money_value(p.quantity or 1) for p in parts), Decimal('0.00'))
        grand_total = services_total + parts_total

        comp_name = html_text(getattr(company, 'name', '') or 'АВТОСЕРВІС')
        comp_phone = html_text(getattr(company, 'phone', '') or '')
        comp_addr = html_text(getattr(company, 'address', '') or '')
        footer_text = html_text(getattr(company, 'document_footer', '') or 'Дякуємо, що обрали нас!')
        visit_dt = timezone.localtime(visit.scheduled_datetime or visit.created_at).strftime('%d.%m.%Y %H:%M')
        generated_at = timezone.localtime(timezone.now()).strftime('%d.%m.%Y %H:%M')

        engine_text = ' / '.join([x for x in [
            car_data.get('engine_volume') or car_data.get('engine'),
            f"{car_data.get('engine_power')} кВт" if car_data.get('engine_power') else '',
            car_data.get('engine_code'),
        ] if x]) or '—'

        diagnostic_labels = {
            'engine': 'Двигун', 'brakes': 'Гальма', 'suspension': 'Ходова', 'fluids': 'Рідини',
            'tires': 'Шини', 'lights': 'Світло', 'battery': 'АКБ', 'computer': 'Помилки/компʼютер'
        }

        acceptance_rows = []
        mileage = acceptance.get('mileage') or car_data.get('mileage')
        if has_value(mileage):
            acceptance_rows.append(f"<tr><th>Пробіг</th><td>{html_text(mileage)} км</td></tr>")
        if has_value(acceptance.get('fuel_level')):
            acceptance_rows.append(f"<tr><th>Рівень палива</th><td>{html_text(acceptance.get('fuel_level'))}</td></tr>")
        if has_value(acceptance.get('customer_complaint')):
            acceptance_rows.append(f"<tr><th>Скарга клієнта</th><td>{html_text(acceptance.get('customer_complaint'))}</td></tr>")
        if has_value(acceptance.get('damages')):
            acceptance_rows.append(f"<tr><th>Пошкодження</th><td>{html_text(acceptance.get('damages'))}</td></tr>")
        if has_value(acceptance.get('interior_note')):
            acceptance_rows.append(f"<tr><th>Салон / речі</th><td>{html_text(acceptance.get('interior_note'))}</td></tr>")
        if has_value(acceptance.get('exterior_note')):
            acceptance_rows.append(f"<tr><th>Зовнішній стан</th><td>{html_text(acceptance.get('exterior_note'))}</td></tr>")
        if has_value(acceptance.get('note')):
            acceptance_rows.append(f"<tr><th>Примітка</th><td>{html_text(acceptance.get('note'))}</td></tr>")
        acceptance_section = f"<h3>Акт приймання авто</h3><table><tbody>{''.join(acceptance_rows)}</tbody></table>" if acceptance_rows else ''

        diagnostic_rows = []
        for key, label in diagnostic_labels.items():
            item = checklist.get(key) or {}
            note = item.get('note')
            if has_value(note):
                diagnostic_rows.append(f"<tr><td>{html_text(label)}</td><td>{html_text(note)}</td></tr>")
        diagnostic_section = ''
        if diagnostic_rows or has_value(diagnostic.get('summary')):
            diagnostic_table = f"<table><thead><tr><th>Вузол</th><th>Результат / коментар</th></tr></thead><tbody>{''.join(diagnostic_rows)}</tbody></table>" if diagnostic_rows else ''
            diagnostic_note = f"<div class='note' style='margin-top:10px;'><strong>Висновок діагностики:</strong><br>{html_text(diagnostic.get('summary'))}</div>" if has_value(diagnostic.get('summary')) else ''
            diagnostic_section = f"<h3>Діагностика / чек-лист</h3>{diagnostic_table}{diagnostic_note}"

        services_rows = ''.join(
            f"<tr><td>{html_text(s.name)}</td><td class='center'>{qty_display(s.quantity)}</td><td class='right'>{money_display(s.price)}</td><td class='right'>{money_display(money_value(s.price) * money_value(s.quantity or 1))}</td></tr>"
            for s in services
        )
        services_section = f"<h3>Виконані роботи</h3><table><thead><tr><th>Назва роботи</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr></thead><tbody>{services_rows}</tbody></table>" if services_rows else ''

        parts_rows = ''.join(
            f"<tr><td>{html_text(p.brand)}</td><td>{html_text(p.article)}</td><td>{html_text(p.name)}</td><td class='center'>{qty_display(p.quantity)}</td><td class='right'>{money_display(p.sell_price)}</td><td class='right'>{money_display(money_value(p.sell_price) * money_value(p.quantity or 1))}</td></tr>"
            for p in parts
        )
        parts_section = f"<h3>Запчастини та матеріали</h3><table><thead><tr><th>Бренд</th><th>Артикул</th><th>Найменування</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr></thead><tbody>{parts_rows}</tbody></table>" if parts_rows else ''

        recommendations_rows = ''.join(
            f"<tr><td>{html_text(r.title)}</td><td>{html_text(r.description)}</td><td>{html_text(r.due_date.strftime('%d.%m.%Y') if r.due_date else '')}{' / ' + html_text(r.due_mileage) + ' км' if r.due_mileage else ''}</td></tr>"
            for r in recommendations
        )
        recommendations_section = f"<h3>Рекомендації</h3><table><thead><tr><th>Що зробити</th><th>Опис</th><th>Термін</th></tr></thead><tbody>{recommendations_rows}</tbody></table>" if recommendations_rows else ''

        summary_section = f"""
                <section class="summary">
                    <div class="card"><div class="label">Роботи</div><div class="value">{money_display(services_total)}</div></div>
                    <div class="card"><div class="label">Запчастини</div><div class="value">{money_display(parts_total)}</div></div>
                    <div class="card total"><div class="label">Разом</div><div class="value">{money_display(grand_total)}</div></div>
                </section>
        """ if services or parts else ''

        html_content = f"""
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Сервісний звіт №{visit.id}</title>
            <style>
                * {{ box-sizing: border-box; }}
                body {{ font-family: Arial, sans-serif; margin: 0; color: #111827; background: #f1f5f9; font-size: 13px; }}
                .page {{ max-width: 980px; margin: 24px auto; background: white; padding: 30px; border-radius: 24px; box-shadow: 0 16px 45px rgba(15,23,42,.12); }}
                .actions {{ max-width: 980px; margin: 18px auto 0; display: flex; gap: 10px; justify-content: flex-end; }}
                .actions button {{ border: 0; border-radius: 14px; padding: 12px 18px; font-weight: 800; cursor: pointer; }}
                .primary {{ background: #2563eb; color: white; }}
                .muted {{ background: #e2e8f0; color: #334155; }}
                .top {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 22px; }}
                .brand h1 {{ margin: 0; font-size: 24px; }}
                .brand p, .doc p {{ margin: 4px 0; color: #64748b; }}
                .doc {{ text-align: right; }}
                .doc h2 {{ margin: 0; font-size: 22px; text-transform: uppercase; }}
                .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }}
                .card {{ border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #f8fafc; min-height: 62px; }}
                .label {{ color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: .08em; }}
                .value {{ margin-top: 5px; font-size: 14px; font-weight: 800; }}
                h3 {{ margin: 24px 0 10px; font-size: 16px; text-transform: uppercase; letter-spacing: .04em; }}
                table {{ width: 100%; border-collapse: collapse; page-break-inside: auto; }}
                tr {{ page-break-inside: avoid; page-break-after: auto; }}
                th {{ background: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: .07em; }}
                th, td {{ border: 1px solid #e2e8f0; padding: 9px; vertical-align: top; }}
                .right {{ text-align: right; }} .center {{ text-align: center; }}
                .summary {{ margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
                .summary .card {{ background: #eff6ff; border-color: #bfdbfe; }}
                .total .value {{ font-size: 20px; color: #1d4ed8; }}
                .note {{ border: 1px solid #fde68a; background: #fffbeb; border-radius: 16px; padding: 12px; white-space: pre-wrap; }}
                .sign {{ margin-top: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }}
                .line {{ border-top: 1px solid #111827; padding-top: 8px; color: #64748b; }}
                .footer {{ margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }}
                @media print {{
                    body {{ background: white; }} .actions {{ display: none; }} .page {{ box-shadow: none; margin: 0; max-width: none; border-radius: 0; padding: 18px; }}
                }}
                @page {{ size: A4; margin: 12mm; }}
            </style>
        </head>
        <body>
            <div class="actions">
                <button class="primary" onclick="window.print()">Зберегти як PDF / Друк</button>
                <button class="muted" onclick="window.close()">Закрити</button>
            </div>
            <main class="page">
                <section class="top">
                    <div class="brand"><h1>{comp_name}</h1><p>{comp_addr}</p><p>{comp_phone}</p></div>
                    <div class="doc"><h2>Сервісний звіт</h2><p>Візит №{visit.id}</p><p>Дата візиту: {html_text(visit_dt)}</p><p>Сформовано: {html_text(generated_at)}</p></div>
                </section>

                <div class="grid">
                    <div class="card"><div class="label">Клієнт</div><div class="value">{html_text(visit.client)}</div></div>
                    <div class="card"><div class="label">Телефон</div><div class="value">{html_text(visit.phone)}</div></div>
                    <div class="card"><div class="label">Держ. номер</div><div class="value">{html_text(visit.plate)}</div></div>
                    <div class="card"><div class="label">VIN</div><div class="value">{html_text(visit.vin_code)}</div></div>
                    <div class="card"><div class="label">Авто</div><div class="value">{html_text(car_data.get('brand'))} {html_text(car_data.get('model'))}</div></div>
                    <div class="card"><div class="label">Рік</div><div class="value">{html_text(car_data.get('year'))}</div></div>
                    <div class="card"><div class="label">Двигун</div><div class="value">{html_text(engine_text)}</div></div>
                    <div class="card"><div class="label">Паливо / пробіг</div><div class="value">{html_text(car_data.get('fuel'))} / {html_text(mileage)} км</div></div>
                </div>

                {acceptance_section}
                {diagnostic_section}
                {services_section}
                {parts_section}
                {recommendations_section}
                {summary_section}

                <section class="sign">
                    <div class="line">Представник сервісу</div>
                    <div class="line">Клієнт</div>
                </section>
                <div class="footer">{footer_text}</div>
            </main>
        </body>
        </html>
        """
        return HttpResponse(html_content, content_type='text/html; charset=utf-8')


class VehicleRecommendationViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleRecommendationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = VehicleRecommendation.objects.filter(company=company) if company else VehicleRecommendation.objects.none()
        search = self.request.query_params.get('search', '').strip()
        status_filter = self.request.query_params.get('status', '').strip()
        visit_id = self.request.query_params.get('visit', '').strip()
        plate = self.request.query_params.get('plate', '').strip()
        phone = self.request.query_params.get('phone', '').strip()

        if search:
            queryset = queryset.filter(
                Q(client__icontains=search) | Q(phone__icontains=search) | Q(plate__icontains=search)
                | Q(car__icontains=search) | Q(title__icontains=search) | Q(description__icontains=search)
            )
        if status_filter in ['active', 'done', 'cancelled']:
            queryset = queryset.filter(status=status_filter)
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        if plate:
            queryset = queryset.filter(plate__iexact=plate)
        if phone:
            queryset = queryset.filter(phone__iexact=phone)
        return queryset.order_by('status', 'due_date', '-created_at')

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення рекомендації.')

        visit = None
        visit_id = self.request.data.get('visit')
        if visit_id:
            try:
                visit = Visit.objects.get(id=visit_id, company=company)
            except Visit.DoesNotExist:
                visit = None

        defaults = {}
        if visit:
            car = ''
            if visit.delivery_data and str(visit.delivery_data).strip().startswith('{'):
                try:
                    data = json.loads(visit.delivery_data)
                    car = f"{data.get('brand', '')} {data.get('model', '')}".strip()
                except Exception:
                    car = ''
            defaults = {
                'client': self.request.data.get('client') or visit.client,
                'phone': self.request.data.get('phone') or visit.phone,
                'plate': self.request.data.get('plate') or visit.plate,
                'car': self.request.data.get('car') or car,
            }
        serializer.save(company=company, created_by=self.request.user, **defaults)

    @action(detail=True, methods=['post'], url_path='mark-done')
    def mark_done(self, request, pk=None):
        rec = self.get_object()
        rec.status = VehicleRecommendation.STATUS_DONE
        rec.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(rec).data)


class CRMTaskViewSet(viewsets.ModelViewSet):
    serializer_class = CRMTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = CRMTask.objects.filter(company=company) if company else CRMTask.objects.none()
        search = self.request.query_params.get('search', '').strip()
        status_filter = self.request.query_params.get('status', '').strip()
        visit_id = self.request.query_params.get('visit', '').strip()

        if search:
            queryset = queryset.filter(
                Q(client__icontains=search) | Q(phone__icontains=search) | Q(plate__icontains=search)
                | Q(title__icontains=search) | Q(description__icontains=search)
            )
        if status_filter in ['new', 'in_progress', 'done', 'overdue']:
            queryset = queryset.filter(status=status_filter)
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        return queryset.order_by('status', 'due_date', '-created_at')

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення задачі.')
        visit = None
        visit_id = self.request.data.get('visit')
        if visit_id:
            try:
                visit = Visit.objects.get(id=visit_id, company=company)
            except Visit.DoesNotExist:
                visit = None
        defaults = {}
        if visit:
            defaults = {
                'client': self.request.data.get('client') or visit.client,
                'phone': self.request.data.get('phone') or visit.phone,
                'plate': self.request.data.get('plate') or visit.plate,
            }
        serializer.save(company=company, created_by=self.request.user, **defaults)

    @action(detail=True, methods=['post'], url_path='mark-done')
    def mark_done(self, request, pk=None):
        task = self.get_object()
        task.status = CRMTask.STATUS_DONE
        task.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(task).data)


class OrderPartViewSet(viewsets.ModelViewSet):
    serializer_class = OrderPartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return OrderPart.objects.filter(visit__company=company) if company else OrderPart.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=company)
        supplier = self.request.data.get('supplier') or ''
        is_local = self.request.data.get('is_local') is True or str(self.request.data.get('is_local')).lower() == 'true'
        supplier_color = normalize_supplier_badge_key(
            self.request.data.get('supplier_color'),
            supplier_name=supplier,
            is_local=is_local,
        )
        serializer.save(visit=visit, supplier_color=supplier_color)


class OrderServiceViewSet(viewsets.ModelViewSet):
    serializer_class = OrderServiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return OrderService.objects.filter(visit__company=company) if company else OrderService.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=company)
        serializer.save(visit=visit)


class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return ServiceCatalog.objects.filter(company=company) if company else ServiceCatalog.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення послуги.')
        serializer.save(company=company)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return Category.objects.filter(company=company) if company else Category.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення категорії.')
        serializer.save(company=company)


class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return InventoryItem.objects.filter(company=company) if company else InventoryItem.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення товару.')
        serializer.save(company=company)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return Supplier.objects.filter(company=company) if company else Supplier.objects.none()

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення постачальника.')
        serializer.save(company=company)


class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)
        mechanics = Employee.objects.filter(company=company, role='mechanic')
        data = [{
            'id': mechanic.user.id,
            'username': mechanic.user.username,
            'first_name': mechanic.user.first_name,
            'can_create_visits': mechanic.can_create_visits,
            'can_view_finances': mechanic.can_view_finances,
        } for mechanic in mechanics]
        return Response(data)

    def create(self, request):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        can_create = request.data.get('can_create_visits') is True
        can_view = request.data.get('can_view_finances') is True
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий'}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=user, company=company, role='mechanic', can_create_visits=can_create, can_view_finances=can_view)
            return Response({'message': 'Створено'}, status=201)
        except Exception as exc:
            return Response({'error': str(exc)}, status=500)

    def partial_update(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=company)
            employee = user.employee_profile
            if request.data.get('first_name'):
                user.first_name = request.data.get('first_name')
            if request.data.get('new_password'):
                user.set_password(request.data.get('new_password'))
            user.save()
            if 'can_create_visits' in request.data:
                employee.can_create_visits = request.data.get('can_create_visits') is True
            if 'can_view_finances' in request.data:
                employee.can_view_finances = request.data.get('can_view_finances') is True
            employee.save()
            return Response({'message': 'Оновлено'})
        except User.DoesNotExist:
            return Response(status=404)

    def destroy(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'):
            return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=company)
            user.delete()
            return Response({'message': 'Видалено'})
        except User.DoesNotExist:
            return Response(status=404)
