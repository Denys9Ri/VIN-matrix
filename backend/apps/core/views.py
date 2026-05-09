from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Company, Visit, ServiceCatalog
from .serializers import (
    VisitSerializer, UserSerializer, 
    CompanySerializer, ServiceCatalogSerializer
)

# 1. ВІЗИТИ (МАШИНИ)
class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Visit.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

# 2. КАТАЛОГ ПОСЛУГ ТА ЦІН (Налаштування клієнта)
class ServiceCatalogViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCatalogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Кожен бачить тільки свій прайс
        return ServiceCatalog.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)

# 3. РЕДАГУВАННЯ ПРОФІЛЮ ТА СТО
class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Повертаємо дані про юзера та його СТО
        user_serializer = UserSerializer(request.user)
        company_serializer = CompanySerializer(request.user.company)
        return Response({
            "user": user_serializer.data,
            "company": company_serializer.data
        })

    def patch(self, request):
        user = request.user
        company = user.company

        # Оновлюємо дані користувача (email, ім'я)
        user_data = request.data.get('user', {})
        user_serializer = UserSerializer(user, data=user_data, partial=True)
        
        # Оновлюємо назву СТО
        company_data = request.data.get('company', {})
        company_serializer = CompanySerializer(company, data=company_data, partial=True)

        if user_serializer.is_valid() and company_serializer.is_valid():
            user_serializer.save()
            company_serializer.save()
            return Response({"message": "Дані успішно оновлено!"})
        
        return Response({"error": "Помилка валідації"}, status=400)

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

# 5. ВИХІД (LOGOUT)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist() # Додаємо токен у чорний список
            return Response({"message": "Вихід успішний"}, status=205)
        except Exception as e:
            return Response({"error": "Помилка при виході"}, status=400)

# 6. ЗМІНА ПАРОЛЯ
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        
        # Перевіряємо старий пароль
        if not request.user.check_password(old_password):
            return Response({"error": "Старий пароль невірний"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Встановлюємо новий
        request.user.set_password(new_password)
        request.user.save()
        return Response({"message": "Пароль успішно змінено!"}, status=status.HTTP_200_OK)
