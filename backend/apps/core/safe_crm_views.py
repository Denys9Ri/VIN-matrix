import json
from datetime import datetime, timedelta, time as dt_time
from decimal import Decimal
from html import escape

from django.contrib.auth.models import User
from django.db import connection
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity import log_activity
from .models import Category, Employee, InventoryItem, OrderPart, OrderService, ServiceCatalog, Supplier, Visit, VehicleRecommendation, CRMTask
from .serializers import CategorySerializer, InventoryItemSerializer, OrderPartSerializer, OrderServiceSerializer, ServiceCatalogSerializer, SupplierSerializer, VisitSerializer, VehicleRecommendationSerializer
from .views import VisitViewSet as BaseVisitViewSet

SUPPLIER_BADGE_KEYS = {'supplier-local','supplier-vesna','supplier-omega','supplier-tehnomir','supplier-bm','supplier-default'}

def safe_text(value, max_len=80): return str(value or '').strip()[:max_len]
def has_value(value): return value not in [None, '', [], {}] and str(value).strip() not in ['', '—', 'None']
def html_text(value, fallback='—'):
    value = fallback if not has_value(value) else value
    return escape(str(value))
def money_value(value):
    try: return Decimal(str(value or 0))
    except Exception: return Decimal('0.00')
def money_display(value): return f"{money_value(value):,.2f}".replace(',', ' ') + ' ₴'
def qty_display(value):
    try:
        qty = Decimal(str(value or 0))
        return str(qty.normalize()) if qty == qty.to_integral() else str(qty)
    except Exception: return str(value or '1')
def is_store(company): return getattr(company, 'business_type', '') == 'store'
def obj_mode(company): return 'store' if is_store(company) else 'sto'
def visit_word(company): return 'замовлення' if is_store(company) else 'візит'
def part_label(part): return f"{safe_text(getattr(part, 'brand', ''), 80)} {safe_text(getattr(part, 'article', ''), 80)}".strip() or safe_text(getattr(part, 'name', ''), 120) or 'Товар'

def safe_get_company(user):
    try: return user.company
    except Exception: pass
    try: return user.employee_profile.company
    except Exception: pass
    return None

def safe_ensure_company(user):
    company = safe_get_company(user)
    if company: return company
    try:
        from .partner_views import repair_legacy_account
        repair_legacy_account(user)
    except Exception: pass
    return safe_get_company(user)

def supplier_badge_class(supplier_name, is_local=False):
    if is_local: return 'supplier-local'
    name = str(supplier_name or '').upper()
    if 'VESNA' in name or 'ВЕСНА' in name: return 'supplier-vesna'
    if 'OMEGA' in name or 'ОМЕГА' in name: return 'supplier-omega'
    if 'TEHNO' in name or 'ТЕХНО' in name or 'ТЕХНОМИР' in name: return 'supplier-tehnomir'
    if 'BM' in name or 'BM-PARTS' in name or 'BM PARTS' in name: return 'supplier-bm'
    return 'supplier-default'

def normalize_supplier_badge_key(value, supplier_name='', is_local=False):
    value = safe_text(value, 80)
    if value in SUPPLIER_BADGE_KEYS: return value
    return supplier_badge_class(supplier_name, is_local)

