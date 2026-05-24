from datetime import timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company, Employee, PlatformClient, Supplier
from .serializers import CompanySerializer, PlatformClientSerializer, UserSerializer


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
    employee = get_employee(user)
    return bool(employee and employee.role == 'partner')


def is_platform_client_user(user):
    return bool(get_platform_client(user))


def is_platform_admin(user):
    if is_partner_user(user) or is_platform_client_user(user):
        return False
    return bool(user.is_staff or user.is_superuser or get_company(user))


def get_user_company(user):
    own_company = get_company(user)
    if own_company:
        return own_company
    employee = get_employee(user)
    if employee:
        return employee.company
    return None


def detect_role(user):
    employee = get_employee(user)
    if employee and employee.role == 'partner':
        return 'partner'
    if get_platform_client(user):
        return 'platform_client'
    if user.is_staff or user.is_superuser or get_company(user):
        return 'owner'
    if employee:
        return employee.role or 'mechanic'
    return 'user'


def generate_partner_code():
    last_partner = Employee.objects.filter(role='partner', partner_code__isnull=False).order_by('-id').first()
    next_number = (last_partner.id + 1) if last_partner else 1
    code = f'PART-{next_number:03d}'
    while Employee.objects.filter(partner_code=code).exists():
        next_number += 1
        code = f'PART-{next_number:03d}'
    return code


def generate_client_code():
    last_client = PlatformClient.objects.order_by('-client_code').first()
    next_code = (last_client.client_code + 1) if last_client else 6001
    while PlatformClient.objects.filter(client_code=next_code).exists():
        next_code += 1
    return next_code


def create_default_suppliers(company):
    if not company:
        return
    existing = set(Supplier.objects.filter(company=company).values_list('name', flat=True))
    for name in ['Vesna-auto', 'Omega', 'Technomir']:
        if name not in existing:
            Supplier.objects.create(company=company, name=name, api_key='')


def ensure_user_company(user):
    existing_company = get_company(user)
    if existing_company:
        create_default_suppliers(existing_company)
        return existing_company

    title = user.first_name.strip() if user.first_name else user.username
    try:
        company = Company.objects.create(
            name=f'{title} CRM',
            owner=user,
            business_type='sto',
        )
    except IntegrityError:
        company = get_company(user)
    create_default_suppliers(company)
    return company


def ensure_partner_company(user):
    return ensure_user_company(user)


def get_default_assigned_owner(user):
    employee = get_employee(user)
    if employee and employee.role == 'partner':
        return user

    first_partner = User.objects.filter(employee_profile__role='partner').exclude(id=user.id).order_by('id').first()
    if first_partner:
        return first_partner

    admin_company = Company.objects.exclude(owner=user).order_by('id').first()
    if admin_company:
        return admin_company.owner

    return user


@transaction.atomic
def repair_legacy_account(user):
    if user.is_anonymous:
        return

    if user.is_staff or user.is_superuser:
        return

    employee = get_employee(user)
    if employee and employee.role == 'partner':
        ensure_user_company(user)
        return

    company = ensure_user_company(user)
    if not company:
        return

    if not get_platform_client(user):
        assigned_owner = get_default_assigned_owner(user)
        try:
            PlatformClient.objects.create(
                user=user,
                client_code=generate_client_code(),
                assigned_owner=assigned_owner,
                referred_by=assigned_owner,
                payment_status=PlatformClient.PAYMENT_PENDING,
                is_access_enabled=False,
            )
        except IntegrityError:
            pass


