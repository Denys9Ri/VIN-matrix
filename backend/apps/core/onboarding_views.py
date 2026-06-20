import json

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .company_options import seed_company_options
from .models import Category, InventoryItem, OrderPart, OrderService, ServiceCatalog, Supplier, Visit, WorkPost
from .partner_views import get_user_company, repair_legacy_account


ONBOARDING_TABLE = 'core_companyonboarding'
DEMO_MARKER = '[VIN-MATRIX DEMO]'


def ensure_onboarding_table():
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_companyonboarding (
                    company_id bigint PRIMARY KEY,
                    state text NOT NULL DEFAULT '{}',
                    is_completed boolean NOT NULL DEFAULT FALSE,
                    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
                    updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
                    completed_at timestamp with time zone NULL
                )
                '''
            )
        else:
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS core_companyonboarding (
                    company_id integer PRIMARY KEY,
                    state text NOT NULL DEFAULT '{}',
                    is_completed integer NOT NULL DEFAULT 0,
                    created_at datetime NOT NULL,
                    updated_at datetime NOT NULL,
                    completed_at datetime NULL
                )
                '''
            )


def normalize_state(value):
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or '{}')
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def initialize_onboarding(company):
    """Create onboarding only for a newly registered company. Existing accounts stay untouched."""
    if not company:
        return
    ensure_onboarding_table()
    now = timezone.now()
    state = json.dumps({'version': 1, 'business_type_selected': False}, ensure_ascii=False)
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                f'''
                INSERT INTO {ONBOARDING_TABLE} (company_id, state, is_completed, created_at, updated_at)
                VALUES (%s, %s, FALSE, %s, %s)
                ON CONFLICT (company_id) DO NOTHING
                ''',
                [company.id, state, now, now],
            )
        else:
            cursor.execute(
                f'''
                INSERT OR IGNORE INTO {ONBOARDING_TABLE} (company_id, state, is_completed, created_at, updated_at)
                VALUES (%s, %s, 0, %s, %s)
                ''',
                [company.id, state, now, now],
            )


def get_onboarding_row(company):
    ensure_onboarding_table()
    with connection.cursor() as cursor:
        cursor.execute(
            f'''SELECT state, is_completed, created_at, updated_at, completed_at
                FROM {ONBOARDING_TABLE} WHERE company_id=%s''',
            [company.id],
        )
        row = cursor.fetchone()
    if not row:
        return None
    return {
        'state': normalize_state(row[0]),
        'is_completed': bool(row[1]),
        'created_at': row[2],
        'updated_at': row[3],
        'completed_at': row[4],
    }


def save_onboarding(company, state, is_completed=None):
    ensure_onboarding_table()
    current = get_onboarding_row(company)
    if not current:
        initialize_onboarding(company)
        current = get_onboarding_row(company) or {'is_completed': False}
    completed = current.get('is_completed', False) if is_completed is None else bool(is_completed)
    now = timezone.now()
    completed_at = now if completed else None
    with connection.cursor() as cursor:
        cursor.execute(
            f'''
            UPDATE {ONBOARDING_TABLE}
            SET state=%s, is_completed=%s, updated_at=%s, completed_at=%s
            WHERE company_id=%s
            ''',
            [json.dumps(state or {}, ensure_ascii=False), completed, now, completed_at, company.id],
        )


def novapost_profiles_count(company_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) FROM core_novapostprofile WHERE company_id=%s', [company_id])
            row = cursor.fetchone()
        return int(row[0] or 0) if row else 0
    except Exception:
        return 0


def non_demo_inventory_count(company):
    try:
        return InventoryItem.objects.filter(company=company).exclude(article__startswith='VM-DEMO-').count()
    except Exception:
        return 0


def non_demo_visit_count(company):
    try:
        return Visit.objects.filter(company=company).exclude(comment__icontains=DEMO_MARKER).count()
    except Exception:
        return 0


def has_document_data(company):
    return bool(company.document_requisites or company.document_signature or company.document_footer or company.document_warranty_text)


def company_payload(company, request=None):
    logo_url = ''
    try:
        logo_url = company.logo.url if company.logo else ''
        if logo_url and request:
            logo_url = request.build_absolute_uri(logo_url)
    except Exception:
        logo_url = ''
    return {
        'name': company.name or '',
        'phone': company.phone or '',
        'address': company.address or '',
        'logo': logo_url,
        'business_type': company.business_type or 'sto',
        'document_requisites': company.document_requisites or '',
        'document_signature': company.document_signature or '',
        'document_footer': company.document_footer or '',
        'document_warranty_text': company.document_warranty_text or '',
    }


