from collections import Counter, defaultdict
from decimal import Decimal

from django.db import connection
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CRMClientStatus, CRMCommunication, CRMServiceReminder, CRMTask, OrderService, VehicleRecommendation, Visit
from .safe_crm_views import safe_ensure_company


PIPELINE_LABELS = {
    'new': 'Новий',
    'active': 'Активний',
    'regular': 'Постійний',
    'vip': 'VIP',
    'sleeping': 'Сплячий',
    'problem': 'Проблемний',
    'debt': 'З боргом',
}

CRM_STATUS_TO_PIPELINE = {
    'new': 'new',
    'active': 'active',
    'regular': 'regular',
    'vip': 'vip',
    'sleeping': 'sleeping',
    'problem': 'problem',
}


def money(value):
    try:
        return float(Decimal(str(value or 0)))
    except Exception:
        return 0.0


def normalize_phone(value):
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    return digits or 'no-phone'


def client_record_key(client='', phone='', plate=''):
    normalized = normalize_phone(phone)
    if normalized != 'no-phone':
        return normalized
    client_name = str(client or '').strip()
    if client_name:
        return f'name:{client_name}'
    plate_value = str(plate or '').strip().upper()
    if plate_value:
        return f'plate:{plate_value}'
    return 'unknown'


def search_order_id(value):
    value = str(value or '').strip().replace('№', '').replace('#', '')
    return int(value) if value.isdigit() else None


def days_since(value):
    if not value:
        return None
    try:
        date_value = timezone.localtime(value).date() if hasattr(value, 'tzinfo') else value
        return (timezone.localdate() - date_value).days
    except Exception:
        return None


def parse_stock_statuses(part_ids):
    if not part_ids:
        return {}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id, stock_status FROM core_orderpart WHERE id = ANY(%s)', [list(part_ids)])
            return {row[0]: row[1] or 'none' for row in cursor.fetchall()}
    except Exception:
        return {}


def payments_for_visits(visit_ids):
    if not visit_ids:
        return {}, {}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT visit_id, id, amount, payment_type, payment_purpose, comment, created_at FROM core_visitpayment WHERE visit_id = ANY(%s) ORDER BY created_at DESC, id DESC', [list(visit_ids)])
            rows = cursor.fetchall()
        grouped = defaultdict(list)
        totals = defaultdict(float)
        for r in rows:
            item = {'id': r[1], 'amount': money(r[2]), 'payment_type': r[3] or 'cash', 'payment_purpose': r[4] or 'partial', 'comment': r[5] or '', 'created_at': r[6]}
            grouped[r[0]].append(item)
            totals[r[0]] += item['amount']
        return grouped, totals
    except Exception:
        return {}, {}


def part_totals(parts):
    revenue = cost = profit = 0.0
    for part in parts:
        qty = money(part.quantity or 1) or 1
        sell = money(part.sell_price)
        buy = money(part.buy_price)
        revenue += sell * qty
        cost += buy * qty
        profit += (sell - buy) * qty
    return revenue, cost, profit


def service_totals(services):
    revenue = profit = commission = 0.0
    for service in services:
        qty = money(service.quantity or 1) or 1
        price = money(service.price)
        comm = money(getattr(service, 'commission_amount', 0))
        line = price * qty
        revenue += line
        commission += comm
        profit += max(line - comm, 0)
    return revenue, commission, profit


def order_totals(parts, services):
    part_revenue, part_cost, part_profit = part_totals(parts)
    service_revenue, service_cost, service_profit = service_totals(services)
    revenue = part_revenue + service_revenue
    cost = part_cost + service_cost
    profit = part_profit + service_profit
    margin = (profit / revenue * 100) if revenue else 0
    return {'revenue': round(revenue, 2), 'cost': round(cost, 2), 'profit': round(profit, 2), 'margin': round(margin, 1)}


def manual_statuses(company):
    result = {}
    queryset = CRMClientStatus.objects.filter(company=company).order_by('-updated_at', '-id')
    for status in queryset:
        key = client_record_key(status.client, status.phone, status.plate)
        if key not in result:
            pipeline_key = CRM_STATUS_TO_PIPELINE.get(status.status or 'new', 'new')
            result[key] = {
                'id': status.id,
                'key': pipeline_key,
                'label': PIPELINE_LABELS.get(pipeline_key, 'Новий'),
                'note': status.note or '',
                'updated_at': status.updated_at,
            }
    return result