class VisitViewSet(BaseVisitViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = Visit.objects.filter(company=company) if company else Visit.objects.none()
        if self.action != 'list': return queryset
        search = self.request.query_params.get('search', '').strip()
        date_str = self.request.query_params.get('date', '').strip()
        history_mode = self.request.query_params.get('history', '').strip()
        if history_mode == 'true':
            if search: queryset = queryset.filter(Q(plate__icontains=search)|Q(vin_code__icontains=search)|Q(client__icontains=search)|Q(phone__icontains=search))
            return queryset.order_by('-created_at')
        if search:
            queryset = queryset.filter(Q(plate__icontains=search)|Q(vin_code__icontains=search)|Q(client__icontains=search)|Q(phone__icontains=search))
            return queryset.order_by('-created_at')
        if date_str and len(date_str) == 10:
            try: target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except Exception: target_date = timezone.localdate()
        else: target_date = timezone.localdate()
        start_of_day = timezone.make_aware(datetime.combine(target_date, dt_time.min))
        end_of_day = start_of_day + timedelta(days=1)
        queryset = queryset.filter(Q(scheduled_datetime__gte=start_of_day, scheduled_datetime__lt=end_of_day)|Q(scheduled_datetime__isnull=True, created_at__gte=start_of_day, created_at__lt=end_of_day)).distinct()
        return queryset.order_by('scheduled_datetime' if date_str else '-created_at')
    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company: raise ValueError('Немає CRM-компанії для створення візиту.')
        visit = serializer.save(company=company)
        word = visit_word(company)
        log_activity(company=company, user=self.request.user, visit=visit, action_type='order_created' if is_store(company) else 'visit_created', title=f"Створено {word} №{visit.id}", description=f"Клієнт: {visit.client or 'Новий покупець'} · {visit.phone or 'без телефону'}", metadata={'client': visit.client, 'phone': visit.phone, 'status': visit.status})
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_status = instance.status
        old_scheduled = instance.scheduled_datetime
        old_delivery = instance.delivery_data or ''
        response = super().update(request, *args, **kwargs)
        try:
            instance.refresh_from_db(); company = instance.company; word = visit_word(company)
            if old_status != instance.status:
                action = 'order_status_changed' if is_store(company) else 'visit_status_changed'
                if is_store(company) and instance.status == 'CANCELLED': action = 'order_cancelled'
                if is_store(company) and instance.status == 'COMPLETED': action = 'order_completed'
                log_activity(company=company, user=request.user, visit=instance, action_type=action, title='Змінено статус', description=f"{word.capitalize()} №{instance.id}: {old_status} → {instance.status}", old_value=old_status, new_value=instance.status, metadata={'client': instance.client, 'phone': instance.phone})
            if old_scheduled != instance.scheduled_datetime:
                log_activity(company=company, user=request.user, visit=instance, action_type='visit_status_changed' if not is_store(company) else 'order_status_changed', title='Змінено дату запису', description=f"{old_scheduled or '—'} → {instance.scheduled_datetime or '—'}", old_value=old_scheduled, new_value=instance.scheduled_datetime)
            if is_store(company) and old_delivery != (instance.delivery_data or ''):
                action = 'ttn_added' if 'ttn' in str(instance.delivery_data or '').lower() or '204' in str(instance.delivery_data or '') else 'delivery_updated'
                log_activity(company=company, user=request.user, visit=instance, action_type=action, title='Оновлено доставку', description=f"Дані доставки у замовленні №{instance.id} оновлено", old_value=old_delivery, new_value=instance.delivery_data or '', metadata={'client': instance.client, 'phone': instance.phone})
        except Exception as exc: print(f'ACTIVITY: visit update log failed: {exc}')
        return response
    def partial_update(self, request, *args, **kwargs): kwargs['partial'] = True; return self.update(request, *args, **kwargs)
    def perform_destroy(self, instance):
        company = instance.company; word = visit_word(company)
        log_activity(company=company, user=self.request.user, visit=instance, action_type='order_cancelled' if is_store(company) else 'visit_cancelled', title=f"Скасовано/видалено {word} №{instance.id}", description=f"Клієнт: {instance.client or '—'} · {instance.phone or '—'}")
        instance.delete()
    @action(detail=True, methods=['get'], url_path='pdf')
    def export_pdf(self, request, pk=None):
        visit = self.get_object(); company = visit.company
        services = list(getattr(visit, 'services', OrderService.objects.none()).all())
        parts = list(getattr(visit, 'parts', OrderPart.objects.none()).all())
        services_total = sum((money_value(s.price) * money_value(s.quantity or 1) for s in services), Decimal('0.00'))
        parts_total = sum((money_value(p.sell_price) * money_value(p.quantity or 1) for p in parts), Decimal('0.00'))
        grand_total = services_total + parts_total
        comp_name = html_text(getattr(company, 'name', '') or 'АВТОСЕРВІС')
        comp_phone = html_text(getattr(company, 'phone', '') or '')
        comp_addr = html_text(getattr(company, 'address', '') or '')
        visit_dt = timezone.localtime(visit.scheduled_datetime or visit.created_at).strftime('%d.%m.%Y %H:%M')
        services_rows = ''.join(f"<tr><td>{html_text(s.name)}</td><td>{qty_display(s.quantity)}</td><td>{money_display(s.price)}</td><td>{money_display(money_value(s.price)*money_value(s.quantity or 1))}</td></tr>" for s in services)
        parts_rows = ''.join(f"<tr><td>{html_text(p.brand)}</td><td>{html_text(p.article)}</td><td>{html_text(p.name)}</td><td>{qty_display(p.quantity)}</td><td>{money_display(p.sell_price)}</td><td>{money_display(money_value(p.sell_price)*money_value(p.quantity or 1))}</td></tr>" for p in parts)
        html_content = f"""<!doctype html><html><head><meta charset='utf-8'><title>Сервісний звіт №{visit.id}</title><style>body{{font-family:Arial,sans-serif;margin:24px;color:#111827}}table{{width:100%;border-collapse:collapse;margin-top:14px}}th,td{{border:1px solid #e2e8f0;padding:8px;text-align:left}}th{{background:#f1f5f9}}.top{{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px}}.actions{{text-align:right;margin-bottom:14px}}button{{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:#2563eb;color:white}}</style></head><body><div class='actions'><button onclick='window.print()'>Друк / PDF</button></div><div class='top'><div><h2>{comp_name}</h2><p>{comp_addr}<br>{comp_phone}</p></div><div><h2>Сервісний звіт №{visit.id}</h2><p>{html_text(visit_dt)}</p></div></div><p><b>Клієнт:</b> {html_text(visit.client)} | <b>Тел:</b> {html_text(visit.phone)} | <b>Авто:</b> {html_text(visit.plate)} | <b>VIN:</b> {html_text(visit.vin_code)}</p>{'<h3>Роботи</h3><table><tr><th>Назва</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr>'+services_rows+'</table>' if services_rows else ''}{'<h3>Запчастини</h3><table><tr><th>Бренд</th><th>Артикул</th><th>Назва</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr>'+parts_rows+'</table>' if parts_rows else ''}<h2 style='text-align:right'>Разом: {money_display(grand_total)}</h2></body></html>"""
        return HttpResponse(html_content, content_type='text/html; charset=utf-8')

class CRMTaskSerializer(serializers.ModelSerializer):
    state = serializers.SerializerMethodField(); state_label = serializers.SerializerMethodField(); days_left = serializers.SerializerMethodField()
    class Meta:
        model = CRMTask
        fields = ['id','visit','client','phone','plate','title','description','due_date','status','state','state_label','days_left','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at']
    def get_days_left(self, obj): return None if not obj.due_date else (obj.due_date - timezone.localdate()).days
    def get_state(self, obj):
        if obj.status == CRMTask.STATUS_DONE: return 'done'
        if obj.status == CRMTask.STATUS_IN_PROGRESS: return 'in_progress'
        days = self.get_days_left(obj)
        if days is not None and days < 0: return 'overdue'
        return obj.status or 'new'
    def get_state_label(self, obj): return {'new':'Нова','in_progress':'В роботі','done':'Виконана','overdue':'Прострочена'}.get(self.get_state(obj), 'Нова')

class VehicleRecommendationViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleRecommendationSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = VehicleRecommendation.objects.filter(company=company) if company else VehicleRecommendation.objects.none()
        search = self.request.query_params.get('search', '').strip(); status_filter = self.request.query_params.get('status', '').strip(); visit_id = self.request.query_params.get('visit', '').strip()
        if search: queryset = queryset.filter(Q(client__icontains=search)|Q(phone__icontains=search)|Q(plate__icontains=search)|Q(title__icontains=search)|Q(description__icontains=search))
        if status_filter: queryset = queryset.filter(status=status_filter)
        if visit_id: queryset = queryset.filter(visit_id=visit_id)
        return queryset.order_by('status','due_date','-created_at')
    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company: raise ValueError('Немає CRM-компанії для створення рекомендації.')
        visit = None; visit_id = self.request.data.get('visit')
        if visit_id:
            try: visit = Visit.objects.get(id=visit_id, company=company)
            except Visit.DoesNotExist: visit = None
        defaults = {'client': self.request.data.get('client') or visit.client, 'phone': self.request.data.get('phone') or visit.phone, 'plate': self.request.data.get('plate') or visit.plate} if visit else {}
        serializer.save(company=company, created_by=self.request.user, **defaults)
    @action(detail=True, methods=['post'], url_path='mark-done')
    def mark_done(self, request, pk=None):
        rec = self.get_object(); rec.status = VehicleRecommendation.STATUS_DONE; rec.save(update_fields=['status','updated_at']); return Response(self.get_serializer(rec).data)

class CRMTaskViewSet(viewsets.ModelViewSet):
    serializer_class = CRMTaskSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self):
        company = safe_ensure_company(self.request.user); queryset = CRMTask.objects.filter(company=company) if company else CRMTask.objects.none()
        search = self.request.query_params.get('search', '').strip(); status_filter = self.request.query_params.get('status', '').strip(); visit_id = self.request.query_params.get('visit', '').strip()
        if search: queryset = queryset.filter(Q(client__icontains=search)|Q(phone__icontains=search)|Q(plate__icontains=search)|Q(title__icontains=search)|Q(description__icontains=search))
        if status_filter in ['new','in_progress','done','overdue']: queryset = queryset.filter(status=status_filter)
        if visit_id: queryset = queryset.filter(visit_id=visit_id)
        return queryset.order_by('status','due_date','-created_at')
    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company: raise ValueError('Немає CRM-компанії для створення задачі.')
        visit = None; visit_id = self.request.data.get('visit')
        if visit_id:
            try: visit = Visit.objects.get(id=visit_id, company=company)
            except Visit.DoesNotExist: visit = None
        defaults = {'client': self.request.data.get('client') or visit.client, 'phone': self.request.data.get('phone') or visit.phone, 'plate': self.request.data.get('plate') or visit.plate} if visit else {}
        serializer.save(company=company, created_by=self.request.user, **defaults)
    @action(detail=True, methods=['post'], url_path='mark-done')
    def mark_done(self, request, pk=None):
        task = self.get_object(); task.status = CRMTask.STATUS_DONE; task.save(update_fields=['status','updated_at']); return Response(self.get_serializer(task).data)

