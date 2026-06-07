from django.db import transaction
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .company_options import seed_company_options
from .models import CompanyOption
from .safe_crm_views import safe_ensure_company


ALLOWED_MODES = {'store', 'sto', 'both', 'system'}
ALLOWED_GROUPS = {
    'store_order_status',
    'sto_visit_status',
    'part_status',
    'payment_type',
    'order_source',
    'cancel_reason',
    'product_category',
    'client_status',
}
ALLOWED_COLORS = {'blue', 'emerald', 'rose', 'amber', 'orange', 'indigo', 'purple', 'slate', 'cyan', 'green', 'pink', 'sky', 'yellow'}
SAFE_UPDATE_FIELDS = {'mode', 'label', 'description', 'color', 'icon', 'sort_order', 'is_active', 'is_default', 'semantic_role', 'metadata'}


def _bool(value, default=None):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in {'1', 'true', 'yes', 'y', 'on', 'так'}


def _int(value, default=100):
    try:
        return int(value)
    except Exception:
        return default


def _normalize_key(value):
    raw = str(value or '').strip()
    if not raw:
        return ''
    return raw.replace(' ', '_').replace('-', '_').lower()[:80]


def _serialize(option):
    return {
        'id': option.id,
        'company_id': option.company_id,
        'mode': option.mode,
        'group': option.group,
        'key': option.key,
        'label': option.label,
        'description': option.description or '',
        'color': option.color or 'slate',
        'icon': option.icon or '',
        'sort_order': option.sort_order,
        'is_active': option.is_active,
        'is_system': option.is_system,
        'is_default': option.is_default,
        'semantic_role': option.semantic_role or '',
        'metadata': option.metadata or {},
        'created_at': option.created_at.isoformat() if option.created_at else None,
        'updated_at': option.updated_at.isoformat() if option.updated_at else None,
    }


def _grouped_payload(queryset):
    grouped = {}
    for option in queryset:
        grouped.setdefault(option.group, []).append(_serialize(option))
    return grouped


class CompanyOptionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'items': [], 'groups': {}})

        seed_company_options(company)

        mode = request.query_params.get('mode')
        group = request.query_params.get('group')
        active = _bool(request.query_params.get('active'), None)
        grouped = _bool(request.query_params.get('grouped'), True)
        search = str(request.query_params.get('search') or '').strip()

        qs = CompanyOption.objects.filter(company=company).order_by('group', 'sort_order', 'id')
        if mode in ALLOWED_MODES:
            qs = qs.filter(Q(mode=mode) | Q(mode='both') | Q(mode='system'))
        if group in ALLOWED_GROUPS:
            qs = qs.filter(group=group)
        if active is not None:
            qs = qs.filter(is_active=active)
        if search:
            qs = qs.filter(Q(label__icontains=search) | Q(key__icontains=search) | Q(description__icontains=search))

        items = [_serialize(item) for item in qs]
        return Response({
            'items': items,
            'groups': _grouped_payload(qs) if grouped else {},
            'total': len(items),
        })

    def post(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Company not found'}, status=400)

        group = request.data.get('group')
        if group not in ALLOWED_GROUPS:
            return Response({'error': 'Некоректна група довідника'}, status=400)

        mode = request.data.get('mode') or 'both'
        if mode not in ALLOWED_MODES:
            return Response({'error': 'Некоректний режим'}, status=400)

        label = str(request.data.get('label') or '').strip()
        if not label:
            return Response({'error': 'Вкажіть назву'}, status=400)

        key = _normalize_key(request.data.get('key') or label)
        if not key:
            return Response({'error': 'Вкажіть ключ'}, status=400)
        if CompanyOption.objects.filter(company=company, group=group, key=key).exists():
            return Response({'error': 'Такий пункт уже існує'}, status=400)

        color = request.data.get('color') or 'slate'
        if color not in ALLOWED_COLORS:
            color = 'slate'

        option = CompanyOption.objects.create(
            company=company,
            mode=mode,
            group=group,
            key=key,
            label=label,
            description=request.data.get('description') or '',
            color=color,
            icon=request.data.get('icon') or '',
            sort_order=_int(request.data.get('sort_order'), 100),
            is_active=_bool(request.data.get('is_active'), True),
            is_system=False,
            is_default=_bool(request.data.get('is_default'), False),
            semantic_role=request.data.get('semantic_role') or '',
            metadata=request.data.get('metadata') if isinstance(request.data.get('metadata'), dict) else {},
        )
        return Response(_serialize(option), status=201)


class CompanyOptionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_option(self, request, pk):
        company = safe_ensure_company(request.user)
        if not company:
            return None, None
        try:
            return company, CompanyOption.objects.get(company=company, pk=pk)
        except CompanyOption.DoesNotExist:
            return company, None

    def patch(self, request, pk):
        company, option = self._get_option(request, pk)
        if not company:
            return Response({'error': 'Company not found'}, status=400)
        if not option:
            return Response({'error': 'Пункт не знайдено'}, status=404)

        data = request.data or {}
        for field in SAFE_UPDATE_FIELDS:
            if field not in data:
                continue
            value = data.get(field)
            if field == 'mode':
                if value in ALLOWED_MODES:
                    option.mode = value
            elif field == 'color':
                option.color = value if value in ALLOWED_COLORS else 'slate'
            elif field == 'sort_order':
                option.sort_order = _int(value, option.sort_order)
            elif field in {'is_active', 'is_default'}:
                setattr(option, field, _bool(value, getattr(option, field)))
            elif field == 'metadata':
                if isinstance(value, dict):
                    option.metadata = value
            elif field == 'label':
                clean = str(value or '').strip()
                if clean:
                    option.label = clean[:120]
            else:
                setattr(option, field, str(value or '').strip())
        option.save()
        return Response(_serialize(option))

    def delete(self, request, pk):
        company, option = self._get_option(request, pk)
        if not company:
            return Response({'error': 'Company not found'}, status=400)
        if not option:
            return Response({'error': 'Пункт не знайдено'}, status=404)

        if option.is_system:
            option.is_active = False
            option.save(update_fields=['is_active', 'updated_at'])
            return Response({'status': 'deactivated', 'item': _serialize(option)})

        option.delete()
        return Response({'status': 'deleted'})


class CompanyOptionBulkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Company not found'}, status=400)

        action = request.data.get('action')
        if action == 'reorder':
            items = request.data.get('items') or []
            with transaction.atomic():
                for index, item in enumerate(items):
                    pk = item.get('id') if isinstance(item, dict) else item
                    sort_order = item.get('sort_order') if isinstance(item, dict) and item.get('sort_order') is not None else (index + 1) * 10
                    CompanyOption.objects.filter(company=company, pk=pk).update(sort_order=_int(sort_order, (index + 1) * 10))
            return Response({'status': 'ok'})

        if action == 'restore_defaults':
            force = _bool(request.data.get('force'), False)
            result = seed_company_options(company, force=force)
            return Response({'status': 'ok', **result})

        return Response({'error': 'Невідома дія'}, status=400)


class CompanyDictionariesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({})
        seed_company_options(company)
        mode = request.query_params.get('mode')
        qs = CompanyOption.objects.filter(company=company, is_active=True).order_by('group', 'sort_order', 'id')
        if mode in ALLOWED_MODES:
            qs = qs.filter(Q(mode=mode) | Q(mode='both') | Q(mode='system'))
        return Response(_grouped_payload(qs))