def serialize_task(task):
    return {'id': task.id, 'title': task.title, 'description': task.description or '', 'due_date': task.due_date, 'status': task.status, 'days_left': None if not task.due_date else (task.due_date - timezone.localdate()).days, 'created_at': task.created_at}


def serialize_reminder(reminder):
    return {'id': reminder.id, 'title': reminder.title or dict(CRMServiceReminder.TYPE_CHOICES).get(reminder.reminder_type, 'Нагадування'), 'reminder_type': reminder.reminder_type, 'reminder_type_label': dict(CRMServiceReminder.TYPE_CHOICES).get(reminder.reminder_type, 'ТО'), 'due_date': reminder.due_date, 'due_mileage': reminder.due_mileage, 'status': reminder.status, 'note': reminder.note or '', 'created_at': reminder.created_at}


def serialize_recommendation(rec):
    return {'id': rec.id, 'title': rec.title, 'description': rec.description or '', 'due_date': rec.due_date, 'due_mileage': rec.due_mileage, 'status': rec.status, 'created_at': rec.created_at}


def serialize_communication(item):
    return {'id': item.id, 'status': item.status, 'status_label': dict(CRMCommunication.STATUS_CHOICES).get(item.status, 'Контакт'), 'comment': item.comment or '', 'created_at': item.created_at}


def related_crm_records(company):
    records = defaultdict(lambda: {'tasks': [], 'reminders': [], 'recommendations': [], 'communications': []})
    for task in CRMTask.objects.filter(company=company).exclude(status=CRMTask.STATUS_DONE).order_by('due_date', '-created_at'):
        records[client_record_key(task.client, task.phone, task.plate)]['tasks'].append(serialize_task(task))
    for reminder in CRMServiceReminder.objects.filter(company=company, status=CRMServiceReminder.STATUS_ACTIVE).order_by('due_date', '-created_at'):
        records[client_record_key(reminder.client, reminder.phone, reminder.plate)]['reminders'].append(serialize_reminder(reminder))
    for rec in VehicleRecommendation.objects.filter(company=company, status=VehicleRecommendation.STATUS_ACTIVE).order_by('due_date', '-created_at'):
        records[client_record_key(rec.client, rec.phone, rec.plate)]['recommendations'].append(serialize_recommendation(rec))
    for comm in CRMCommunication.objects.filter(company=company).order_by('-created_at', '-id')[:1000]:
        records[client_record_key(comm.client, comm.phone, comm.plate)]['communications'].append(serialize_communication(comm))
    return records


def client_pipeline(summary, manual=None):
    dormant_days = days_since(summary.get('last_order_date'))
    if summary.get('debt_amount', 0) > 0:
        return {'key': 'debt', 'label': PIPELINE_LABELS['debt'], 'reason': 'Є неоплачена сума по замовленнях'}
    if summary.get('returns_count', 0) >= 3:
        return {'key': 'problem', 'label': PIPELINE_LABELS['problem'], 'reason': 'Багато повернень або браку'}
    if manual:
        return {'key': manual['key'], 'label': manual['label'], 'reason': manual.get('note') or 'Статус встановлено вручну'}
    if summary.get('total_revenue', 0) >= 20000 or summary.get('total_profit', 0) >= 4000:
        return {'key': 'vip', 'label': PIPELINE_LABELS['vip'], 'reason': 'Висока сума покупок або прибуток'}
    if dormant_days is not None and dormant_days >= 90:
        return {'key': 'sleeping', 'label': PIPELINE_LABELS['sleeping'], 'reason': f'Не купував / не приїжджав {dormant_days} днів'}
    if summary.get('orders_count', 0) >= 3:
        return {'key': 'regular', 'label': PIPELINE_LABELS['regular'], 'reason': 'Є 3+ замовлення або візити'}
    if dormant_days is not None and dormant_days <= 45 and summary.get('orders_count', 0) >= 1:
        return {'key': 'active', 'label': PIPELINE_LABELS['active'], 'reason': 'Недавно був контакт або покупка'}
    return {'key': 'new', 'label': PIPELINE_LABELS['new'], 'reason': 'Новий клієнт'}


