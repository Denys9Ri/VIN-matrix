from datetime import datetime, timedelta, time as dt_time

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, Employee, InventoryItem, OrderPart, OrderService, ServiceCatalog, Supplier, Visit, VehicleRecommendation
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


BM_PARTS_BADGE_CLASS = 'bg-[linear-gradient(90deg,#d71920_0_34%,#e5e7eb_34%_52%,#ffffff_52%_100%)] text-slate-900 border border-slate-300 shadow-md shadow-slate-200 whitespace-nowrap'


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
    if is_local:
        return 'bg-slate-800 text-white whitespace-nowrap'
    name = str(supplier_name or '').upper()
    if 'VESNA' in name or 'ВЕСНА' in name:
        return 'bg-emerald-600 text-white shadow-md shadow-emerald-200 whitespace-nowrap'
    if 'OMEGA' in name or 'ОМЕГА' in name:
        return 'bg-blue-600 text-white shadow-md shadow-blue-200 whitespace-nowrap'
    if 'TEHNO' in name or 'ТЕХНО' in name:
        return 'bg-rose-600 text-white shadow-md shadow-rose-200 whitespace-nowrap'
    if 'BM' in name or 'BM-PARTS' in name or 'BM PARTS' in name:
        return BM_PARTS_BADGE_CLASS
    return 'bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap'


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
        supplier_color = self.request.data.get('supplier_color') or supplier_badge_class(supplier, self.request.data.get('is_local') is True)
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
        queryset = InventoryItem.objects.filter(company=company) if company else InventoryItem.objects.none()
        cat_id = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if cat_id:
            queryset = queryset.filter(category_id=cat_id)
        if search:
            queryset = queryset.filter(Q(article__icontains=search) | Q(name__icontains=search) | Q(brand__icontains=search))
        return queryset

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

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as exc:
            return Response([], status=200)

    def create(self, request, *args, **kwargs):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії для створення постачальника.'}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = serializer.save(company=company)
        return Response(self.get_serializer(supplier).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        try:
            supplier = self.get_object()
            serializer = self.get_serializer(supplier, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            supplier = serializer.save()
            return Response(self.get_serializer(supplier).data)
        except Exception as exc:
            return Response({'error': 'Не вдалося оновити постачальника', 'details': str(exc)}, status=400)

    def destroy(self, request, *args, **kwargs):
        try:
            supplier = self.get_object()
            supplier.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            return Response({'error': 'Не вдалося видалити постачальника', 'details': str(exc)}, status=400)

    @action(detail=True, methods=['post'], url_path='fetch_warehouses')
    def fetch_warehouses(self, request, pk=None):
        # Тимчасово повертаємо пустий список, щоб кабінет клієнта/партнера не падав.
        return Response({'message': 'Склади не завантажені автоматично для цього постачальника.', 'warehouses': []})


class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        company = safe_ensure_company(self.request.user)
        if not company:
            return Response([])
        mechanics = Employee.objects.filter(company=company, role='mechanic')
        data = [{
            'id': m.user.id,
            'username': m.user.username,
            'first_name': m.user.first_name,
            'can_create_visits': m.can_create_visits,
            'can_view_finances': m.can_view_finances,
        } for m in mechanics]
        return Response(data)

    def create(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=403)

        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        can_create = request.data.get('can_create_visits') is True
        can_view = request.data.get('can_view_finances') is True

        from django.contrib.auth.models import User
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий'}, status=400)
        user = User.objects.create_user(username=username, password=password, first_name=first_name)
        Employee.objects.create(user=user, company=company, role='mechanic', can_create_visits=can_create, can_view_finances=can_view)
        return Response({'message': 'Створено'}, status=201)

    def partial_update(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=403)
        try:
            user = Employee.objects.get(user_id=pk, company=company).user
            emp = user.employee_profile
            if request.data.get('first_name'):
                user.first_name = request.data.get('first_name')
            if request.data.get('new_password'):
                user.set_password(request.data.get('new_password'))
            user.save()
            if 'can_create_visits' in request.data:
                emp.can_create_visits = request.data.get('can_create_visits') is True
            if 'can_view_finances' in request.data:
                emp.can_view_finances = request.data.get('can_view_finances') is True
            emp.save()
            return Response({'message': 'Оновлено'})
        except Employee.DoesNotExist:
            return Response(status=404)

    def destroy(self, request, pk=None):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=403)
        try:
            employee = Employee.objects.get(user_id=pk, company=company)
            employee.user.delete()
            return Response({'message': 'Видалено'})
        except Employee.DoesNotExist:
            return Response(status=404)
