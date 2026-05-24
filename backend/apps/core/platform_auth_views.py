import re

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .partner_views import (
    ensure_user_company,
    find_partner_by_code,
    generate_client_code,
    get_default_assigned_owner,
    normalize_code,
)
from .models import PlatformClient
from .subscriptions import activate_trial

USERNAME_RE = re.compile(r'^(?=(?:.*[A-Za-z]){4,})(?=.*[A-Z])(?=.*\d)[A-Za-z\d]+$')
PASSWORD_RE = re.compile(r'^(?=(?:.*[A-Za-z]){4,})(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def validate_registration(username, password, full_name, phone, email):
    if not full_name:
        return 'ПІБ обовʼязкове.'
    if not phone:
        return 'Номер телефону обовʼязковий.'
    if not username or not password:
        return 'Логін і пароль обовʼязкові.'
    if not USERNAME_RE.match(username):
        return 'Логін має містити мінімум 4 англійські букви, мінімум одну велику букву і мінімум одну цифру. Без пробілів і спецсимволів.'
    if not PASSWORD_RE.match(password):
        return 'Пароль має містити мінімум 8 символів, мінімум 4 англійські букви, одну велику букву, цифру і спецсимвол.'
    if email and not EMAIL_RE.match(email):
        return 'Email введено некоректно.'
    return None


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip()
        phone = (request.data.get('phone') or '').strip()
        email = (request.data.get('email') or '').strip()
        company_name = (request.data.get('company_name') or '').strip()
        partner_code = normalize_code(
            request.data.get('partner_code')
            or request.data.get('referral_code')
            or request.data.get('representative_code')
            or request.data.get('client_code')
            or ''
        )

        validation_error = validate_registration(username, password, full_name, phone, email)
        if validation_error:
            return Response({'error': validation_error}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий.'}, status=400)

        partner = None
        if partner_code:
            partner = find_partner_by_code(partner_code)
            if not partner:
                return Response({'error': 'Код партнера не знайдено.'}, status=400)

        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password, first_name=full_name, email=email)
            ensure_user_company(user, company_name or full_name or username)
            owner = partner.user if partner else get_default_assigned_owner(exclude_user=user)
            client = PlatformClient.objects.create(
                user=user,
                client_code=generate_client_code(),
                phone=phone,
                assigned_owner=owner,
                referred_by=owner,
                payment_status=PlatformClient.PAYMENT_TRIAL,
                is_access_enabled=True,
            )
            activate_trial(client)

        return Response({'message': 'Акаунт створено. Пробний доступ активовано на 14 днів.'}, status=201)