class OrderPartViewSet(viewsets.ModelViewSet):
    serializer_class = OrderPartSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        return OrderPart.objects.filter(visit__company=company) if company else OrderPart.objects.none()
    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user); visit = Visit.objects.get(id=self.request.data.get('visit'), company=company)
        supplier = self.request.data.get('supplier') or ''; is_local = self.request.data.get('is_local') is True or str(self.request.data.get('is_local')).lower() == 'true'
        supplier_color = normalize_supplier_badge_key(self.request.data.get('supplier_color'), supplier_name=supplier, is_local=is_local)
        part = serializer.save(visit=visit, supplier_color=supplier_color)
        log_activity(company=company, user=self.request.user, visit=visit, order_part=part, action_type='part_added', title='Додано товар' if is_store(company) else 'Додано запчастину', description=f"{part_label(part)} · {qty_display(part.quantity)} шт · продаж {money_display(part.sell_price)}", metadata={'supplier': part.supplier, 'buy_price': float(money_value(part.buy_price)), 'sell_price': float(money_value(part.sell_price))})
    def update(self, request, *args, **kwargs):
        instance = self.get_object(); old = {'quantity': instance.quantity, 'buy_price': instance.buy_price, 'sell_price': instance.sell_price, 'status': instance.status}
        response = super().update(request, *args, **kwargs)
        try:
            from .stock_reservations import sync_order_part_after_update
            instance.refresh_from_db(); sync_order_part_after_update(instance, old_quantity=old['quantity'])
            changes = []
            for field, label in [('quantity','кількість'),('buy_price','закупка'),('sell_price','продаж'),('status','статус')]:
                if str(old[field]) != str(getattr(instance, field)):
                    changes.append(f"{label}: {old[field]} → {getattr(instance, field)}")
            if changes:
                log_activity(company=instance.visit.company, user=request.user, visit=instance.visit, order_part=instance, action_type='part_status_changed' if str(old['status']) != str(instance.status) else 'part_updated', title='Оновлено товар' if is_store(instance.visit.company) else 'Оновлено запчастину', description=f"{part_label(instance)} · {'; '.join(changes)}", old_value=json.dumps(old, default=str, ensure_ascii=False), new_value=json.dumps({'quantity': instance.quantity, 'buy_price': instance.buy_price, 'sell_price': instance.sell_price, 'status': instance.status}, default=str, ensure_ascii=False))
        except Exception as exc: print(f'STOCK/ACTIVITY: order part update failed: {exc}')
        return response
    def partial_update(self, request, *args, **kwargs): kwargs['partial'] = True; return self.update(request, *args, **kwargs)
    def perform_destroy(self, instance):
        log_activity(company=instance.visit.company, user=self.request.user, visit=instance.visit, order_part=instance, action_type='part_deleted', title='Видалено товар' if is_store(instance.visit.company) else 'Видалено запчастину', description=f"{part_label(instance)} · {qty_display(instance.quantity)} шт")
        instance.delete()
    @action(detail=True, methods=['post'], url_path='return')
    def return_part(self, request, pk=None):
        part = self.get_object()
        try:
            from .stock_reservations import return_order_part_to_stock
            ok, message = return_order_part_to_stock(part, quantity=request.data.get('quantity'), reason=request.data.get('reason') or 'Повернення товару', comment=request.data.get('comment') or '', return_to_stock=request.data.get('return_to_stock') is not False)
            part.refresh_from_db()
            log_activity(company=part.visit.company, user=request.user, visit=part.visit, order_part=part, action_type='part_returned', title='Повернення товару' if is_store(part.visit.company) else 'Повернення запчастини', description=f"{part_label(part)} · {message}. Причина: {request.data.get('reason') or 'Повернення товару'}", metadata={'reason': request.data.get('reason') or '', 'comment': request.data.get('comment') or '', 'return_to_stock': request.data.get('return_to_stock') is not False})
            return Response({'ok': ok, 'message': message, 'part': self.get_serializer(part).data}, status=200 if ok else 400)
        except Exception as exc: return Response({'ok': False, 'message': str(exc)}, status=400)
    @action(detail=True, methods=['post'], url_path='delete-with-stock')
    def delete_with_stock(self, request, pk=None):
        part = self.get_object(); visit_id = part.visit_id; visit = part.visit; part_desc = f"{part_label(part)} · {qty_display(part.quantity)} шт"
        try:
            from .stock_reservations import delete_order_part_with_stock
            ok, message = delete_order_part_with_stock(part, stock_action=request.data.get('stock_action') or 'return', reason=request.data.get('reason') or 'Видалення позиції', comment=request.data.get('comment') or '')
            if not ok: return Response({'ok': False, 'message': message}, status=400)
            log_activity(company=visit.company, user=request.user, visit=visit, order_part=part, action_type='part_deleted', title='Видалено товар' if is_store(visit.company) else 'Видалено запчастину', description=f"{part_desc}. {message}", metadata={'stock_action': request.data.get('stock_action') or 'return', 'reason': request.data.get('reason') or 'Видалення позиції'})
            part.delete(); visit = Visit.objects.get(id=visit_id)
            return Response({'ok': True, 'message': 'Товар видалено', 'visit': VisitSerializer(visit).data})
        except Exception as exc: return Response({'ok': False, 'message': str(exc)}, status=400)