class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request):
        repair_legacy_account(request.user)

        user = request.user
        company = get_user_company(user)
        employee = get_employee(user)
        client_profile = get_platform_client(user)
        role = detect_role(user)

        permissions = {
            'can_create_visits': role in ['owner', 'partner', 'platform_client'] or bool(employee and employee.can_create_visits),
            'can_view_finances': role in ['owner', 'partner', 'platform_client'] or bool(employee and employee.can_view_finances),
            'can_view_clients': role in ['owner', 'partner', 'platform_client'],
            'can_view_analytics': role in ['owner', 'partner', 'platform_client'],
            'can_manage_partners': role == 'owner',
            'can_view_partner_clients': role in ['owner', 'partner'],
        }

        company_serializer = CompanySerializer(company, context={'request': request}) if company else None
        return Response({
            'user': UserSerializer(user).data,
            'company': company_serializer.data if company_serializer else {
                'name': '', 'logo': None, 'phone': '', 'address': '', 'document_footer': '',
                'global_margin_percent': 20, 'business_type': 'sto'
            },
            'role': role,
            'permissions': permissions,
            'partner_code': employee.partner_code if employee else None,
            'client_code': client_profile.client_code if client_profile else None,
            'subscription_status': client_profile.payment_status if client_profile else None,
            'is_access_enabled': client_profile.is_access_enabled if client_profile else None,
        })

    def patch(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії для редагування.'}, status=403)

        user = request.user
        first_name = request.data.get('user[first_name]') or request.data.get('first_name')
        email = request.data.get('user[email]') or request.data.get('email')
        if first_name is not None:
            user.first_name = first_name
        if email is not None:
            user.email = email
        user.save()

        name = request.data.get('company[name]') or request.data.get('name')
        if name:
            company.name = name
        if 'company[phone]' in request.data:
            company.phone = request.data.get('company[phone]')
        if 'company[address]' in request.data:
            company.address = request.data.get('company[address]')
        if 'company[document_footer]' in request.data:
            company.document_footer = request.data.get('company[document_footer]')
        if 'company[global_margin_percent]' in request.data:
            company.global_margin_percent = request.data.get('company[global_margin_percent]')
        if 'company[business_type]' in request.data:
            company.business_type = request.data.get('company[business_type]')
        if 'company[euro_rate]' in request.data:
            raw_rate = str(request.data.get('company[euro_rate]')).replace(',', '.')
            try:
                company.euro_rate = float(raw_rate)
            except ValueError:
                pass
        logo = request.data.get('company[logo]')
        if logo:
            company.logo = logo
        company.save()
        return Response({'message': 'Дані успішно оновлено!'})


class PartnerManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки головний адмін може керувати партнерами.'}, status=403)
        return None

    def list(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied

        partners = Employee.objects.filter(role='partner').select_related('user', 'company').order_by('user__first_name', 'user__username')
        data = []
        for partner in partners:
            clients_qs = PlatformClient.objects.filter(assigned_owner=partner.user)
            partner_company = get_company(partner.user)
            data.append({
                'id': partner.id,
                'user_id': partner.user.id,
                'username': partner.user.username,
                'full_name': partner.user.first_name or partner.user.username,
                'email': partner.user.email,
                'partner_code': partner.partner_code,
                'is_active': partner.user.is_active,
                'company_id': partner_company.id if partner_company else None,
                'clients_count': clients_qs.count(),
                'active_clients_count': clients_qs.filter(payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count(),
                'created_at': partner.user.date_joined,
            })
        return Response(data)

    @transaction.atomic
    def create(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied

        username = request.data.get('username')
        password = request.data.get('password')
        full_name = request.data.get('full_name') or request.data.get('first_name') or ''
        email = request.data.get('email') or ''
        company_name = request.data.get('company_name') or f'{full_name or username} CRM'

        if not username or not password:
            return Response({'error': 'Логін і пароль обовʼязкові.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Такий логін вже зайнятий.'}, status=400)

        user = User.objects.create_user(username=username, password=password, first_name=full_name, email=email)
        company = Company.objects.create(name=company_name, owner=user, business_type='sto')
        create_default_suppliers(company)

        employee = Employee.objects.create(
            user=user,
            company=request.user.company,
            role='partner',
            can_create_visits=True,
            can_view_finances=True,
            partner_code=generate_partner_code(),
        )
        return Response({'message': 'Партнера створено.', 'partner_id': employee.id, 'user_id': user.id, 'partner_code': employee.partner_code}, status=201)

    def partial_update(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        try:
            partner = Employee.objects.select_related('user').get(id=pk, role='partner')
        except Employee.DoesNotExist:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        if 'full_name' in request.data:
            partner.user.first_name = request.data.get('full_name') or ''
        if 'email' in request.data:
            partner.user.email = request.data.get('email') or ''
        if 'is_active' in request.data:
            partner.user.is_active = bool(request.data.get('is_active'))
        if request.data.get('regenerate_code'):
            partner.partner_code = generate_partner_code()
        partner.user.save()
        partner.save()
        return Response({'message': 'Партнера оновлено.', 'partner_code': partner.partner_code})

    @action(detail=False, methods=['post'], url_path='promote-user')
    @transaction.atomic
    def promote_user(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'Передайте user_id.'}, status=400)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Користувача не знайдено.'}, status=404)
        ensure_partner_company(user)
        employee, created = Employee.objects.get_or_create(
            user=user,
            defaults={'company': request.user.company, 'role': 'partner', 'can_create_visits': True, 'can_view_finances': True, 'partner_code': generate_partner_code()}
        )
        if not created:
            employee.role = 'partner'
            employee.can_create_visits = True
            employee.can_view_finances = True
            if not employee.partner_code:
                employee.partner_code = generate_partner_code()
            employee.save()
        return Response({'message': 'Користувача зроблено партнером.', 'partner_code': employee.partner_code})


class SecurePlatformClientViewSet(viewsets.ModelViewSet):
    serializer_class = PlatformClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        repair_legacy_account(self.request.user)
        qs = PlatformClient.objects.select_related('user', 'assigned_owner', 'referred_by').order_by('-created_at')
        if is_platform_admin(self.request.user):
            return qs
        if is_partner_user(self.request.user):
            return qs.filter(assigned_owner=self.request.user)
        return qs.filter(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        repair_legacy_account(request.user)
        instance = self.get_object()
        user = request.user
        if not (is_platform_admin(user) or (is_partner_user(user) and instance.assigned_owner_id == user.id)):
            return Response({'error': 'Немає прав змінювати цього клієнта.'}, status=403)
        if is_platform_admin(user):
            payment_status = request.data.get('payment_status')
            if payment_status in [PlatformClient.PAYMENT_PENDING, PlatformClient.PAYMENT_ACTIVE, PlatformClient.PAYMENT_INACTIVE]:
                instance.payment_status = payment_status
            if 'assigned_owner' in request.data:
                try:
                    new_owner = User.objects.get(id=request.data.get('assigned_owner'), employee_profile__role='partner')
                    instance.assigned_owner = new_owner
                    instance.referred_by = new_owner
                except User.DoesNotExist:
                    return Response({'error': 'Партнера не знайдено.'}, status=400)
        if 'is_access_enabled' in request.data:
            instance.is_access_enabled = bool(request.data.get('is_access_enabled'))
        if instance.payment_status != PlatformClient.PAYMENT_ACTIVE:
            instance.is_access_enabled = False
        instance.save()
        return Response(self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        repair_legacy_account(request.user)
        instance = self.get_object()
        if not (is_platform_admin(request.user) or (is_partner_user(request.user) and instance.assigned_owner_id == request.user.id)):
            return Response({'error': 'Немає прав видаляти цього клієнта.'}, status=403)
        instance.user.delete()
        return Response({'message': 'Акаунт успішно видалено.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='hierarchy')
    def hierarchy(self, request):
        repair_legacy_account(request.user)
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки головний адмін може переглядати ієрархію.'}, status=403)
        clients = self.get_queryset().order_by('assigned_owner__id', 'client_code')
        grouped = {}
        for client in clients:
            key = client.assigned_owner_id
            if key not in grouped:
                owner_name = client.assigned_owner.first_name.strip() if client.assigned_owner.first_name else client.assigned_owner.username
                employee = get_employee(client.assigned_owner)
                grouped[key] = {'partner_id': key, 'partner_name': owner_name, 'partner_code': employee.partner_code if employee else None, 'clients': []}
            grouped[key]['clients'].append(self.get_serializer(client).data)
        return Response(list(grouped.values()))

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        repair_legacy_account(request.user)
        if is_platform_admin(request.user):
            partners = Employee.objects.filter(role='partner').select_related('user')
            data = []
            for partner in partners:
                clients = PlatformClient.objects.filter(assigned_owner=partner.user)
                data.append({'representative': partner.user.first_name or partner.user.username, 'partner_code': partner.partner_code, 'clients_count': clients.count(), 'active_clients_count': clients.filter(payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count(), 'registered_at': partner.user.date_joined})
            return Response(data)
        if is_partner_user(request.user):
            clients = PlatformClient.objects.filter(assigned_owner=request.user)
            return Response({'my_clients': clients.count(), 'active_clients': clients.filter(payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count()})
        return Response({'my_clients': 0})

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        repair_legacy_account(request.user)
        client_profile = get_platform_client(request.user)
        if client_profile:
            return Response(self.get_serializer(client_profile).data)
        return Response({})

    @action(detail=True, methods=['post'], url_path='activate-month')
    def activate_month(self, request, pk=None):
        repair_legacy_account(request.user)
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки головний адмін може активувати підписку.'}, status=403)
        instance = self.get_object()
        instance.payment_status = PlatformClient.PAYMENT_ACTIVE
        instance.is_access_enabled = True
        if hasattr(instance, 'subscription_until'):
            instance.subscription_until = timezone.now() + timedelta(days=30)
        instance.save()
        return Response(self.get_serializer(instance).data)
