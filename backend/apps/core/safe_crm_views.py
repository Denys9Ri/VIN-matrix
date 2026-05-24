from datetime import datetime, timedelta, time as dt_time

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Category, Company, Employee, InventoryItem, OrderPart, OrderService, ServiceCatalog, Supplier, Visit
from .serializers import (
    CategorySerializer,
    InventoryItemSerializer,
    OrderPartSerializer,
    OrderServiceSerializer,
    ServiceCatalogSerializer,
    SupplierSerializer,
    VisitSerializer,
)
from .views import VisitViewSet as BaseVisitViewSet, SupplierViewSet as BaseSupplierViewSet


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


class VisitViewSet(BaseVisitViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
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
        company = safe_get_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення візиту.')
        serializer.save(company=company)


class OrderPartViewSet(viewsets.ModelViewSet):
    serializer_class = OrderPartSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        return OrderPart.objects.filter(visit__company=company) if company else OrderPart.objects.none()

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=company)
        serializer.save(visit=visit)


class OrderServiceViewSet(viewsets.ModelViewSet):
    serializer_class = OrderServiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        return OrderService.objects.filter(visit__company=company) if company else OrderService.objects.none()

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=company)
        serializer.save(visit=visit)


class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        return ServiceCatalog.objects.filter(company=company) if company else ServiceCatalog.objects.none()

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення послуги.')
        serializer.save(company=company)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        return Category.objects.filter(company=company) if company else Category.objects.none()

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення категорії.')
        serializer.save(company=company)


class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        queryset = InventoryItem.objects.filter(company=company) if company else InventoryItem.objects.none()
        cat_id = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if cat_id:
            queryset = queryset.filter(category_id=cat_id)
        if search:
            queryset = queryset.filter(Q(article__icontains=search) | Q(name__icontains=search) | Q(brand__icontains=search))
        return queryset

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення товару.')
        serializer.save(company=company)


class SupplierViewSet(BaseSupplierViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_get_company(self.request.user)
        return Supplier.objects.filter(company=company) if company else Supplier.objects.none()

    def perform_create(self, serializer):
        company = safe_get_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення постачальника.')
        serializer.save(company=company)


class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        company = safe_get_company(request.user)
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
        company = safe_get_company(request.user)
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
        company = safe_get_company(request.user)
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
        company = safe_get_company(request.user)
        if not company:
            return Response({'error': 'Немає CRM-компанії.'}, status=403)
        try:
            employee = Employee.objects.get(user_id=pk, company=company)
            employee.user.delete()
            return Response({'message': 'Видалено'})
        except Employee.DoesNotExist:
            return Response(status=404)
