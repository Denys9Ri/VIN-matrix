from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from .models import Company, Visit
from .serializers import VisitSerializer # Переконайся, що цей імпорт є

# 1. КОНТРОЛЕР ДЛЯ ВІЗИТІВ (МАШИН)
class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Кожне СТО бачить тільки свої візити
        return Visit.objects.filter(company=self.request.user.company)

    def perform_create(self, serializer):
        # При створенні візиту, він автоматично прив'язується до СТО
        serializer.save(company=self.request.user.company)

# 2. КОНТРОЛЕР ДЛЯ РЕЄСТРАЦІЇ НОВОГО СТО
class RegisterView(APIView):
    permission_classes = [AllowAny] 

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        company_name = request.data.get('company_name')

        if not username or not password or not company_name:
            return Response({"error": "Всі поля (логін, пароль, назва СТО) обов'язкові!"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Користувач з таким логіном вже існує!"}, status=400)

        try:
            # Створюємо юзера
            user = User.objects.create_user(username=username, password=password)
            # Створюємо СТО і прив'язуємо до юзера
            Company.objects.create(name=company_name, owner=user)
            
            return Response({"message": "СТО успішно зареєстровано!"}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