def repeat_opportunities(summary):
    opportunities = []
    dormant_days = days_since(summary.get('last_order_date'))
    parts = summary.get('parts', [])
    services = summary.get('services', [])

    if dormant_days is not None and dormant_days >= 60:
        opportunities.append({'type': 'sleeping_client', 'priority': 'high' if dormant_days >= 120 else 'medium', 'title': 'Клієнт давно не купував / не приїжджав', 'description': f'Останній контакт був {dormant_days} днів тому. Варто написати або подзвонити.'})

    grouped_parts = {}
    for part in parts:
        key = f"{part.get('brand') or ''}|{part.get('article') or ''}|{part.get('name') or ''}".lower()
        item = grouped_parts.setdefault(key, {'type': 'repeat_part', 'priority': 'medium', 'title': f"Повторити товар: {part.get('brand') or ''} {part.get('article') or ''}".strip() or part.get('name') or 'Товар з історії', 'description': part.get('name') or 'Товар з історії клієнта', 'count': 0, 'revenue': 0.0, 'profit': 0.0, 'last_date': part.get('date'), 'part': part})
        item['count'] += 1
        item['revenue'] += money(part.get('revenue') or part.get('sell_price'))
        item['profit'] += money(part.get('profit'))
        if part.get('date') and (not item['last_date'] or part.get('date') > item['last_date']):
            item['last_date'] = part.get('date')
            item['part'] = part

    for item in sorted(grouped_parts.values(), key=lambda x: (x['count'], x['revenue'], x['profit']), reverse=True)[:4]:
        item['revenue'] = round(item['revenue'], 2)
        item['profit'] = round(item['profit'], 2)
        item['description'] = f"{item['description']} · купував {item['count']} раз(и)"
        opportunities.append(item)

    grouped_services = {}
    for service in services:
        key = str(service.get('name') or '').lower()
        item = grouped_services.setdefault(key, {'type': 'repeat_service', 'priority': 'medium', 'title': f"Повторити сервіс: {service.get('name') or 'Робота'}", 'description': 'Послуга з історії візитів клієнта', 'count': 0, 'revenue': 0.0, 'profit': 0.0, 'last_date': service.get('date'), 'service': service})
        item['count'] += 1
        item['revenue'] += money(service.get('revenue') or service.get('price'))
        item['profit'] += money(service.get('profit'))
        if service.get('date') and (not item['last_date'] or service.get('date') > item['last_date']):
            item['last_date'] = service.get('date')
            item['service'] = service

    for item in sorted(grouped_services.values(), key=lambda x: (x['count'], x['revenue'], x['profit']), reverse=True)[:3]:
        item['revenue'] = round(item['revenue'], 2)
        item['profit'] = round(item['profit'], 2)
        item['description'] = f"{item['description']} · виконував {item['count']} раз(и)"
        opportunities.append(item)

    if not summary.get('active_reminders_count'):
        opportunities.append({'type': 'service_reminder', 'priority': 'low', 'title': 'Поставити сервісне нагадування', 'description': 'Немає активного нагадування. Це шанс повернути клієнта в майбутньому.'})

    return opportunities[:7]


def next_actions(summary):
    pipeline = summary.get('pipeline', {})
    actions = [{'key': 'call', 'label': 'Подзвонити', 'title': 'Звʼязатися з клієнтом телефоном'}, {'key': 'message', 'label': 'Написати', 'title': 'Скопіювати готовий текст для месенджера'}, {'key': 'task', 'label': 'Створити задачу', 'title': 'Поставити задачу менеджеру'}, {'key': 'order', 'label': 'Створити замовлення / візит', 'title': 'Відкрити повторне замовлення або візит'}, {'key': 'reminder', 'label': 'Поставити нагадування', 'title': 'Запланувати сервіс або повторний контакт'}]
    if pipeline.get('key') in ['sleeping', 'debt', 'problem']:
        actions.insert(0, {'key': 'priority', 'label': 'В пріоритет', 'title': pipeline.get('reason') or 'Потребує уваги'})
    return actions


def serialize_service(service):
    qty = money(service.quantity or 1) or 1
    price = money(service.price)
    commission = money(getattr(service, 'commission_amount', 0))
    revenue = price * qty
    return {'id': service.id, 'name': service.name, 'quantity': float(service.quantity or 1), 'price': price, 'revenue': round(revenue, 2), 'profit': round(max(revenue - commission, 0), 2), 'commission_amount': commission, 'status': service.status, 'mechanic_id': service.mechanic_id}


