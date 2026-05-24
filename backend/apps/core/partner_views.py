from datetime import timedelta

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company, Employee, PlatformClient, Supplier
from .serializers import CompanySerializer, PlatformClientSerializer, UserSerializer

PLATFORM_ADMIN_USERNAMES = {'Denys9Ri'}
ADMIN_CODE = 'A6000'
PARTNER_CODE_START = 6001
CLIENT_CODE_START = 6002


def is_main_admin(user):
    return bool(user and user.is_authenticated and (user.username in PLATFORM_ADMIN_USERNAMES or user.is_staff or user.is_superuser))


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


def is_platform_admin(user):
    # ВАЖЛИВО: власна Company у клієнта/партнера НЕ робить його адміном платформи.
    return is_main_admin(user)


def detect_role(user):
    if is_platform_admin(user):
        return 'admin'
    if is_partner_user(user):
        return 'partner'
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
        company = Company.objects.create(
            name=f'{title} CRM' if title == user.username else title,
            owner=user,
            business_type='sto',
        )
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
    for code in PlatformClient.objects.values_list('client_code', flat=True):
        if code:
            used.add(int(code))
    return used


def generate_partner_code():
    used = _used_numeric_codes()
    n = PARTNER_CODE_START
    while n in used:
        n += 1
    return f'P{n}'


def generate_client_code():
    used = _used_numeric_codes()
    n = CLIENT_CODE_START
    while n in used:
        n += 1
    return n


def ensure_partner_code(emp):
    if not emp or emp.role != 'partner':
        return None
    code = normalize_code(emp.partner_code)
    if code.startswith('P') and code[1:].isdigit():
        if emp.partner_code != code:
            emp.partner_code = code
            emp.save(update_fields=['partner_code'])
        return emp.partner_code
    emp.partner_code = generate_partner_code()
    emp.save(update_fields=['partner_code'])
    return emp.partner_code


def find_partner_by_code(code):
    code = normalize_code(code)
    if not code:
        return None
    if code.startswith('P'):
        return Employee.objects.filter(role='partner', partner_code=code).select_related('user').first()
    # тимчасова сумісність зі старими PART-001, якщо вони ще залишилися у базі
    return Employee.objects.filter(role='partner', partner_code=code).select_related('user').first()


def get_admin_user():
    admin = User.objects.filter(username__in=PLATFORM_ADMIN_USERNAMES).first()
    if admin:
        return admin
    return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).first()


def get_default_assigned_owner(exclude_user=None):
    admin = get_admin_user()
    if admin and (not exclude_user or admin.id != exclude_user.id):
        return admin
    return exclude_user


@transaction.atomic
def repair_legacy_account(user):
    if user.is_anonymous:
        return

    if is_platform_admin(user):
        PlatformClient.objects.filter(user=user).delete()
        return

    if is_partner_user(user):
        ensure_user_company(user)
        ensure_partner_code(get_employee(user))
        PlatformClient.objects.filter(user=user).delete()
        return

    ensure_user_company(user)
    if not get_platform_client(user):
        owner = get_default_assigned_owner(exclude_user=user) or user
        try:
            PlatformClient.objects.create(
                user=user,
                client_code=generate_client_code(),
                assigned_owner=owner,
                referred_by=owner,
                payment_status=PlatformClient.PAYMENT_PENDING,
                is_access_enabled=False,
            )
        except IntegrityError:
            pass


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip()
        company_name = (request.data.get('company_name') or '').strip()
        partner_code = normalize_code(
            request.data.get('partner_code')
            or request.data.get('referral_code')
            or request.data.get('representative_code')
            or request.data.get('client_code')
            or ''
        )

        if not username or not password:
            return Response({'error': 'Логін і пароль обовʼязкові.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Логін зайнятий.'}, status=400)

        partner = None
        if partner_code:
            partner = find_partner_by_code(partner_code)
            if not partner:
                return Response({'error': 'Код партнера не знайдено.'}, status=400)

        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password, first_name=full_name)
            ensure_user_company(user, company_name or full_name or username)
            owner = partner.user if partner else get_default_assigned_owner(exclude_user=user)
            if not owner:
                owner = user
            PlatformClient.objects.create(
                user=user,
                client_code=generate_client_code(),
                assigned_owner=owner,
                referred_by=owner,
                payment_status=PlatformClient.PAYMENT_PENDING,
                is_access_enabled=False,
            )
        return Response({'message': 'Акаунт створено. Очікує активації доступу.'}, status=201)