def onboarding_payload(company, request=None):
    row = get_onboarding_row(company)
    if not row:
        return {
            'onboarding_exists': False,
            'onboarding_required': False,
            'show_checklist': False,
            'company': company_payload(company, request),
            'checklist': [],
        }

    state = row['state'] or {}
    business_done = bool(state.get('business_type_selected'))
    profile_done = bool(company.name and company.phone)
    # Skipping an optional step lets a person complete the wizard, but does not
    # pretend the business setup is finished. The dashboard checklist keeps it visible.
    documents_done = has_document_data(company)
    delivery_count = novapost_profiles_count(company.id)
    delivery_done = delivery_count > 0
    inventory_count = non_demo_inventory_count(company)
    visit_count = non_demo_visit_count(company)
    demo_seeded = bool(state.get('demo_seeded'))
    first_action_done = bool(state.get('first_action_done')) or inventory_count > 0 or visit_count > 0 or demo_seeded

    checklist = [
        {'id': 'business', 'title': 'Оберіть тип бізнесу', 'subtitle': 'СТО або магазин — система підлаштує статуси та стартові дії.', 'done': business_done, 'required': True, 'route': '/onboarding?step=1'},
        {'id': 'company', 'title': 'Заповніть дані компанії', 'subtitle': 'Назва та телефон потрібні для карток, документів і комунікації.', 'done': profile_done, 'required': True, 'route': '/onboarding?step=2'},
        {'id': 'documents', 'title': 'Налаштуйте документи', 'subtitle': 'Реквізити, підпис та гарантія для друку документів.', 'done': documents_done, 'required': False, 'route': '/onboarding?step=3'},
        {'id': 'delivery', 'title': 'Підключіть Нову пошту', 'subtitle': 'Створюйте ТТН та контролюйте доставку в системі.', 'done': delivery_done, 'required': False, 'route': '/onboarding?step=5'},
        {'id': 'first_action', 'title': 'Зробіть першу дію', 'subtitle': 'Додайте товар, створіть замовлення або перший запис.', 'done': first_action_done, 'required': False, 'route': '/onboarding?step=6'},
    ]

    return {
        'onboarding_exists': True,
        'onboarding_required': not row['is_completed'],
        'show_checklist': not bool(state.get('checklist_dismissed')) and (not row['is_completed'] or any(not item['done'] for item in checklist)),
        'is_completed': row['is_completed'],
        'current_step': int(state.get('current_step') or 1),
        'state': state,
        'company': company_payload(company, request),
        'checklist': checklist,
        'progress': {
            'done': sum(1 for item in checklist if item['done']),
            'total': len(checklist),
            'required_ready': all(item['done'] or not item['required'] for item in checklist),
            'delivery_profiles_count': delivery_count,
            'inventory_count': inventory_count,
            'visit_count': visit_count,
        },
        'demo_seeded': demo_seeded,
    }


def seed_company_demo(company):
    supplier, _ = Supplier.objects.get_or_create(company=company, name='Демо постачальник VIN-matrix', defaults={'api_key': ''})
    category, _ = Category.objects.get_or_create(company=company, name='Демо товари VIN-matrix')
    item, _ = InventoryItem.objects.get_or_create(
        company=company,
        article='VM-DEMO-001',
        defaults={
            'brand': 'VIN-Matrix',
            'name': 'Демо масляний фільтр',
            'category': category,
            'supplier': supplier,
            'quantity': 8,
            'buy_price': 180,
            'sell_price': 260,
        },
    )

    if company.business_type == 'store':
        visit, _ = Visit.objects.get_or_create(
            company=company,
            plate='DEMO-STORE',
            defaults={
                'client': 'Демо клієнт',
                'phone': '+380000000001',
                'vin_code': 'DEMO0000000000001',
                'status': 'NEW',
                'delivery_type': 'pickup',
                'comment': DEMO_MARKER,
            },
        )
        OrderPart.objects.get_or_create(
            visit=visit,
            brand=item.brand,
            article=item.article,
            defaults={'name': item.name, 'buy_price': item.buy_price, 'sell_price': item.sell_price, 'quantity': 1, 'supplier': supplier.name},
        )
        return {'message': 'Демо-магазин додано: товар, клієнт і приклад замовлення.'}

    post, _ = WorkPost.objects.get_or_create(
        company=company,
        name='Демо пост VIN-matrix',
        defaults={'number': 999, 'description': DEMO_MARKER},
    )
    service, _ = ServiceCatalog.objects.get_or_create(company=company, name='Демо: заміна масла', defaults={'price': 500})
    visit, _ = Visit.objects.get_or_create(
        company=company,
        plate='DEMO-STO',
        defaults={
            'client': 'Демо клієнт',
            'phone': '+380000000001',
            'vin_code': 'DEMO0000000000001',
            'status': 'SELECTION',
            'work_post': post,
            'comment': DEMO_MARKER,
        },
    )
    OrderPart.objects.get_or_create(
        visit=visit,
        brand=item.brand,
        article=item.article,
        defaults={'name': item.name, 'buy_price': item.buy_price, 'sell_price': item.sell_price, 'quantity': 1, 'supplier': supplier.name},
    )
    OrderService.objects.get_or_create(visit=visit, name=service.name, defaults={'price': service.price, 'quantity': 1})
    return {'message': 'Демо-СТО додано: пост, послуга, товар і приклад візиту.'}