def serialize_order(visit, stock_statuses=None, payments=None, paid_total=None):
    parts = list(visit.parts.all())
    services = list(visit.services.all())
    stock_statuses = stock_statuses or {}
    totals = order_totals(parts, services)
    payments = payments or []
    paid = paid_total if paid_total is not None else sum(money(p.get('amount')) for p in payments)
    if paid <= 0:
        paid = money(visit.prepayment_amount)
    debt = max(totals['revenue'] - paid, 0)
    return {'id': visit.id, 'client': visit.client, 'phone': visit.phone, 'plate': visit.plate, 'vin_code': visit.vin_code, 'status': visit.status, 'payment_status': visit.payment_status, 'delivery_type': visit.delivery_type, 'created_at': visit.created_at, 'scheduled_datetime': visit.scheduled_datetime, 'revenue': totals['revenue'], 'cost': totals['cost'], 'profit': totals['profit'], 'margin': totals['margin'], 'paid_amount': round(paid, 2), 'debt_amount': round(debt, 2), 'payments': payments, 'parts_count': len(parts), 'services_count': len(services), 'services': [serialize_service(s) for s in services], 'parts': [{'id': p.id, 'brand': p.brand, 'article': p.article, 'name': p.name, 'quantity': float(p.quantity or 1), 'buy_price': money(p.buy_price), 'sell_price': money(p.sell_price), 'revenue': round(money(p.sell_price) * (money(p.quantity or 1) or 1), 2), 'profit': round((money(p.sell_price) - money(p.buy_price)) * (money(p.quantity or 1) or 1), 2), 'status': p.status, 'supplier': p.supplier, 'stock_status': stock_statuses.get(p.id, 'none')} for p in parts]}