class OrderServiceViewSet(viewsets.ModelViewSet):
    serializer_class = OrderServiceSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self):
        company = safe_ensure_company(self.request.user); return OrderService.objects.filter(visit__company=company) if company else OrderService.objects.none()
    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user); visit = Visit.objects.get(id=self.request.data.get('visit'), company=company); service = serializer.save(visit=visit)
        log_activity(company=company, user=self.request.user, visit=visit, action_type='service_added', title='Додано роботу', description=f"{service.name} · {qty_display(service.quantity)} · {money_display(service.price)}")
    def update(self, request, *args, **kwargs):
        instance = self.get_object(); old = {'name': instance.name, 'price': instance.price, 'quantity': instance.quantity, 'status': getattr(instance, 'status', '')}
        response = super().update(request, *args, **kwargs)
        try:
            instance.refresh_from_db(); changes = []
            for field, label in [('name','назва'),('price','ціна'),('quantity','кількість'),('status','статус')]:
                if hasattr(instance, field) and str(old.get(field)) != str(getattr(instance, field)): changes.append(f"{label}: {old.get(field)} → {getattr(instance, field)}")
            if changes: log_activity(company=instance.visit.company, user=request.user, visit=instance.visit, action_type='service_updated', title='Оновлено роботу', description=f"{instance.name} · {'; '.join(changes)}", old_value=json.dumps(old, default=str, ensure_ascii=False))
        except Exception as exc: print(f'ACTIVITY: service update failed: {exc}')
        return response
    def partial_update(self, request, *args, **kwargs): kwargs['partial'] = True; return self.update(request, *args, **kwargs)
    def perform_destroy(self, instance):
        log_activity(company=instance.visit.company, user=self.request.user, visit=instance.visit, action_type='service_deleted', title='Видалено роботу', description=f"{instance.name} · {qty_display(instance.quantity)} · {money_display(instance.price)}")
        instance.delete()

