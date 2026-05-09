from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from .models import Company

class RegisterView(APIView):
    # Дозволяємо доступ всім (щоб не треба було токена для реєстрації)
    permission_classes = [AllowAny] 

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        company_name = request.data.get('company_name')

        # Перевірка, чи всі поля заповнені
        if not username or not password or not company_name:
            return Response({"error": "Всі поля (логін, пароль, назва СТО) обов'язкові!"}, status=400)

        # Перевірка, чи не зайнятий логін
        if User.objects.filter(username=username).exists():
            return Response({"error": "Користувач з таким логіном вже існує!"}, status=400)

        try:
            # 1. Створюємо користувача
            user = User.objects.create_user(username=username, password=password)
            # 2. ОДРАЗУ створюємо компанію і прив'язуємо до цього користувача
            Company.objects.create(name=company_name, owner=user)
            
            return Response({"message": "СТО успішно зареєстровано!"}, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
