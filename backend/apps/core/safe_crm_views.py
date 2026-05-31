from datetime import datetime, timedelta, time as dt_time

from django.contrib.auth.models import User
from django.db.models import Q
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
                    import json
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
