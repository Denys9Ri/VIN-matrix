from datetime import timedelta
import re

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .account_delete import hard_delete_account
from .models import Company, Employee, PlatformClient, Supplier
from .platform_client_base import BasePlatformClientViewSet
from .serializers import CompanySerializer, PlatformClientSerializer, UserSerializer
from .subscriptions import activate_trial, renew_client_30_days, subscription_payload, get_alert_clients, sync_client_subscription

ADMIN_CODE = 'A6000'
PARTNER_CODE_START = 6001
CLIENT_CODE_START = 6002
USERNAME_RE = re.compile(r'^(?=(?:.*[A-Za-z]){4,})(?=.*[A-Z])(?=.*\d)[A-Za-z\d]+$')
PASSWORD_RE = re.compile(r'^(?=(?:.*[A-Za-z]){4,})(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
# Compatibility for legacy billing imports. It intentionally contains no identities.
PLATFORM_ADMIN_USERNAMES = frozenset()


def is_main_admin(user):
    """Platform authority is a database role, never a username written in source code."""
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def get_employee(user):
    try:
        return user.employee_profile
    except Exception:
        return None


def get_company(user):
    try:
        return user.company
    except Exception:
        return None


def get_platform_client(user):
    try:
        return user.platform_client_profile
    except Exception:
        return None


def is_partner_user(user):
    emp = get_employee(user)
    return bool(emp and emp.role == 'partner')


def is_mechanic_user(user):
    emp = get_employee(user)
    return bool(emp and emp.role == 'mechanic')


def is_platform_admin(user):
    return is_main_admin(user)


def detect_role(user):
    if is_platform_admin(user):
        return 'admin'
    emp = get_employee(user)
    if emp and emp.role == 'partner':
        return 'partner'
    if emp and emp.role == 'mechanic':
        return 'mechanic'
    return 'client'


def get_user_company(user):
    company = get_company(user)
    if company:
        return company
    emp = get_employee(user)
    if emp:
        return emp.company
    return None


def create_default_suppliers(company):
    if not company:
        return
    existing = set(Supplier.objects.filter(company=company).values_list('name', flat=True))
    for name in ['Vesna-auto', 'Omega', 'Technomir']:
        if name not in existing:
            Supplier.objects.create(company=company, name=name, api_key='')


def ensure_user_company(user, company_name=None):
    company = get_company(user)
    if company:
        create_default_suppliers(company)
        return company
    title = (company_name or user.first_name or user.username or 'CRM').strip()
    try:
        company = Company.objects.create(name=f'{title} CRM' if title == user.username else title, owner=user, business_type='sto')
    except IntegrityError:
        company = get_company(user)
    create_default_suppliers(company)
    return company


def normalize_code(code):
    return (code or '').strip().upper().replace(' ', '')


def _used_numeric_codes():
    used = {6000}
    for code in Employee.objects.filter(role='partner', partner_code__isnull=False).values_list('partner_code', flat=True):
        code = normalize_code(code)
        if code.startswith('P') and code[1:].isdigit():
            used.add(int(code[1:]))
    for code in PlatformClient.objects.exclude(client_code__isnull=True).values_list('client_code', flat=True):
        try:
            used.add(int(code))
        except (TypeError, ValueError):
            pass
    return used


def next_free_code(start):
    used = _used_numeric_codes()
    candidate = int(start)
    while candidate in used:
        candidate += 1
    return candidate


def generate_partner_code():
    return f'P{next_free_code(PARTNER_CODE_START)}'


def generate_client_code():
    return next_free_code(CLIENT_CODE_START)


def find_partner_by_code(code):
    normalized = normalize_code(code)
    if not normalized:
        return None
    return Employee.objects.filter(role='partner', partner_code__iexact=normalized).select_related('user', 'company').first()


def get_default_assigned_owner(exclude_user=None):
    qs = User.objects.filter(is_active=True, is_staff=True).order_by('id')
    if exclude_user:
        qs = qs.exclude(id=exclude_user.id)
    return qs.first()


def repair_legacy_account(user):
    if not user or not user.is_authenticated:
        return None
    if is_platform_admin(user):
        return None
    try:
        client = user.platform_client_profile
    except Exception:
        client = None
    if client:
        return client
    company = get_user_company(user)
    if not company:
        return None
    try:
        owner = company.owner
    except Exception:
        return None
    if owner == user:
        return PlatformClient.objects.filter(user=owner).first()
    return PlatformClient.objects.filter(user=owner).first()


class PartnerManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def _require_admin(self, request):
        if not is_platform_admin(request.user):
            return Response({'error': 'Доступ лише для адміністратора.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def list(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        partners = Employee.objects.filter(role='partner').select_related('user', 'company').order_by('id')
        data = []
        for partner in partners:
            clients = PlatformClient.objects.filter(referred_by=partner.user).select_related('user')
            data.append({
                'id': partner.id,
                'name': partner.user.first_name or partner.user.username,
                'username': partner.user.username,
                'partner_code': partner.partner_code,
                'company_name': partner.company.name if partner.company else '',
                'client_count': clients.count(),
                'active_count': clients.filter(is_access_enabled=True).count(),
                'is_active': partner.user.is_active,
            })
        return Response(data)

    def create(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip()
        phone = (request.data.get('phone') or '').strip()
        email = (request.data.get('email') or '').strip()
        company_name = (request.data.get('company_name') or '').strip()
        partner_code = normalize_code(request.data.get('partner_code') or '') or generate_partner_code()

        if not full_name or not username or not password:
            return Response({'error': 'ПІБ, логін і пароль обовʼязкові.'}, status=400)
        if not USERNAME_RE.match(username):
            return Response({'error': 'Логін має містити мінімум 4 англійські букви, одну велику букву і цифру.'}, status=400)
        if not PASSWORD_RE.match(password):
            return Response({'error': 'Пароль має містити мінімум 8 символів, одну велику букву, цифру і спецсимвол.'}, status=400)
        if email and not EMAIL_RE.match(email):
            return Response({'error': 'Email введено некоректно.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий.'}, status=400)
        if Employee.objects.filter(partner_code__iexact=partner_code).exists():
            return Response({'error': 'Код партнера вже зайнятий.'}, status=400)

        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password, first_name=full_name, email=email)
            company = ensure_user_company(user, company_name or full_name)
            company.phone = phone
            company.save(update_fields=['phone'])
            partner = Employee.objects.create(user=user, company=company, role='partner', partner_code=partner_code)
        return Response({'id': partner.id, 'partner_code': partner.partner_code}, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        partner = Employee.objects.filter(id=pk, role='partner').select_related('user', 'company').first()
        if not partner:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        return Response({
            'id': partner.id,
            'name': partner.user.first_name or partner.user.username,
            'username': partner.user.username,
            'partner_code': partner.partner_code,
            'company_name': partner.company.name if partner.company else '',
            'phone': partner.company.phone if partner.company else '',
            'email': partner.user.email,
            'is_active': partner.user.is_active,
        })

    def update(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        partner = Employee.objects.filter(id=pk, role='partner').select_related('user', 'company').first()
        if not partner:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        full_name = (request.data.get('full_name') or partner.user.first_name or '').strip()
        phone = (request.data.get('phone') or '').strip()
        email = (request.data.get('email') or '').strip()
        company_name = (request.data.get('company_name') or (partner.company.name if partner.company else '')).strip()
        partner_code = normalize_code(request.data.get('partner_code') or partner.partner_code)
        if not full_name:
            return Response({'error': 'ПІБ обовʼязкове.'}, status=400)
        if email and not EMAIL_RE.match(email):
            return Response({'error': 'Email введено некоректно.'}, status=400)
        duplicate = Employee.objects.filter(role='partner', partner_code__iexact=partner_code).exclude(id=partner.id).exists()
        if duplicate:
            return Response({'error': 'Код партнера вже зайнятий.'}, status=400)
        with transaction.atomic():
            partner.user.first_name = full_name
            partner.user.email = email
            partner.user.save(update_fields=['first_name', 'email'])
            if partner.company:
                partner.company.name = company_name or partner.company.name
                partner.company.phone = phone
                partner.company.save(update_fields=['name', 'phone'])
            partner.partner_code = partner_code
            partner.save(update_fields=['partner_code'])
        return Response({'message': 'Дані партнера оновлено.'})

    def partial_update(self, request, pk=None):
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        partner = Employee.objects.filter(id=pk, role='partner').select_related('user').first()
        if not partner:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        hard_delete_account(partner.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='toggle-access')
    def toggle_access(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        partner = Employee.objects.filter(id=pk, role='partner').select_related('user').first()
        if not partner:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        partner.user.is_active = not partner.user.is_active
        partner.user.save(update_fields=['is_active'])
        return Response({'is_active': partner.user.is_active})


class SecurePlatformClientViewSet(BasePlatformClientViewSet):
    """Compatibility base used by the extended platform-client billing viewset."""

    pass