class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): company = safe_ensure_company(self.request.user); return ServiceCatalog.objects.filter(company=company) if company else ServiceCatalog.objects.none()
    def perform_create(self, serializer): company = safe_ensure_company(self.request.user); serializer.save(company=company)
class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): company = safe_ensure_company(self.request.user); return Category.objects.filter(company=company) if company else Category.objects.none()
    def perform_create(self, serializer): company = safe_ensure_company(self.request.user); serializer.save(company=company)
class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): company = safe_ensure_company(self.request.user); return InventoryItem.objects.filter(company=company) if company else InventoryItem.objects.none()
    def perform_create(self, serializer): company = safe_ensure_company(self.request.user); item = serializer.save(company=company); log_activity(company=company, user=self.request.user, inventory_item=item, action_type='stock_adjusted', title='Створено товар на складі', description=f"{item.brand} {item.article} · {item.quantity} шт")
class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer; permission_classes = [IsAuthenticated]
    def get_queryset(self): company = safe_ensure_company(self.request.user); return Supplier.objects.filter(company=company) if company else Supplier.objects.none()
    def perform_create(self, serializer): company = safe_ensure_company(self.request.user); serializer.save(company=company)
class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    def list(self, request):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'): return Response(status=403)
        mechanics = Employee.objects.filter(company=company, role='mechanic')
        return Response([{'id': m.user.id, 'username': m.user.username, 'first_name': m.user.first_name, 'can_create_visits': m.can_create_visits, 'can_view_finances': m.can_view_finances} for m in mechanics])
    def create(self, request):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'): return Response(status=403)
        username = request.data.get('username'); password = request.data.get('password'); first_name = request.data.get('first_name')
        if User.objects.filter(username=username).exists(): return Response({'error': 'Логін зайнятий'}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=user, company=company, role='mechanic', can_create_visits=request.data.get('can_create_visits') is True, can_view_finances=request.data.get('can_view_finances') is True)
            return Response({'message': 'Створено'}, status=201)
        except Exception as exc: return Response({'error': str(exc)}, status=500)
    def partial_update(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=company); employee = user.employee_profile
            if request.data.get('first_name'): user.first_name = request.data.get('first_name')
            if request.data.get('new_password'): user.set_password(request.data.get('new_password'))
            user.save()
            if 'can_create_visits' in request.data: employee.can_create_visits = request.data.get('can_create_visits') is True
            if 'can_view_finances' in request.data: employee.can_view_finances = request.data.get('can_view_finances') is True
            employee.save(); return Response({'message':'Оновлено'})
        except User.DoesNotExist: return Response(status=404)
    def destroy(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company or not hasattr(request.user, 'company'): return Response(status=403)
        try: User.objects.get(id=pk, employee_profile__company=company).delete(); return Response({'message':'Видалено'})
        except User.DoesNotExist: return Response(status=404)
