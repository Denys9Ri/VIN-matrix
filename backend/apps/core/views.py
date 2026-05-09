from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Company, Visit, ServiceCatalog, Employee
from .serializers import (
    VisitSerializer, UserSerializer, 
    CompanySerializer, ServiceCatalogSerializer
)

# Функція для визначення компанії (чи це Власник, чи Майстер)
def get_user_company(user):
    if hasattr(user, 'company'):
        return user.company
    if hasattr(user, 'employee_profile'):
        return user.employee_profile.company
    return None

# 1. ВІЗИТИ (МАШИНИ)
class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Visit.objects.filter(company=get_user_company(self.request.user))

    def perform_create(self, serializer):
        serializer.save(company=get_user_company(self.request.user))

# 2. КАТАЛОГ ПОСЛУГ ТА ЦІН
class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ServiceCatalog.objects.filter(company=get_user_company(self.request.user))

    def perform_create(self, serializer):
        serializer.save(company=get_user_company(self.request.user))

# 3. РЕДАГУВАННЯ ПРОФІЛЮ ТА СТО
class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request):
        company = get_user_company(request.user)
        role = 'owner' if hasattr(request.user, 'company') else 'mechanic'

        user_serializer = UserSerializer(request.user)
        company_serializer = CompanySerializer(company, context={'request': request})
        
        return Response({
            "user": user_serializer.data,
            "company": company_serializer.data,
            "role": role # Повертаємо роль на фронтенд
        })

    def patch(self, request):
        if not hasattr(request.user, 'company'):
            return Response({"error": "Тільки власник може змінювати налаштування"}, status=403)

        user = request.user
        company = user.company

        # Обробка даних користувача
        first_name = request.data.get('user[first_name]') or request.data.get('first_name')
        email = request.data.get('user[email]') or request.data.get('email')
        
        if first_name: user.first_name = first_name
        if email: user.email = email
        user.save()

        # Обробка даних компанії
        name = request.data.get('company[name]') or request.data.get('name')
        if name: company.name = name
        
        if 'company[phone]' in request.data: company.phone = request.data.get('company[phone]')
        if 'company[address]' in request.data: company.address = request.data.get('company[address]')
        if 'company[document_footer]' in request.data: company.document_footer = request.data.get('company[document_footer]')
        if 'company[global_margin_percent]' in request.data: company.global_margin_percent = request.data.get('company[global_margin_percent]')
        
        # Обробка ЛОГОТИПА
        logo = request.data.get('company[logo]')
        if logo:
            company.logo = logo

        company.save()
        return Response({"message": "Дані успішно оновлено!"})

# ДОДАВАННЯ МАЙСТРА
class MechanicCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not hasattr(request.user, 'company'):
            return Response({"error": "Тільки власник може додавати майстрів!"}, status=403)

        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name')

        if not username or not password or not first_name:
            return Response({"error": "Всі поля обов'язкові!"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Такий логін вже зайнятий!"}, status=400)

        try:
            new_user = User.objects.create_user(username=username, password=password, first_name=first_name)
            Employee.objects.create(user=new_user, company=request.user.company, role='mechanic')
            return Response({"message": "Майстра успішно додано!"}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 4. РЕЄСТРАЦІЯ
class RegisterView(APIView):
    permission_classes = [AllowAny] 

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        company_name = request.data.get('company_name')

        if not username or not password or not company_name:
            return Response({"error": "Всі поля обов'язкові!"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Логін зайнятий!"}, status=400)

        try:
            user = User.objects.create_user(username=username, password=password)
            Company.objects.create(name=company_name, owner=user)
            return Response({"message": "Успішно зареєстровано!"}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# 5. ВИХІД
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Вихід успішний"}, status=205)
        except Exception as e:
            return Response({"error": "Помилка при виході"}, status=400)

# 6. ЗМІНА ПАРОЛЯ
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        if not request.user.check_password(old_password):
            return Response({"error": "Старий пароль невірний"}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save()
        return Response({"message": "Пароль успішно змінено!"}, status=status.HTTP_200_OK)
