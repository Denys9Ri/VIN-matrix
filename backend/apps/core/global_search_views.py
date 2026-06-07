import json
import re
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InventoryItem, OrderPart, Supplier, Visit
from .safe_crm_views import safe_ensure_company


def _digits(value):
    return ''.join(ch for ch in str(value or '') if ch.isdigit())


def _clean_query(value):
    return str(value or '').strip()


def _money(value):
    try:
        return float(Decimal(str(value or 0)))
    except Exception:
        return 0.0


def _date_iso(value):
    if not value:
        return ''
    try:
        return timezone.localtime(value).date().isoformat()
    except Exception:
        try:
            return value.date().isoformat()
        except Exception:
            return ''


def _date_display(value):
    if not value:
        return '—'
    try:
        return timezone.localtime(value).strftime('%d.%m.%Y %H:%M')
    except Exception:
        try:
            return value.strftime('%d.%m.%Y')
        except Exception:
            return '—'


def _visit_url(visit, company):
    date = _date_iso(visit.scheduled_datetime or visit.created_at)
    if getattr(company, 'business_type', '') == 'store':
        return f'/visits?visit_id={visit.id}&tab=parts&open=board'
    suffix = f'&date={date}' if date else ''
    return f'/visits?visit_id={visit.id}{suffix}'


def _client_url(visit, company):
    search = _digits(visit.phone) or visit.client or visit.plate or visit.id
    if getattr(company, 'business_type', '') == 'store':
        return f'/clients?search={search}&order_id={visit.id}'
    return f'/crm/clients?search={search}&visit={visit.id}'


def _delivery_values(visit):
    raw = str(visit.delivery_data or '')
    values = [raw]
    try:
        data = json.loads(raw) if raw else {}
        if isinstance(data, dict):
            for key in ['ttn', 'tracking_number', 'tracking', 'np_ttn', 'declaration', 'city', 'recipient', 'warehouse']:
                if data.get(key):
                    values.append(str(data.get(key)))
    except Exception:
        pass
    return ' '.join(values)


def _score(text, q):
    text = str(text or '').lower()
    q = str(q or '').lower()
    if not q:
        return 0
    if text == q:
        return 100
    if text.startswith(q):
        return 80
    if q in text:
        return 50
    return 0


