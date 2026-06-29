import logging
import re

import requests
from rest_framework.response import Response

from .models import Supplier
from .paid_views import PartSearchView as PaidPartSearchView
from .safe_crm_views import safe_ensure_company


logger = logging.getLogger('vin_matrix.api')
VESNA_SEARCH_URL = 'https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/'
VESNA_CROSS_URL = 'https://api.vesna-auto.com.ua/public-api/search-methods/search-by-cross/'


def _is_vesna(supplier):
    api_type = str(getattr(supplier, 'api_type', '') or '').lower()
    name = str(getattr(supplier, 'name', '') or '').lower()
    return api_type == Supplier.API_VESNA or 'vesna' in name or 'весна' in name


def _credentials(supplier):
    raw = str(getattr(supplier, 'api_key', '') or '').strip()
    if ':' not in raw:
        return None, ''
    customer_raw, token = raw.split(':', 1)
    customer_raw = customer_raw.strip()
    token = token.replace('Token', '').replace('token', '').strip()
    if not customer_raw.isdigit() or not token:
        return None, ''
    return int(customer_raw), token


def _positive_quantity(value):
    raw = str(value or '').strip().lower()
    if not raw or raw in {'0', '0.0', '-', 'немає', 'none', 'null'}:
        return False
    if raw.startswith('>') or raw.startswith('+'):
        return True
    match = re.search(r'\d+(?:[\.,]\d+)?', raw)
    return bool(match and float(match.group(0).replace(',', '.')) > 0)


def _quantity_value(value):
    match = re.search(r'\d+(?:[\.,]\d+)?', str(value or ''))
    return float(match.group(0).replace(',', '.')) if match else 0


def _items(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ('data', 'results', 'items', 'products'):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            nested = value.get('items') or value.get('results') or value.get('data')
            if isinstance(nested, list):
                return nested
    return []


def _balances(item):
    raw = item.get('balance') or item.get('balances') or item.get('stocks') or []
    if isinstance(raw, dict):
        raw = raw.get('items') or raw.get('data') or raw.get('results') or list(raw.values())
    return raw if isinstance(raw, list) else []


def _price(value):
    try:
        return float(str(value or 0).replace(',', '.'))
    except (TypeError, ValueError):
        return 0.0


def _warehouse_preferences(supplier):
    prefs = supplier.warehouse_prefs if isinstance(supplier.warehouse_prefs, list) else []
    result = {}
    for item in prefs:
        if not isinstance(item, dict):
            continue
        if item.get('id') is not None:
            result[str(item['id'])] = item
        if item.get('name'):
            result[str(item['name']).lower()] = item
    return result


def _map_item(supplier, item, euro_rate, query, is_analog, sku_param):
    if not isinstance(item, dict):
        return None
    sku = str(item.get('sku') or item.get('id') or '').strip()
    if is_analog and sku_param and sku == str(sku_param):
        return None

    prefs = _warehouse_preferences(supplier)
    warehouses = []
    for balance in _balances(item):
        if not isinstance(balance, dict):
            continue
        warehouse_id = str(balance.get('warehouse_id') or balance.get('id') or '').strip()
        warehouse_name = str(balance.get('name') or balance.get('warehouse_name') or 'Склад').strip()
        quantity = balance.get('quantity') or balance.get('qty') or balance.get('remain') or '0'
        preference = prefs.get(warehouse_id) or prefs.get(warehouse_name.lower())
        if preference and not preference.get('is_active', True):
            continue
        if not _positive_quantity(quantity):
            continue
        warehouses.append({
            'id': warehouse_id,
            'name': warehouse_name,
            'quantity': str(quantity),
            'priority': int(preference.get('priority', 99)) if preference else 99,
        })

    if not warehouses:
        return None

    price_uah = round(_price(item.get('price')) * float(euro_rate), 2)
    for warehouse in warehouses:
        warehouse['buy_price'] = price_uah
    warehouses.sort(key=lambda item: (item['priority'], -_quantity_value(item['quantity']), item['name']))
    first = warehouses[0]
    article = str(item.get('article') or item.get('code') or query or '').strip()
    return {
        'id': f'vesna_{supplier.id}_{sku or article}',
        'supplier_id': supplier.id,
        'source': supplier.name,
        'brand': str(item.get('brand') or item.get('manufacturer') or 'Unknown').strip(),
        'article': article,
        'name': str(item.get('name') or item.get('title') or 'Деталь Vesna Auto').strip(),
        'buy_price': price_uah,
        'quantity': f"{first['quantity']} шт ({first['name']})",
        'is_local': False,
        'warehouses': warehouses,
        'sku': sku,
        'min_qty': item.get('min_order_quantity') or item.get('min_qty') or 1,
        'image_url': item.get('image') or item.get('picture') or '',
        'description': item.get('description') or '',
    }


def _fetch_supplier(supplier, query, is_analog, sku_param, euro_rate):
    customer_id, token = _credentials(supplier)
    if customer_id is None:
        logger.warning('vesna_search_skipped supplier_id=%s reason=invalid_credentials_format', supplier.id)
        return []

    url = VESNA_CROSS_URL if is_analog else VESNA_SEARCH_URL
    try:
        response = requests.post(
            url,
            json={'customer_id': customer_id, 'article': query},
            headers={
                'Authorization': f'Token {token}',
                'Content-Type': 'application/json',
                'Accept-Language': 'uk',
            },
            timeout=15,
        )
    except requests.RequestException as error:
        logger.warning('vesna_search_request_failed supplier_id=%s error=%s', supplier.id, type(error).__name__)
        return []

    if response.status_code != 200:
        logger.warning('vesna_search_response supplier_id=%s status=%s', supplier.id, response.status_code)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning('vesna_search_response supplier_id=%s reason=invalid_json', supplier.id)
        return []

    offers = []
    for item in _items(payload):
        mapped = _map_item(supplier, item, euro_rate, query, is_analog, sku_param)
        if mapped:
            offers.append(mapped)
    logger.info('vesna_search_response supplier_id=%s query=%s offers=%s', supplier.id, query[:80], len(offers))
    return offers


class VesnaPartSearchView(PaidPartSearchView):
    """Keeps existing supplier adapters and replaces only Vesna handling."""

    def get(self, request):
        response = super().get(request)
        if not isinstance(response.data, list):
            return response

        try:
            company = safe_ensure_company(request.user)
            query = str(request.query_params.get('q') or '').strip()
            is_analog = request.query_params.get('analog') == 'true'
            supplier_id = str(request.query_params.get('supplier_id') or '').strip()
            sku_param = str(request.query_params.get('sku') or '').strip()
            if not company or not query:
                return response

            suppliers = [
                supplier for supplier in Supplier.objects.filter(company=company, is_active=True)
                if _is_vesna(supplier) and str(supplier.api_key or '').strip()
            ]
            if is_analog and supplier_id:
                suppliers = [supplier for supplier in suppliers if str(supplier.id) == supplier_id]

            response.data = [item for item in response.data if not _is_vesna(type('S', (), {
                'api_type': '', 'name': item.get('source', ''),
            })())]
            for supplier in suppliers:
                response.data.extend(_fetch_supplier(
                    supplier,
                    query,
                    is_analog,
                    sku_param,
                    float(company.euro_rate or 42),
                ))
            response.data.sort(key=lambda item: (float(item.get('buy_price') or 0), item.get('source', '')))
        except Exception:
            logger.exception('vesna_search_wrapper_failed')
        return response