class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request):
        repair_legacy_account(request.user)
        user = request.user
        company = get_user_company(user)
        emp = get_employee(user)
        client = get_platform_client(user)
        role = detect_role(user)

        access_allowed = True
        access_message = ''
        if role == 'client' and client and not client.is_access_enabled:
            access_allowed = False
            access_message = 'Немає доступу через відсутність оплати.'

        permissions = {
            'can_create_visits': role in ['admin', 'partner', 'client'],
            'can_view_finances': role in ['admin', 'partner', 'client'],
            'can_view_clients': role in ['admin', 'partner', 'client'],
            'can_view_analytics': role in ['admin', 'partner', 'client'],
            'can_manage_partners': role == 'admin',
            'can_manage_accounts': role in ['admin', 'partner'],
            'can_view_partner_clients': role == 'partner',
        }
        company_data = CompanySerializer(company, context={'request': request}).data if company else {
            'name': '', 'logo': None, 'phone': '', 'address': '', 'document_footer': '', 'global_margin_percent': 20, 'business_type': 'sto'
        }
        partner_code = ensure_partner_code(emp) if role == 'partner' else None
        user_code = ADMIN_CODE if role == 'admin' else (partner_code if role == 'partner' else (f'C{client.client_code}' if client else None))

        return Response({
            'user': UserSerializer(user).data,
            'company': company_data,
            'role': role,
            'permissions': permissions,
            'user_code': user_code,
            'admin_code': ADMIN_CODE if role == 'admin' else None,
            'partner_code': partner_code,
            'client_code': client.client_code if client else None,
            'client_code_display': f'C{client.client_code}' if client else None,
            'subscription_status': client.payment_status if client else None,
            'is_access_enabled': client.is_access_enabled if client else None,
            'access_allowed': access_allowed,
            'access_message': access_message,
        })

    def patch(self, request):
        repair_legacy_account(request.user)
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії для редагування.'}, status=403)
        user = request.user
        if 'first_name' in request.data or 'user[first_name]' in request.data:
            user.first_name = request.data.get('user[first_name]') or request.data.get('first_name') or ''
        if 'email' in request.data or 'user[email]' in request.data:
            user.email = request.data.get('user[email]') or request.data.get('email') or ''
        user.save()
        mapping = {
            'company[name]': 'name', 'name': 'name', 'company[phone]': 'phone', 'company[address]': 'address',
            'company[document_footer]': 'document_footer', 'company[global_margin_percent]': 'global_margin_percent',
            'company[business_type]': 'business_type', 'company[euro_rate]': 'euro_rate'
        }
        for key, field in mapping.items():
            if key in request.data:
                setattr(company, field, request.data.get(key))
        logo = request.data.get('company[logo]')
        if logo:
            company.logo = logo
        company.save()
        return Response({'message': 'Дані успішно оновлено.'})


class PartnerManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки адміністратор може керувати партнерами.'}, status=403)
        return None

    def list(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        data = []
        for p in Employee.objects.filter(role='partner').select_related('user', 'company').order_by('user__username'):
            ensure_partner_code(p)
            clients = PlatformClient.objects.filter(assigned_owner=p.user)
            data.append({
                'id': p.id,
                'user_id': p.user.id,
                'username': p.user.username,
                'full_name': p.user.first_name or p.user.username,
                'email': p.user.email,
                'partner_code': p.partner_code,
                'is_active': p.user.is_active,
                'clients_count': clients.count(),
                'active_clients_count': clients.filter(payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count(),
                'created_at': p.user.date_joined,
            })
        return Response(data)

    @transaction.atomic
    def create(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        full_name = request.data.get('full_name') or request.data.get('first_name') or ''
        company_name = request.data.get('company_name') or f'{full_name or username} CRM'
        if not username or not password:
            return Response({'error': 'Логін і пароль обовʼязкові.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Такий логін вже зайнятий.'}, status=400)
        user = User.objects.create_user(username=username, password=password, first_name=full_name, email=request.data.get('email') or '')
        company = ensure_user_company(user, company_name)
        emp = Employee.objects.create(
            user=user,
            company=get_user_company(request.user) or company,
            role='partner',
            can_create_visits=True,
            can_view_finances=True,
            partner_code=generate_partner_code(),
        )
        PlatformClient.objects.filter(user=user).delete()
        return Response({'message': 'Партнера створено.', 'partner_code': emp.partner_code, 'user_id': user.id}, status=201)

    @transaction.atomic
    @action(detail=False, methods=['post'], url_path='promote-user')
    def promote_user(self, request):
        denied = self._require_admin(request)
        if denied:
            return denied
        raw_user_id = str(request.data.get('user_id') or '').strip()
        if not raw_user_id.isdigit():
            return Response({'error': 'Введіть ID користувача. P6001 — це код партнера для реєстрації клієнтів, а не ID.'}, status=400)
        try:
            user = User.objects.get(id=int(raw_user_id))
        except User.DoesNotExist:
            return Response({'error': 'Користувача не знайдено.'}, status=404)
        if is_main_admin(user):
            return Response({'error': 'Головного адміна не можна зробити партнером.'}, status=400)
        company = ensure_user_company(user)
        emp, _ = Employee.objects.get_or_create(user=user, defaults={'company': get_user_company(request.user) or company})
        emp.role = 'partner'
        emp.can_create_visits = True
        emp.can_view_finances = True
        emp.partner_code = generate_partner_code() if not normalize_code(emp.partner_code).startswith('P') else normalize_code(emp.partner_code)
        emp.save()
        PlatformClient.objects.filter(user=user).delete()
        return Response({'message': 'Користувача зроблено партнером.', 'partner_code': emp.partner_code})

    def partial_update(self, request, pk=None):
        denied = self._require_admin(request)
        if denied:
            return denied
        try:
            emp = Employee.objects.get(id=pk, role='partner')
        except Employee.DoesNotExist:
            return Response({'error': 'Партнера не знайдено.'}, status=404)
        if 'is_active' in request.data:
            emp.user.is_active = bool(request.data.get('is_active'))
            emp.user.save()
        if request.data.get('regenerate_code'):
            emp.partner_code = generate_partner_code()
            emp.save()
        return Response({'message': 'Оновлено.', 'partner_code': emp.partner_code})


class SecurePlatformClientViewSet(viewsets.ModelViewSet):
    serializer_class = PlatformClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        repair_legacy_account(self.request.user)
        qs = PlatformClient.objects.select_related('user', 'assigned_owner', 'referred_by').order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(client_code__icontains=search) | Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) | Q(user__email__icontains=search) |
                Q(assigned_owner__username__icontains=search) | Q(assigned_owner__first_name__icontains=search)
            )
        if is_platform_admin(self.request.user):
            return qs
        if is_partner_user(self.request.user):
            return qs.filter(assigned_owner=self.request.user)
        return qs.filter(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        repair_legacy_account(request.user)
        instance = self.get_object()
        if not (is_platform_admin(request.user) or (is_partner_user(request.user) and instance.assigned_owner_id == request.user.id)):
            return Response({'error': 'Немає прав змінювати цього клієнта.'}, status=403)
        if is_platform_admin(request.user):
            payment_status = request.data.get('payment_status')
            if payment_status in [PlatformClient.PAYMENT_PENDING, PlatformClient.PAYMENT_ACTIVE, PlatformClient.PAYMENT_INACTIVE]:
                instance.payment_status = payment_status
            owner_id = request.data.get('assigned_owner_id') or request.data.get('assigned_owner') or request.data.get('partner_id')
            if owner_id:
                if not str(owner_id).isdigit():
                    return Response({'error': 'ID партнера має бути числом.'}, status=400)
                try:
                    owner = User.objects.get(Q(id=int(owner_id)), Q(employee_profile__role='partner') | Q(username__in=PLATFORM_ADMIN_USERNAMES) | Q(is_staff=True) | Q(is_superuser=True))
                except User.DoesNotExist:
                    return Response({'error': 'Партнера/адміна не знайдено.'}, status=400)
                instance.assigned_owner = owner
                instance.referred_by = owner
        if is_partner_user(request.user) and 'is_access_enabled' in request.data:
            instance.is_access_enabled = bool(request.data.get('is_access_enabled'))
        if is_platform_admin(request.user) and 'is_access_enabled' in request.data:
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
        return Response({'message': 'Акаунт видалено.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        repair_legacy_account(request.user)
        if is_platform_admin(request.user):
            return Response([{
                'representative': p.user.first_name or p.user.username,
                'partner_code': ensure_partner_code(p),
                'clients_count': PlatformClient.objects.filter(assigned_owner=p.user).count(),
                'active_clients_count': PlatformClient.objects.filter(assigned_owner=p.user, payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count(),
            } for p in Employee.objects.filter(role='partner').select_related('user')])
        if is_partner_user(request.user):
            clients = PlatformClient.objects.filter(assigned_owner=request.user)
            return Response({'my_clients': clients.count(), 'active_clients': clients.filter(payment_status=PlatformClient.PAYMENT_ACTIVE, is_access_enabled=True).count()})
        return Response({'my_clients': 0})

    @action(detail=True, methods=['post'], url_path='activate-month')
    def activate_month(self, request, pk=None):
        if not is_platform_admin(request.user):
            return Response({'error': 'Тільки адмін може активувати підписку.'}, status=403)
        instance = self.get_object()
        instance.payment_status = PlatformClient.PAYMENT_ACTIVE
        instance.is_access_enabled = True
        if hasattr(instance, 'subscription_until'):
            instance.subscription_until = timezone.now() + timedelta(days=30)
        instance.save()
        return Response(self.get_serializer(instance).data)