def remove_company_demo(company):
    """Delete only records that carry the demo marker; preserve user configuration."""
    Visit.objects.filter(company=company, comment__icontains=DEMO_MARKER).delete()
    InventoryItem.objects.filter(company=company, article__startswith='VM-DEMO-').delete()
    ServiceCatalog.objects.filter(company=company, name__startswith='Демо:').delete()
    WorkPost.objects.filter(company=company, name='Демо пост VIN-matrix', description=DEMO_MARKER, visits__isnull=True).delete()
    # Supplier/category remain intentionally: removing them can affect user-linked data.


class OnboardingView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_company(self, request):
        repair_legacy_account(request.user)
        return get_user_company(request.user)

    def get(self, request):
        company = self.get_company(request)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=404)
        return Response(onboarding_payload(company, request))

    @transaction.atomic
    def patch(self, request):
        company = self.get_company(request)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=404)
        row = get_onboarding_row(company)
        if not row:
            return Response({'error': 'Onboarding доступний лише для нових акаунтів.'}, status=403)
        state = row['state'] or {}
        action = str(request.data.get('action') or '').strip()

        if action == 'business':
            business_type = str(request.data.get('business_type') or '').strip().lower()
            if business_type not in {'sto', 'store'}:
                return Response({'error': 'Оберіть СТО або магазин.'}, status=400)
            company.business_type = business_type
            company.save(update_fields=['business_type'])
            seed_company_options(company)
            state.update({'business_type_selected': True, 'statuses_ready': True, 'current_step': 2})
        elif action == 'profile':
            company.name = str(request.data.get('company_name') or company.name or '').strip()
            company.phone = str(request.data.get('phone') or company.phone or '').strip()
            company.address = str(request.data.get('address') or company.address or '').strip()
            logo = request.data.get('logo') or request.data.get('company[logo]')
            if logo:
                company.logo = logo
            if not company.name or not company.phone:
                return Response({'error': 'Вкажіть назву компанії та телефон.'}, status=400)
            company.save()
            first_name = str(request.data.get('first_name') or '').strip()
            if first_name:
                request.user.first_name = first_name
                request.user.save(update_fields=['first_name'])
            state.update({'profile_ready': True, 'current_step': 3})
        elif action == 'documents':
            company.document_requisites = str(request.data.get('document_requisites') or '').strip()
            company.document_signature = str(request.data.get('document_signature') or '').strip()
            company.document_footer = str(request.data.get('document_footer') or '').strip()
            company.document_warranty_text = str(request.data.get('document_warranty_text') or '').strip()
            company.save(update_fields=['document_requisites', 'document_signature', 'document_footer', 'document_warranty_text'])
            state.update({'documents_skipped': False, 'current_step': 4})
        elif action == 'skip':
            step = str(request.data.get('step') or '').strip()
            if step not in {'documents', 'delivery', 'first_action'}:
                return Response({'error': 'Некоректний крок.'}, status=400)
            state[f'{step}_skipped'] = True
            state['current_step'] = {'documents': 4, 'delivery': 6, 'first_action': 6}.get(step, 1)
        elif action == 'first_action_done':
            state.update({'first_action_done': True, 'current_step': 6})
        elif action == 'dismiss_checklist':
            state['checklist_dismissed'] = True
        else:
            return Response({'error': 'Невідома дія onboarding.'}, status=400)

        save_onboarding(company, state)
        return Response({'message': 'Збережено.', **onboarding_payload(company, request)})

    @transaction.atomic
    def post(self, request):
        company = self.get_company(request)
        if not company:
            return Response({'error': 'Компанію не знайдено.'}, status=404)
        row = get_onboarding_row(company)
        if not row:
            return Response({'error': 'Onboarding доступний лише для нових акаунтів.'}, status=403)
        state = row['state'] or {}
        action = str(request.data.get('action') or '').strip()

        if action == 'seed_demo':
            result = seed_company_demo(company)
            state.update({'demo_seeded': True, 'first_action_done': True, 'current_step': 5})
            save_onboarding(company, state)
            return Response({**result, **onboarding_payload(company, request)})
        if action == 'remove_demo':
            remove_company_demo(company)
            state['demo_seeded'] = False
            save_onboarding(company, state)
            return Response({'message': 'Демо-дані видалено.', **onboarding_payload(company, request)})
        if action == 'complete':
            profile_ready = bool(company.name and company.phone)
            if not state.get('business_type_selected') or not profile_ready:
                return Response({'error': 'Спочатку оберіть тип бізнесу та заповніть дані компанії.'}, status=400)
            state['current_step'] = 6
            save_onboarding(company, state, is_completed=True)
            return Response({'message': 'Базове налаштування завершено. Ласкаво просимо до VIN-matrix.', **onboarding_payload(company, request)})
        return Response({'error': 'Невідома дія onboarding.'}, status=400)