def _result(kind, title, subtitle='', meta='', url='', badge='', icon='search', priority=50, data=None):
    return {
        'kind': kind,
        'title': title or 'Результат',
        'subtitle': subtitle or '',
        'meta': meta or '',
        'url': url or '',
        'badge': badge or '',
        'icon': icon,
        'priority': priority,
        'data': data or {},
    }


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = safe_ensure_company(request.user)
        if not company:
            return Response({'query': '', 'total': 0, 'results': [], 'groups': {}})

        q = _clean_query(request.query_params.get('q'))
        limit = min(max(int(request.query_params.get('limit', 24) or 24), 1), 60)
        if len(q) < 2:
            return Response({'query': q, 'total': 0, 'results': [], 'groups': {}})

        q_digits = _digits(q)
        q_number = int(q.replace('№', '').replace('#', '').strip()) if q.replace('№', '').replace('#', '').strip().isdigit() else None
        is_store = getattr(company, 'business_type', '') == 'store'
        order_word = 'Замовлення' if is_store else 'Візит'

        results = []
        seen = set()

        def add(item):
            key = (item.get('kind'), item.get('url'), item.get('title'))
            if key in seen:
                return
            seen.add(key)
            results.append(item)

        # 1. Замовлення / візити: номер, телефон, клієнт, VIN, номер авто, ТТН.
        visit_q = Q(client__icontains=q) | Q(phone__icontains=q) | Q(plate__icontains=q) | Q(vin_code__icontains=q) | Q(delivery_data__icontains=q)
        if q_digits and len(q_digits) >= 4:
            visit_q |= Q(phone__icontains=q_digits) | Q(delivery_data__icontains=q_digits)
        if q_number:
            visit_q |= Q(id=q_number)

        visits = list(
            Visit.objects.filter(company=company).filter(visit_q)
            .prefetch_related('parts')
            .order_by('-updated_at', '-created_at')[:12]
        )
        for v in visits:
            match_bits = []
            if q_number and v.id == q_number:
                match_bits.append('№')
            if q.lower() in str(v.client or '').lower():
                match_bits.append('клієнт')
            if q_digits and q_digits in _digits(v.phone):
                match_bits.append('телефон')
            if q.lower() in str(v.vin_code or '').lower():
                match_bits.append('VIN')
            if q.lower() in str(v.plate or '').lower():
                match_bits.append('номер авто')
            if q.lower() in _delivery_values(v).lower() or (q_digits and q_digits in _digits(_delivery_values(v))):
                match_bits.append('ТТН')
            priority = 100 if q_number and v.id == q_number else 75
            add(_result(
                'visit',
                f'{order_word} №{v.id}',
                f'{v.client or "Новий покупець"} · {v.phone or "без телефону"}',
                f'{v.plate or v.vin_code or "без авто"} · {v.status or "—"} · {_date_display(v.scheduled_datetime or v.created_at)}',
                _visit_url(v, company),
                'точний збіг' if priority >= 100 else ', '.join(match_bits) or order_word.lower(),
                'order' if is_store else 'car',
                priority,
                {'visit_id': v.id, 'client': v.client, 'phone': v.phone, 'date': _date_iso(v.scheduled_datetime or v.created_at)}
            ))

        # 2. Клієнти: показати як окремі сутності, щоб швидко відкрити історію.
        client_q = Q(client__icontains=q) | Q(phone__icontains=q) | Q(plate__icontains=q) | Q(vin_code__icontains=q)
        if q_digits and len(q_digits) >= 4:
            client_q |= Q(phone__icontains=q_digits)
        client_visits = list(
            Visit.objects.filter(company=company).filter(client_q)
            .order_by('-updated_at', '-created_at')[:16]
        )
        grouped = {}
        for v in client_visits:
            key = _digits(v.phone) or (v.client or '').strip().lower() or f'visit-{v.id}'
            if key not in grouped:
                grouped[key] = {'visit': v, 'orders': 0, 'last_date': v.scheduled_datetime or v.created_at}
            grouped[key]['orders'] += 1
        for g in list(grouped.values())[:6]:
            v = g['visit']
            add(_result(
                'client',
                v.client or 'Новий покупець',
                v.phone or 'без телефону',
                f'{g["orders"]} запис(ів) · останній: {_date_display(g["last_date"])}',
                _client_url(v, company),
                'клієнт',
                'client',
                70 + _score(v.client, q),
                {'visit_id': v.id, 'phone': v.phone, 'client': v.client}
            ))

        # 3. Товари у замовленнях / запчастини у візитах.
        part_q = Q(brand__icontains=q) | Q(article__icontains=q) | Q(name__icontains=q) | Q(supplier__icontains=q) | Q(visit__client__icontains=q) | Q(visit__phone__icontains=q)
        if q_number:
            part_q |= Q(visit_id=q_number)
        parts = list(
            OrderPart.objects.filter(visit__company=company).filter(part_q)
            .select_related('visit')
            .order_by('-id')[:12]
        )
        for p in parts:
            add(_result(
                'order_part',
                f'{p.brand} {p.article}'.strip() or p.name,
                p.name,
                f'{order_word} №{p.visit_id} · {p.supplier or "постачальник —"} · {p.quantity} шт · {_money(p.sell_price):g} ₴',
                _visit_url(p.visit, company),
                'товар у замовленні',
                'part',
                65 + max(_score(p.article, q), _score(p.brand, q)),
                {'visit_id': p.visit_id, 'part_id': p.id, 'article': p.article, 'brand': p.brand}
            ))

        # 4. Склад.
        inventory_q = Q(brand__icontains=q) | Q(article__icontains=q) | Q(name__icontains=q) | Q(supplier__name__icontains=q)
        stock_items = list(
            InventoryItem.objects.filter(company=company).filter(inventory_q)
            .select_related('supplier', 'category')
            .order_by('brand', 'article')[:12]
        )
        for item in stock_items:
            add(_result(
                'inventory',
                f'{item.brand} {item.article}'.strip(),
                str(item.name or '')[:140],
                f'На складі: {item.quantity} · продаж {_money(item.sell_price):g} ₴ · {getattr(item.supplier, "name", None) or "без постачальника"}',
                f'/inventory?search={item.article}',
                'склад',
                'stock',
                72 + max(_score(item.article, q), _score(item.brand, q)),
                {'inventory_id': item.id, 'article': item.article, 'brand': item.brand, 'quantity': item.quantity}
            ))

        # 5. Постачальники.
        suppliers = list(Supplier.objects.filter(company=company).filter(Q(name__icontains=q)).order_by('name')[:6])
        for supplier in suppliers:
            count = InventoryItem.objects.filter(company=company, supplier=supplier).count()
            add(_result(
                'supplier',
                supplier.name,
                f'Постачальник · {count} товарів на складі',
                'Натисни, щоб перейти до складу з товарами постачальника',
                f'/inventory?supplier={supplier.id}&search={supplier.name}',
                'постачальник',
                'supplier',
                55 + _score(supplier.name, q),
                {'supplier_id': supplier.id}
            ))

        # 6. Якщо запит схожий на артикул — швидкий перехід у пошук постачальників.
        if re.search(r'[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]', q):
            add(_result(
                'external_parts',
                f'Шукати запчастину “{q.upper()}”',
                'Пошук по підключених постачальниках і локальному складу',
                'Vesna / Omega / BM / склад',
                f'/search?q={q}',
                'глобальний пошук',
                'search',
                40,
                {'query': q}
            ))

        results.sort(key=lambda x: x.get('priority', 0), reverse=True)
        results = results[:limit]
        groups = {}
        for item in results:
            groups[item['kind']] = groups.get(item['kind'], 0) + 1

        return Response({
            'query': q,
            'total': len(results),
            'results': results,
            'groups': groups,
        })