def build_clients(company, search=''):
    qs = Visit.objects.filter(company=company).prefetch_related('parts', 'services').order_by('-created_at')
    if search:
        order_id = search_order_id(search)
        if order_id:
            exact_order_qs = qs.filter(id=order_id)
            if exact_order_qs.exists():
                qs = exact_order_qs
            else:
                qs = qs.filter(Q(client__icontains=search) | Q(phone__icontains=search) | Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(parts__brand__icontains=search) | Q(parts__article__icontains=search) | Q(parts__name__icontains=search) | Q(services__name__icontains=search)).distinct()
        else:
            qs = qs.filter(Q(client__icontains=search) | Q(phone__icontains=search) | Q(plate__icontains=search) | Q(vin_code__icontains=search) | Q(parts__brand__icontains=search) | Q(parts__article__icontains=search) | Q(parts__name__icontains=search) | Q(services__name__icontains=search)).distinct()
    visits = list(qs)
    all_part_ids = [p.id for v in visits for p in v.parts.all()]
    stock_statuses = parse_stock_statuses(all_part_ids)
    payments_map, paid_map = payments_for_visits([v.id for v in visits])
    manual_map = manual_statuses(company)
    related_map = related_crm_records(company)
    groups = defaultdict(lambda: {'key': '', 'client': '', 'phone': '', 'orders': [], 'cars': {}, 'parts': [], 'services': [], 'payments': [], 'orders_count': 0, 'total_revenue': 0.0, 'total_cost': 0.0, 'total_profit': 0.0, 'paid_amount': 0.0, 'debt_amount': 0.0, 'returns_count': 0, 'last_order_date': None})
    for visit in visits:
        key = normalize_phone(visit.phone) if normalize_phone(visit.phone) != 'no-phone' else f'name:{visit.client or visit.id}'
        g = groups[key]
        g['key'] = key
        if not g['client'] and visit.client:
            g['client'] = visit.client
        if not g['phone'] and visit.phone:
            g['phone'] = visit.phone
        order = serialize_order(visit, stock_statuses, payments_map.get(visit.id, []), paid_map.get(visit.id, None))
        g['orders'].append(order)
        g['payments'].extend([{**p, 'order_id': visit.id} for p in order['payments']])
        g['orders_count'] += 1
        g['total_revenue'] += order['revenue']
        g['total_cost'] += order['cost']
        g['total_profit'] += order['profit']
        g['paid_amount'] += order['paid_amount']
        g['debt_amount'] += order['debt_amount']
        order_date = visit.scheduled_datetime or visit.created_at
        if order_date and (not g['last_order_date'] or order_date > g['last_order_date']):
            g['last_order_date'] = order_date
        car_key = f'{visit.plate or ""} {visit.vin_code or ""}'.strip()
        if car_key:
            g['cars'][car_key] = {'plate': visit.plate, 'vin_code': visit.vin_code}
        for p in order['parts']:
            g['parts'].append({**p, 'order_id': visit.id, 'date': order_date})
            if p['stock_status'] in ['returned', 'defective']:
                g['returns_count'] += 1
        for s in order['services']:
            g['services'].append({**s, 'order_id': visit.id, 'date': order_date})
    clients = []
    for g in groups.values():
        g['total_revenue'] = round(g['total_revenue'], 2)
        g['total_cost'] = round(g['total_cost'], 2)
        g['total_profit'] = round(g['total_profit'], 2)
        g['paid_amount'] = round(g['paid_amount'], 2)
        g['margin'] = round((g['total_profit'] / g['total_revenue'] * 100) if g['total_revenue'] else 0, 1)
        g['debt_amount'] = round(g['debt_amount'], 2)
        g['cars'] = list(g['cars'].values())
        crm_key = client_record_key(g.get('client'), g.get('phone'), g['cars'][0].get('plate') if g.get('cars') else '')
        related = related_map.get(g['key']) or related_map.get(crm_key) or {'tasks': [], 'reminders': [], 'recommendations': [], 'communications': []}
        manual = manual_map.get(g['key']) or manual_map.get(crm_key)
        g['tasks'] = related['tasks'][:8]
        g['reminders'] = related['reminders'][:8]
        g['recommendations'] = related['recommendations'][:8]
        g['communications'] = related['communications'][:8]
        g['active_tasks_count'] = len(related['tasks'])
        g['active_reminders_count'] = len(related['reminders'])
        g['active_recommendations_count'] = len(related['recommendations'])
        g['communications_count'] = len(related['communications'])
        g['manual_status'] = manual
        g['pipeline'] = client_pipeline(g, manual)
        g['status'] = g['pipeline']['label']
        g['dormant_days'] = days_since(g['last_order_date'])
        g['repeat_opportunities'] = repeat_opportunities(g)
        g['next_actions'] = next_actions(g)
        clients.append(g)
    return sorted(clients, key=lambda x: x['last_order_date'] or timezone.datetime.min.replace(tzinfo=timezone.utc), reverse=True)


class StoreClientListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'results': []})
        search = request.query_params.get('search', '').strip()
        clients = build_clients(company, search=search)
        pipeline_counts = Counter(c.get('pipeline', {}).get('key') or 'new' for c in clients)
        compact = []
        for c in clients:
            compact.append({'key': c['key'], 'client': c['client'] or 'Без імені', 'phone': c['phone'], 'orders_count': c['orders_count'], 'total_revenue': c['total_revenue'], 'total_profit': c['total_profit'], 'paid_amount': c['paid_amount'], 'margin': c['margin'], 'debt_amount': c['debt_amount'], 'returns_count': c['returns_count'], 'last_order_date': c['last_order_date'], 'dormant_days': c.get('dormant_days'), 'cars': c['cars'][:3], 'status': c['status'], 'pipeline': c['pipeline'], 'repeat_opportunities_count': len(c.get('repeat_opportunities') or []), 'active_tasks_count': c.get('active_tasks_count', 0), 'active_reminders_count': c.get('active_reminders_count', 0), 'active_recommendations_count': c.get('active_recommendations_count', 0), 'last_parts': c['parts'][:5], 'last_services': c['services'][:5], 'last_payments': c['payments'][:5]})
        return Response({'results': compact, 'pipeline': pipeline_counts})


class StoreClientDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'error': 'Немає компанії'}, status=400)
        key = request.query_params.get('key', '').strip()
        phone = request.query_params.get('phone', '').strip()
        clients = build_clients(company)
        wanted = key or normalize_phone(phone)
        for c in clients:
            if c['key'] == wanted or normalize_phone(c['phone']) == wanted:
                return Response(c)
        return Response({'error': 'Клієнта не знайдено'}, status=404)
