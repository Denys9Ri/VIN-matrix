from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from django.utils import timezone
from datetime import datetime, timedelta, time as dt_time
from .models import Company, Visit, ServiceCatalog, Employee, OrderPart, OrderService
from .models import Category, InventoryItem, Supplier
from .serializers import CategorySerializer, InventoryItemSerializer, SupplierSerializer
from .serializers import (
    VisitSerializer, UserSerializer, 
    CompanySerializer, ServiceCatalogSerializer,
    OrderPartSerializer, OrderServiceSerializer
)

def get_user_company(user):
    if hasattr(user, 'company'): return user.company
    if hasattr(user, 'employee_profile'): return user.employee_profile.company
    return None

class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self): 
        company = get_user_company(self.request.user)
        queryset = Visit.objects.filter(company=company)
        
        if self.action != 'list':
            return queryset
        
        search = self.request.query_params.get('search', '').strip()
        date_str = self.request.query_params.get('date', '').strip()
        history_mode = self.request.query_params.get('history', '').strip()
        
        if history_mode == 'true':
            if search:
                queryset = queryset.filter(
                    Q(plate__icontains=search) | 
                    Q(vin_code__icontains=search) | # ДОДАНО ПОШУК ПО VIN
                    Q(client__icontains=search) | 
                    Q(phone__icontains=search)
                )
            return queryset.order_by('-created_at')

        if search:
            queryset = queryset.filter(
                Q(plate__icontains=search) | 
                Q(vin_code__icontains=search) | # ДОДАНО ПОШУК ПО VIN
                Q(client__icontains=search) | 
                Q(phone__icontains=search)
            )
            return queryset.order_by('-created_at')
            
        elif date_str and len(date_str) == 10:
            try:
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                start_of_day = timezone.make_aware(datetime.combine(parsed_date, dt_time.min))
                end_of_day = start_of_day + timedelta(days=1)

                queryset = queryset.filter(
                    (Q(scheduled_datetime__gte=start_of_day) & Q(scheduled_datetime__lt=end_of_day)) |
                    (Q(scheduled_datetime__isnull=True) & Q(created_at__gte=start_of_day) & Q(created_at__lt=end_of_day))
                ).distinct()
                return queryset.order_by('scheduled_datetime')
            except Exception:
                pass
                
        today = timezone.localdate()
        start_of_today = timezone.make_aware(datetime.combine(today, dt_time.min))
        end_of_today = start_of_today + timedelta(days=1)

        queryset = queryset.filter(
            ( ~Q(status='DONE') & Q(scheduled_datetime__lt=end_of_today) ) | 
            ( ~Q(status='DONE') & Q(scheduled_datetime__isnull=True) ) | 
            ( Q(status='DONE') & Q(updated_at__gte=start_of_today) & Q(updated_at__lt=end_of_today) ) 
        ).distinct()
            
        return queryset.order_by('scheduled_datetime') 

    def perform_create(self, serializer): 
        serializer.save(company=get_user_company(self.request.user))

class OrderPartViewSet(viewsets.ModelViewSet):
    serializer_class = OrderPartSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return OrderPart.objects.filter(visit__company=get_user_company(self.request.user))
    def perform_create(self, serializer):
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=get_user_company(self.request.user))
        serializer.save(visit=visit)

class OrderServiceViewSet(viewsets.ModelViewSet):
    serializer_class = OrderServiceSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return OrderService.objects.filter(visit__company=get_user_company(self.request.user))
    def perform_create(self, serializer):
        visit = Visit.objects.get(id=self.request.data.get('visit'), company=get_user_company(self.request.user))
        serializer.save(visit=visit)

class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return ServiceCatalog.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    def get(self, request):
        company = get_user_company(request.user)
        role = 'owner' if hasattr(request.user, 'company') else 'mechanic'
        user_serializer = UserSerializer(request.user)
        company_serializer = CompanySerializer(company, context={'request': request})
        return Response({ "user": user_serializer.data, "company": company_serializer.data, "role": role })
    def patch(self, request):
        if not hasattr(request.user, 'company'): return Response({"error": "Тільки власник"}, status=403)
        user = request.user
        company = user.company
        first_name = request.data.get('user[first_name]') or request.data.get('first_name')
        email = request.data.get('user[email]') or request.data.get('email')
        if first_name: user.first_name = first_name
        if email: user.email = email
        user.save()
        name = request.data.get('company[name]') or request.data.get('name')
        if name: company.name = name
        if 'company[phone]' in request.data: company.phone = request.data.get('company[phone]')
        if 'company[address]' in request.data: company.address = request.data.get('company[address]')
        if 'company[document_footer]' in request.data: company.document_footer = request.data.get('company[document_footer]')
        if 'company[global_margin_percent]' in request.data: company.global_margin_percent = request.data.get('company[global_margin_percent]')
        logo = request.data.get('company[logo]')
        if logo: company.logo = logo
        company.save()
        return Response({"message": "Дані успішно оновлено!"})

class MechanicViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    def list(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        mechanics = Employee.objects.filter(company=request.user.company, role='mechanic')
        data = [{"id": m.user.id, "username": m.user.username, "first_name": m.user.first_name} for m in mechanics]
        return Response(data)
    def create(self, request):
        if not hasattr(request.user, 'company'): return Response(status=403)
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        if User.objects.filter(username=username).exists(): return Response({"error": "Логін зайнятий"}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=user, company=request.user.company, role='mechanic')
            return Response({"message": "Створено"}, status=201)
        except Exception as e: return Response({"error": str(e)}, status=500)
    def partial_update(self, request, pk=None):
        if not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=request.user.company)
            if request.data.get('first_name'): user.first_name = request.data.get('first_name')
            if request.data.get('new_password'): user.set_password(request.data.get('new_password'))
            user.save()
            return Response({"message": "Оновлено"})
        except User.DoesNotExist: return Response(status=404)
    def destroy(self, request, pk=None):
        if not hasattr(request.user, 'company'): return Response(status=403)
        try:
            user = User.objects.get(id=pk, employee_profile__company=request.user.company)
            user.delete()
            return Response({"message": "Видалено"})
        except User.DoesNotExist: return Response(status=404)

class RegisterView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        company_name = request.data.get('company_name')
        if not username or not password or not company_name: return Response({"error": "Всі поля обов'язкові!"}, status=400)
        if User.objects.filter(username=username).exists(): return Response({"error": "Логін зайнятий!"}, status=400)
        try:
            user = User.objects.create_user(username=username, password=password)
            Company.objects.create(name=company_name, owner=user)
            return Response({"message": "Успішно зареєстровано!"}, status=201)
        except Exception as e: return Response({"error": str(e)}, status=500)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Вихід успішний"}, status=205)
        except Exception as e: return Response({"error": "Помилка при виході"}, status=400)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        if not request.user.check_password(old_password): return Response({"error": "Старий пароль невірний"}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response({"message": "Пароль змінено!"}, status=200)

class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): return Category.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self): 
        queryset = InventoryItem.objects.filter(company=get_user_company(self.request.user))
        cat_id = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if cat_id: queryset = queryset.filter(category_id=cat_id)
        if search: queryset = queryset.filter(Q(article__icontains=search) | Q(name__icontains=search) | Q(brand__icontains=search))
        return queryset
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))

class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    def get_queryset(self): return Supplier.objects.filter(company=get_user_company(self.request.user))
    def perform_create(self, serializer): serializer.save(company=get_user_company(self.request.user))
