import hashlib
import re
import urllib.parse
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .access_control import HasPaidAccess
from .models import Supplier
from .safe_crm_views import (
    CategoryViewSet as SafeCategoryViewSet,
    InventoryItemViewSet as SafeInventoryItemViewSet,
    SupplierViewSet as SafeSupplierViewSet,
    MechanicViewSet as SafeMechanicViewSet,
    safe_ensure_company,
)
from .views import PartSearchView as BasePartSearchView


BM_API_BASE = 'https://api.bm.parts'
UTR_API_BASE = 'https://order24-api.utr.ua'



def _clean_article(value):
    """Normalize supplier articles for strict code comparison."""
    return re.sub(r'[^A-ZА-ЯІЇЄҐ0-9]', '', str(value or '').upper())


def _is_bm_supplier(supplier_or_name):
    name = str(getattr(supplier_or_name, 'name', supplier_or_name) or '').lower()
    return 'bm' in name or 'bm.parts' in name or 'bm-parts' in name


def _is_utr_supplier(supplier_or_name):
    api_type = str(getattr(supplier_or_name, 'api_type', '') or '').lower()
    name = str(getattr(supplier_or_name, 'name', supplier_or_name) or '').lower()
    return (
        api_type == 'utr'
        or 'utr' in name
        or 'uniq' in name
        or 'unique' in name
        or 'юнік' in name
        or 'юник' in name
        or 'унік' in name
        or 'уник' in name
        or 'uniqtrade' in name
        or 'uniq trade' in name
        or 'юнік трейд' in name
    )


def _supplier_public_name(supplier):
    return 'Юнік Трейд' if _is_utr_supplier(supplier) else str(getattr(supplier, 'name', '') or 'Постачальник')


def _supplier_has_credentials(supplier):
    if not getattr(supplier, 'is_active', True):
        return False
    if _is_utr_supplier(supplier):
        return bool(str(getattr(supplier, 'api_login', '') or '').strip() and str(getattr(supplier, 'api_password', '') or '').strip())
    return bool(str(getattr(supplier, 'api_key', '') or '').strip())


def _connected_suppliers(company):
    return [sup for sup in Supplier.objects.filter(company=company) if _supplier_has_credentials(sup)]


def _is_positive_qty(value):
    raw = str(value or '').strip().lower()
    if not raw or raw in {'-', '0', '0.0', 'немає', 'нет', 'none', 'null'}:
        return False
    if raw.startswith('>'):
        return True
    match = re.search(r'\d+(?:[\.,]\d+)?', raw)
    return bool(match and float(match.group(0).replace(',', '.')) > 0)


def _qty_sort_value(value):
    raw = str(value or '').strip()
    if raw.startswith('>'):
        return 999999
    match = re.search(r'\d+(?:[\.,]\d+)?', raw)
    return float(match.group(0).replace(',', '.')) if match else 0


def _bm_headers(api_key):
    token = str(api_key or '').strip()
    # BM Parts у кабінетах часто дає ключ уже в потрібному форматі. Якщо користувач
    # вставив чистий ключ без префікса — не ламаємо його, а відправляємо як є.
    return {
        'Authorization': token,
        'User-Agent': 'VIN-matrix',
        'Accept': 'application/json',
        'Accept-Language': 'uk',
    }


def _extract_products(payload):
    if not isinstance(payload, dict):
        return []
    products = payload.get('products', [])
    if isinstance(products, dict):
        return list(products.values())
    if isinstance(products, list):
        return products
    return []


def _bm_image_url(url):
    if not url:
        return ''
    url = str(url).replace('\\', '/').strip()
    if url.startswith('http://') or url.startswith('https://'):
        return url
    if url.startswith('/'):
        return f'https://cdn.bm.parts{url}'
    return f'https://cdn.bm.parts/{url}'


def _bm_prefs_map(supplier):
    prefs = supplier.warehouse_prefs if isinstance(supplier.warehouse_prefs, list) else []
    result = {}
    for pref in prefs:
        if not isinstance(pref, dict):
            continue
        if pref.get('id') is not None:
            result[str(pref.get('id'))] = pref
        if pref.get('name'):
            result[str(pref.get('name')).lower()] = pref
    return result



def _supplier_prefs_map(supplier):
    prefs = supplier.warehouse_prefs if isinstance(getattr(supplier, 'warehouse_prefs', None), list) else []
    result = {}
    for pref in prefs:
        if not isinstance(pref, dict):
            continue
        if pref.get('id') is not None:
            result[str(pref.get('id'))] = pref
        if pref.get('name'):
            result[str(pref.get('name')).lower()] = pref
    return result


def _is_kyiv_warehouse(name):
    text = str(name or '').lower().replace('i', 'і')
    return any(key in text for key in ['київ', 'киев', 'kyiv', 'kиїв', 'kиев'])


def _float_price(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _utr_price(item):
    if not isinstance(item, dict):
        return 0.0
    for key in ['yourPriceUAH', 'yourPrice', 'priceUAH', 'price']:
        value = item.get(key)
        if isinstance(value, dict):
            amount = value.get('amount')
        else:
            amount = value
        price = _float_price(amount)
        if price > 0:
            return price
    return 0.0


def _utr_image_url(image):
    if not image:
        return ''
    if isinstance(image, dict):
        url = image.get('fullImagePath') or image.get('thumbnail') or image.get('imagePath') or ''
    else:
        url = str(image)
    url = str(url or '').strip()
    if not url:
        return ''
    if url.startswith('http://') or url.startswith('https://'):
        return url
    if url.startswith('/'):
        return f'https://order24-file.utr.ua{url}'
    return f'https://order24-file.utr.ua/{url}'


def _utr_brand(item):
    if not isinstance(item, dict):
        return ''
    brand = item.get('displayBrand') or ''
    if not brand and isinstance(item.get('brand'), dict):
        brand = item.get('brand', {}).get('displayName') or item.get('brand', {}).get('name') or item.get('brand', {}).get('externalCode') or ''
    return str(brand or '').strip() or 'Unknown'


def _utr_article(item, fallback=''):
    return str((item or {}).get('article') or fallback or '').strip()


def _utr_title(item):
    return str((item or {}).get('title') or (item or {}).get('name') or 'Деталь Юнік Трейд').strip()


def _utr_fingerprint(supplier):
    fingerprint = str(getattr(supplier, 'browser_fingerprint', '') or '').strip()
    if fingerprint:
        return fingerprint[:128]
    base = f'vin-matrix-utr-{getattr(supplier, "company_id", "")}-{getattr(supplier, "id", "")}'
    fingerprint = hashlib.md5(base.encode('utf-8')).hexdigest()
    try:
        supplier.browser_fingerprint = fingerprint
        supplier.save(update_fields=['browser_fingerprint'])
    except Exception:
        pass
    return fingerprint


def _parse_utr_expires(value):
    if not value:
        return None
    raw = str(value).strip()
    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%dT%H:%M:%S']:
        try:
            parsed = timezone.datetime.strptime(raw, fmt)
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
        except Exception:
            pass
    try:
        parsed = timezone.datetime.fromisoformat(raw)
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed
    except Exception:
        return None


def _save_utr_tokens(supplier, data):
    if not isinstance(data, dict):
        return
    update_fields = []
    token = data.get('token')
    refresh = data.get('refresh_token')
    expires_at = _parse_utr_expires(data.get('expires_at'))
    if token:
        supplier.api_token = token
        update_fields.append('api_token')
    if refresh:
        supplier.api_refresh_token = refresh
        update_fields.append('api_refresh_token')
    if expires_at:
        supplier.api_token_expires_at = expires_at
        update_fields.append('api_token_expires_at')
    if update_fields:
        try:
            supplier.save(update_fields=update_fields)
        except Exception:
            supplier.save()


def _utr_login(supplier):
    fingerprint = _utr_fingerprint(supplier)
    res = requests.post(
        f'{UTR_API_BASE}/api/login_check',
        params={'browser_fingerprint': fingerprint},
        json={
            'email': str(getattr(supplier, 'api_login', '') or '').strip(),
            'password': str(getattr(supplier, 'api_password', '') or '').strip(),
        },
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
        timeout=12,
    )
    if res.status_code not in [200, 201]:
        return ''
    data = res.json() or {}
    _save_utr_tokens(supplier, data)
    return str(data.get('token') or '').strip()


def _utr_refresh(supplier):
    refresh = str(getattr(supplier, 'api_refresh_token', '') or '').strip()
    if not refresh:
        return ''
    res = requests.post(
        f'{UTR_API_BASE}/api/token/refresh',
        json={'refresh_token': refresh, 'browser_fingerprint': _utr_fingerprint(supplier)},
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
        timeout=12,
    )
    if res.status_code not in [200, 201]:
        return ''
    data = res.json() or {}
    _save_utr_tokens(supplier, data)
    return str(data.get('token') or '').strip()


def _utr_token(supplier):
    token = str(getattr(supplier, 'api_token', '') or '').strip()
    expires_at = getattr(supplier, 'api_token_expires_at', None)
    if token and expires_at and expires_at > timezone.now() + timedelta(minutes=2):
        return token
    token = _utr_refresh(supplier)
    if token:
        return token
    return _utr_login(supplier)


def _utr_request(supplier, path, *, params=None, method='get', json_payload=None, timeout=12, retry=True):
    token = _utr_token(supplier)
    if not token:
        return None
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
        'Language': 'ua',
    }
    url = f'{UTR_API_BASE}{path}'
    if method.lower() == 'post':
        res = requests.post(url, params=params or {}, json=json_payload, headers=headers, timeout=timeout)
    else:
        res = requests.get(url, params=params or {}, headers=headers, timeout=timeout)
    if res.status_code == 401 and retry:
        try:
            supplier.api_token = ''
            supplier.save(update_fields=['api_token'])
        except Exception:
            pass
        token = _utr_login(supplier)
        if token:
            return _utr_request(supplier, path, params=params, method=method, json_payload=json_payload, timeout=timeout, retry=False)
    return res


def _extract_utr_details(payload):
    if isinstance(payload, dict):
        details = payload.get('details') or payload.get('data') or payload.get('items') or []
        if isinstance(details, dict):
            return list(details.values())
        if isinstance(details, list):
            return details
        if payload.get('id'):
            return [payload]
    if isinstance(payload, list):
        return payload
    return []


def _utr_warehouses(supplier, item, price):
    prefs_map = _supplier_prefs_map(supplier)
    warehouses = []
    for row in item.get('remains') or item.get('stocks') or []:
        if not isinstance(row, dict):
            continue
        storage = row.get('storage') if isinstance(row.get('storage'), dict) else {}
        wh_id = str(storage.get('id') or row.get('storage_id') or row.get('id') or '').strip()
        wh_name = str(storage.get('name') or storage.get('originalName') or row.get('name') or 'Склад').strip()
        pref = prefs_map.get(wh_id) or prefs_map.get(wh_name.lower())
        if pref and not pref.get('is_active', True):
            continue
        quantity = str(row.get('remain') or row.get('quantity') or row.get('qty') or '0').strip()
        warehouses.append({
            'id': wh_id,
            'name': wh_name,
            'quantity': quantity,
            'priority': int(pref.get('priority', 99)) if pref else (1 if _is_kyiv_warehouse(wh_name) else 99),
            'buy_price': price,
        })
    warehouses = [w for w in warehouses if _is_positive_qty(w.get('quantity'))]
    warehouses.sort(key=lambda w: (
        0 if (_is_kyiv_warehouse(w.get('name')) and _is_positive_qty(w.get('quantity'))) else 1,
        0 if _is_positive_qty(w.get('quantity')) else 1,
        int(w.get('priority', 99)),
        -_qty_sort_value(w.get('quantity')),
    ))
    return warehouses


def _map_utr_product(supplier, item, query='', is_analog=False, sku_param='', orig_brand=''):
    if not isinstance(item, dict):
        return None
    detail_id = str(item.get('id') or item.get('detail_id') or '').strip()
    if not detail_id:
        return None
    if is_analog and sku_param and detail_id == str(sku_param):
        return None

    article = _utr_article(item, query)
    brand = _utr_brand(item)
    if not article:
        return None

    if not is_analog:
        q_clean = _clean_article(query)
        article_clean = _clean_article(article)
        if q_clean and article_clean and not (q_clean in article_clean or article_clean in q_clean):
            return None
    if orig_brand and not is_analog and brand.upper() != orig_brand.upper():
        return None

    price = _utr_price(item)
    warehouses = _utr_warehouses(supplier, item, price)
    if not warehouses:
        return None

    images = item.get('images') or []
    image_url = ''
    if isinstance(images, list) and images:
        image_url = _utr_image_url(images[0])

    first_wh = warehouses[0]
    category = item.get('category') if isinstance(item.get('category'), dict) else {}
    description = category.get('name') or _utr_title(item)

    return {
        'id': f'utr_{supplier.id}_{detail_id}',
        'supplier_id': supplier.id,
        'source': _supplier_public_name(supplier),
        'brand': brand,
        'article': article,
        'name': _utr_title(item),
        'buy_price': price,
        'quantity': f"{first_wh.get('quantity')} шт ({first_wh.get('name')})",
        'is_local': False,
        'warehouses': warehouses,
        'sku': detail_id,
        'min_qty': int(_float_price(item.get('multiplicity') or item.get('quantity') or 1) or 1),
        'image_url': image_url,
        'description': description,
    }


def _fetch_utr_search(supplier, query, *, is_analog=False, sku_param='', orig_brand=''):
    results = []
    seen = set()

    def add_details(details):
        for item in details:
            mapped = _map_utr_product(
                supplier,
                item,
                query=query,
                is_analog=is_analog,
                sku_param=sku_param,
                orig_brand=orig_brand,
            )
            if not mapped:
                continue
            key = f"{_clean_article(mapped.get('article'))}:{str(mapped.get('brand') or '').upper()}:{str(mapped.get('sku') or '')}"
            if key in seen:
                continue
            seen.add(key)
            results.append(mapped)

    def add_package_results(package_payload):
        if not isinstance(package_payload, list):
            return
        for row in package_payload:
            if not isinstance(row, dict):
                continue
            add_details(_extract_utr_details(row))

    def brand_titles_from_visible_brand(value):
        titles = []
        seen_titles = set()

        def add_title(raw):
            title = str(raw or '').strip()
            if not title:
                return
            key = title.upper()
            if key in seen_titles:
                return
            seen_titles.add(key)
            titles.append(title)

        def walk(node):
            if isinstance(node, dict):
                add_title(node.get('title') or node.get('name') or node.get('displayName') or node.get('externalCode'))
                for child in node.get('synonyms') or []:
                    walk(child)
                for child in node.get('aliases') or []:
                    alias = child.get('alias') if isinstance(child, dict) else child
                    walk(alias)
                parent = node.get('parent')
                if parent:
                    walk(parent)
            elif isinstance(node, list):
                for child in node:
                    walk(child)

        walk(value)
        return titles

    def collect_cross_queries(value):
        queries = []
        seen_queries = set()
        cross_keys = {
            'analogs', 'analogues', 'crosses', 'crosscodes', 'cross_codes', 'replacements',
            'replaces', 'substitutes', 'substitution', 'oe', 'oem', 'oems', 'oecodes', 'oe_codes',
        }

        def add_query(code, brand=''):
            code = str(code or '').strip()
            brand = str(brand or '').strip()
            if not code:
                return
            key = f'{_clean_article(code)}::{brand.upper()}'
            if key in seen_queries:
                return
            seen_queries.add(key)
            if brand:
                queries.append({'oem': code, 'brand': brand})
            else:
                queries.append({'oem': code})

        def walk(node, active=False):
            if isinstance(node, dict):
                if active:
                    code = node.get('article') or node.get('oem') or node.get('number') or node.get('code') or node.get('scanCode') or node.get('value')
                    brand_value = node.get('brand') or node.get('displayBrand') or node.get('brandName')
                    if isinstance(brand_value, dict):
                        brand_value = brand_value.get('name') or brand_value.get('displayName') or brand_value.get('title')
                    add_query(code, brand_value)
                for key, child in node.items():
                    walk(child, active or str(key).lower() in cross_keys)
            elif isinstance(node, list):
                for child in node:
                    walk(child, active)
            elif active:
                add_query(node)

        walk(value)
        return queries

    if is_analog:
        # UTR у відкритій документації описує пошук по артикулу та пакетний пошук,
        # але не має окремого стабільного endpoint як getAllCrosses. Тому робимо
        # багаторівневий fallback: спершу шукаємо кроси в detail, потім через
        # пакетний пошук по знайдених кодах/бренд-синонімах, потім прямий пошук
        # цього артикулу без brand-фільтра як альтернативні пропозиції UTR.
        detail = None
        if sku_param:
            try:
                detail_res = _utr_request(supplier, f'/api/detail/{urllib.parse.quote(str(sku_param))}', timeout=10)
                if detail_res is not None and detail_res.status_code == 200:
                    detail = detail_res.json() or {}
                    analog_queries = collect_cross_queries(detail)

                    visible_brands = brand_titles_from_visible_brand(detail.get('visibleBrand') if isinstance(detail, dict) else None)
                    detail_article = _utr_article(detail, query)
                    for brand_title in visible_brands:
                        if brand_title and brand_title.upper() != str(orig_brand or '').upper():
                            analog_queries.append({'oem': detail_article or query, 'brand': brand_title})

                    if analog_queries:
                        payload = {'details': analog_queries[:30]}
                        batch_res = _utr_request(supplier, '/api/search', method='post', json_payload=payload, timeout=15)
                        if batch_res is not None and batch_res.status_code == 200:
                            add_package_results(batch_res.json())
            except Exception:
                pass

        if not results:
            try:
                res = _utr_request(supplier, f'/api/search/{urllib.parse.quote(str(query))}', params={'info': 1}, timeout=15)
                if res is not None and res.status_code == 200:
                    add_details(_extract_utr_details(res.json()))
            except Exception:
                pass

        original_article = _clean_article(query)
        original_brand = str(orig_brand or '').upper()
        results = [
            item for item in results
            if not (
                _clean_article(item.get('article')) == original_article
                and str(item.get('brand') or '').upper() == original_brand
                and str(item.get('sku') or '') == str(sku_param or '')
            )
        ]
        return results

    params = {'info': 1}
    if orig_brand:
        params['brand'] = orig_brand

    try:
        res = _utr_request(supplier, f'/api/search/{urllib.parse.quote(str(query))}', params=params, timeout=15)
        if res is not None and res.status_code == 200:
            add_details(_extract_utr_details(res.json()))
    except Exception:
        pass

    return results

def _map_bm_product(supplier, item, query='', is_analog=False, sku_param='', orig_brand=''):
    if not isinstance(item, dict):
        return None

    item_uuid = str(item.get('uuid') or item.get('id') or '').strip()
    if not item_uuid:
        return None
    if is_analog and sku_param and item_uuid == sku_param:
        return None

    article = str(item.get('article') or query or '').strip()
    brand = str(item.get('brand') or 'Unknown').strip()
    if not article:
        return None

    if not is_analog:
        q_clean = _clean_article(query)
        article_clean = _clean_article(article)
        # Основний пошук BM має бути прямим артикульним пошуком, як у інших постачальників.
        if q_clean and article_clean and not (q_clean in article_clean or article_clean in q_clean):
            return None

    if orig_brand and not is_analog and brand.upper() != orig_brand.upper():
        # Якщо API повернув інший бренд при прямому пошуку з брендом — не змішуємо сміття.
        # Без бренду користувач і далі бачить усі прямі збіги по коду.
        return None

    prefs_map = _bm_prefs_map(supplier)
    warehouses = []
    price = float(item.get('price') or 0)

    for wh in item.get('in_stocks', []) or []:
        wh_id = str(wh.get('uuid') or wh.get('id') or '').strip()
        wh_name = str(wh.get('short_name') or wh.get('name') or 'Склад').strip()
        pref = prefs_map.get(wh_id) or prefs_map.get(wh_name.lower())
        if pref and not pref.get('is_active', True):
            continue
        quantity = str(wh.get('quantity') or '0').strip()
        warehouses.append({
            'name': wh_name,
            'quantity': quantity,
            'priority': int(pref.get('priority', 99)) if pref else 99,
            'buy_price': price,
        })

    in_others = item.get('in_others') or {}
    if isinstance(in_others, dict) and _is_positive_qty(in_others.get('quantity')):
        wh_name = str(in_others.get('name') or 'Інші склади').strip()
        pref = prefs_map.get(str(in_others.get('uuid') or '')) or prefs_map.get(wh_name.lower())
        if not pref or pref.get('is_active', True):
            warehouses.append({
                'name': wh_name,
                'quantity': str(in_others.get('quantity')),
                'priority': int(pref.get('priority', 99)) if pref else 99,
                'buy_price': price,
            })

    if not warehouses:
        return None

    warehouses.sort(key=lambda w: (0 if _is_positive_qty(w.get('quantity')) else 1, int(w.get('priority', 99)), -_qty_sort_value(w.get('quantity'))))
    first_wh = warehouses[0]

    return {
        'id': f'bm_{supplier.id}_{item_uuid}',
        'supplier_id': supplier.id,
        'source': supplier.name,
        'brand': brand,
        'article': article,
        'name': item.get('name') or 'Деталь BM Parts',
        'buy_price': price,
        'quantity': f"{first_wh.get('quantity')} шт ({first_wh.get('name')})",
        'is_local': False,
        'warehouses': warehouses,
        'sku': item_uuid,
        'min_qty': int(float(item.get('multiplicity') or 1)),
        'image_url': _bm_image_url(item.get('default_image')),
        'description': item.get('description') or item.get('nodes') or '',
    }


def _fetch_bm_search(supplier, query, *, is_analog=False, sku_param='', orig_brand=''):
    headers = _bm_headers(supplier.api_key)
    results = []
    seen = set()

    def add_products(products):
        for item in products:
            mapped = _map_bm_product(
                supplier,
                item,
                query=query,
                is_analog=is_analog,
                sku_param=sku_param,
                orig_brand=orig_brand,
            )
            if not mapped:
                continue
            key = f"{_clean_article(mapped.get('article'))}:{str(mapped.get('brand') or '').upper()}"
            if key in seen:
                continue
            seen.add(key)
            results.append(mapped)

    if is_analog and sku_param:
        try:
            product_url = f"{BM_API_BASE}/product/{urllib.parse.quote(str(sku_param))}"
            resp = requests.get(
                product_url,
                params={
                    'output_field': 'analogs',
                    'analogs_available': 1,
                    'available': 1,
                    'warehouses': 'all',
                    'products_as': 'arr',
                    'save': 0,
                },
                headers=headers,
                timeout=15,
            )
            if resp.status_code == 200:
                product = (resp.json() or {}).get('product', {})
                analogs = product.get('analogs', []) if isinstance(product, dict) else []
                if isinstance(analogs, dict):
                    analogs = list(analogs.values())
                add_products(analogs if isinstance(analogs, list) else [])
        except Exception:
            pass

    # Fallback і основний пошук. Для аналогів extended запускаємо тільки якщо product/{uuid}
    # не дав результату. Для прямого пошуку використовуємо strict, щоб не змішувати кроси.
    if not results:
        params = {
            'q': query,
            'products_as': 'arr',
            'warehouses': 'all',
            'available': 1,
            'save': 0,
            'search_mode': 'extended' if is_analog else 'strict',
        }
        if orig_brand and not is_analog:
            params['brands'] = orig_brand
        try:
            resp = requests.get(f'{BM_API_BASE}/search/products', params=params, headers=headers, timeout=15)
            if resp.status_code == 200:
                add_products(_extract_products(resp.json()))
        except Exception:
            pass

    if is_analog:
        original_article = _clean_article(query)
        original_brand = str(orig_brand or '').upper()
        results = [
            item for item in results
            if not (_clean_article(item.get('article')) == original_article and str(item.get('brand') or '').upper() == original_brand)
        ]

    return results


class CategoryViewSet(SafeCategoryViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class InventoryItemViewSet(SafeInventoryItemViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class SupplierViewSet(SafeSupplierViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]

    @action(detail=True, methods=['get'], url_path='part_info')
    def part_info(self, request, pk=None):
        base_sup = self.get_object()
        company = base_sup.company
        suppliers = _connected_suppliers(company)

        article = request.query_params.get('article', '').strip()
        brand = request.query_params.get('brand', '').strip().upper()
        sku_param = request.query_params.get('sku', '').strip()

        info_data = {'properties': [], 'applicability': [], 'images': []}
        if not article:
            return Response(info_data)

        seen_props, seen_apps, seen_images = set(), set(), set()

        def add_prop(name, value):
            if not name or value in [None, '', [], {}]:
                return
            key = f'{name}:{value}'.lower().strip()
            if key not in seen_props:
                info_data['properties'].append({'name': str(name), 'value': str(value)})
                seen_props.add(key)

        def add_app(value):
            if not value:
                return
            key = str(value).strip().lower()
            if key and key not in seen_apps:
                info_data['applicability'].append(str(value).strip())
                seen_apps.add(key)

        def add_img(url):
            url = _bm_image_url(url) if url and not str(url).startswith(('http://', 'https://')) else str(url or '').strip()
            if url and url not in seen_images:
                info_data['images'].append(url)
                seen_images.add(url)

        def fetch_bm(sup):
            try:
                headers = _bm_headers(sup.api_key)
                product_uuid = sku_param if _is_bm_supplier(base_sup) and sku_param else ''

                if not product_uuid:
                    params = {'q': article, 'products_as': 'arr', 'warehouses': 'all', 'search_mode': 'strict', 'save': 0}
                    if brand:
                        params['brands'] = brand
                    res = requests.get(f'{BM_API_BASE}/search/products', params=params, headers=headers, timeout=8)
                    if res.status_code == 200:
                        for item in _extract_products(res.json()):
                            if _clean_article(item.get('article')) == _clean_article(article) and (not brand or str(item.get('brand', '')).upper() == brand):
                                product_uuid = str(item.get('uuid') or '')
                                add_img(item.get('default_image'))
                                if item.get('nodes'):
                                    add_prop('Група', item.get('nodes'))
                                if item.get('description'):
                                    add_prop('Опис', item.get('description'))
                                break

                if not product_uuid:
                    return

                detail_res = requests.get(
                    f'{BM_API_BASE}/product/{urllib.parse.quote(product_uuid)}',
                    params={'output_field': 'all', 'warehouses': 'all', 'products_as': 'arr', 'oe': 'full', 'save': 0},
                    headers=headers,
                    timeout=10,
                )
                if detail_res.status_code != 200:
                    return
                product = (detail_res.json() or {}).get('product', {})
                if not isinstance(product, dict):
                    return

                add_img(product.get('default_image'))
                for img in product.get('images') or []:
                    add_img(img)
                if product.get('nodes'):
                    add_prop('Група', product.get('nodes'))
                if product.get('description'):
                    add_prop('Опис', product.get('description'))
                if product.get('weight'):
                    add_prop('Вага (кг)', product.get('weight'))
                if product.get('barcodes'):
                    add_prop('Штрихкоди', ', '.join(map(str, product.get('barcodes') or [])))
                if product.get('details') and isinstance(product.get('details'), dict):
                    for name, value in product.get('details').items():
                        add_prop(name, value)
                if product.get('oe'):
                    oe_values = []
                    for oe in product.get('oe') or []:
                        if isinstance(oe, dict):
                            oe_values.append(f"{oe.get('number', '')} ({oe.get('brand', '')})".strip())
                    if oe_values:
                        add_prop('Оригінальні (OE) коди', ', '.join(oe_values))
                for car in product.get('cars') or []:
                    if isinstance(car, dict):
                        add_app(' '.join(str(car.get(k, '')).strip() for k in ['brand', 'model', 'modification'] if car.get(k)))
                    else:
                        add_app(car)
            except Exception:
                pass

        def fetch_tehno(sup):
            try:
                b_res = requests.post('https://api.tehnomir.com.ua/info/getBrandsByCode', json={'apiToken': sup.api_key.strip(), 'code': article}, timeout=5)
                brand_id = None
                if b_res.status_code == 200 and b_res.json().get('success'):
                    brands = b_res.json().get('data', [])
                    for item in brands:
                        if str(item.get('brand', '')).upper() == brand:
                            brand_id = item.get('brandId')
                            break
                    if not brand_id and brands:
                        brand_id = brands[0].get('brandId')
                if brand_id:
                    info_res = requests.post('https://api.tehnomir.com.ua/info/getProductInfo', json={'apiToken': sup.api_key.strip(), 'brandId': brand_id, 'code': article}, timeout=10)
                    if info_res.status_code == 200 and info_res.json().get('success'):
                        data = info_res.json().get('data', {})
                        for prop in data.get('properties', []) or []:
                            add_prop(prop.get('name'), prop.get('value'))
                        for img in data.get('images', []) or []:
                            add_img(img.get('image') if isinstance(img, dict) else img)
            except Exception:
                pass

        def fetch_omega(sup):
            try:
                prod_id = None
                if sku_param:
                    try:
                        prod_id = int(sku_param)
                    except Exception:
                        prod_id = None
                if not prod_id:
                    res = requests.post('https://public.omega.page/public/api/v1.0/product/search', json={'Key': sup.api_key.strip(), 'SearchPhrase': article, 'From': 0, 'Count': 10}, timeout=5)
                    if res.status_code == 200:
                        for item in res.json().get('Result', []) or res.json().get('Data', []):
                            if not brand or str(item.get('BrandDescription', '')).upper() == brand:
                                prod_id = int(item.get('ProductId', 0) or 0)
                                add_img(item.get('ImageUrl'))
                                if item.get('Weight'):
                                    add_prop('Вага (кг)', item.get('Weight'))
                                if item.get('Info'):
                                    add_prop('Додатково', item.get('Info'))
                                break
                if prod_id:
                    det_res = requests.post('https://public.omega.page/public/api/v1.0/product/details', json={'Key': sup.api_key.strip(), 'ProductIdList': [prod_id]}, timeout=10)
                    if det_res.status_code == 200:
                        data_list = det_res.json().get('Data', [])
                        if data_list:
                            product = data_list[0]
                            for spec in product.get('SpecificationList', []) or []:
                                add_prop(spec.get('Descr') or spec.get('Key'), spec.get('Value'))
                            if product.get('OECodeList'):
                                add_prop('Оригінальні (OE) коди', ', '.join([f"{oe.get('Code')} ({oe.get('CarModel', '')})" for oe in product.get('OECodeList', [])]))
                            for app in product.get('ApplicabilityList', []) or []:
                                name = app.get('Name', '')
                                children = app.get('Children', [])
                                if children:
                                    for child in children:
                                        add_app(f"{name} {child.get('Name', '')}")
                                else:
                                    add_app(name)
            except Exception:
                pass

        def fetch_vesna(sup):
            try:
                parts = sup.api_key.split(':')
                customer_id = int(parts[0]) if len(parts) > 1 else 0
                token = (parts[1] if len(parts) > 1 else sup.api_key).replace('Token', '').replace('token', '').strip()
                res = requests.post(
                    'https://api.vesna-auto.com.ua/public-api/search-methods/search-by-article/',
                    json={'customer_id': customer_id, 'article': article},
                    headers={'Authorization': f'Token {token}', 'Content-Type': 'application/json', 'Accept-Language': 'uk'},
                    timeout=5,
                )
                if res.status_code == 200:
                    items = res.json().get('data', []) if isinstance(res.json(), dict) else res.json()
                    for item in items if isinstance(items, list) else []:
                        if not brand or str(item.get('brand', '')).upper() == brand:
                            add_img(item.get('image') or item.get('picture'))
                            if item.get('description'):
                                add_prop('Опис', item.get('description'))
                            break
            except Exception:
                pass

        def fetch_utr(sup):
            try:
                detail_id = sku_param if _is_utr_supplier(base_sup) and sku_param else ''

                if not detail_id:
                    params = {'info': 1}
                    if brand:
                        params['brand'] = brand
                    res = _utr_request(sup, f'/api/search/{urllib.parse.quote(str(article))}', params=params, timeout=10)
                    if res is not None and res.status_code == 200:
                        for item in _extract_utr_details(res.json()):
                            item_brand = _utr_brand(item)
                            if _clean_article(item.get('article')) == _clean_article(article) and (not brand or item_brand.upper() == brand):
                                detail_id = str(item.get('id') or '')
                                for img in item.get('images') or []:
                                    add_img(_utr_image_url(img))
                                category = item.get('category') if isinstance(item.get('category'), dict) else {}
                                if category.get('name'):
                                    add_prop('Категорія', category.get('name'))
                                if item.get('title'):
                                    add_prop('Опис', item.get('title'))
                                break

                if not detail_id:
                    return

                detail_res = _utr_request(sup, f'/api/detail/{urllib.parse.quote(str(detail_id))}', timeout=10)
                if detail_res is not None and detail_res.status_code == 200:
                    detail = detail_res.json() or {}
                    for img in detail.get('images') or []:
                        add_img(_utr_image_url(img))
                    category = detail.get('category') if isinstance(detail.get('category'), dict) else {}
                    if category.get('name'):
                        add_prop('Категорія', category.get('name'))
                    if detail.get('title'):
                        add_prop('Опис', detail.get('title'))
                    if detail.get('displayBrand'):
                        add_prop('Бренд', detail.get('displayBrand'))
                    if detail.get('detailScanCodes'):
                        codes = []
                        for code in detail.get('detailScanCodes') or []:
                            if isinstance(code, dict) and code.get('scanCode'):
                                codes.append(str(code.get('scanCode')))
                        if codes:
                            add_prop('Штрихкоди', ', '.join(codes))
                    info = detail.get('detailInfo') or []
                    if isinstance(info, dict):
                        for name, value in info.items():
                            add_prop(name, value)
                    elif isinstance(info, list):
                        for row in info:
                            if isinstance(row, dict):
                                attr = row.get('attribute') if isinstance(row.get('attribute'), dict) else {}
                                add_prop(attr.get('title') or attr.get('name') or row.get('name'), row.get('value') or row.get('title'))

                char_res = _utr_request(sup, f'/api/characteristics/{urllib.parse.quote(str(detail_id))}', timeout=10)
                if char_res is not None and char_res.status_code == 200:
                    chars = char_res.json()
                    if isinstance(chars, list):
                        for row in chars:
                            if not isinstance(row, dict):
                                continue
                            attr = row.get('attribute') if isinstance(row.get('attribute'), dict) else {}
                            add_prop(attr.get('title') or attr.get('name') or row.get('name'), row.get('value'))

                app_res = _utr_request(sup, f'/api/applicability/{urllib.parse.quote(str(detail_id))}', timeout=10)
                if app_res is not None and app_res.status_code == 200:
                    apps = app_res.json()
                    def walk_app(value):
                        if isinstance(value, dict):
                            label = ' '.join(str(value.get(k, '')).strip() for k in ['brand', 'model', 'modification', 'name', 'title'] if value.get(k))
                            if label:
                                add_app(label)
                            for child in value.get('children') or value.get('items') or value.get('models') or []:
                                walk_app(child)
                        elif isinstance(value, list):
                            for child in value:
                                walk_app(child)
                        elif value:
                            add_app(value)
                    walk_app(apps)
            except Exception:
                pass

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for sup in suppliers:
                name = sup.name.lower()
                if _is_bm_supplier(sup):
                    futures.append(executor.submit(fetch_bm, sup))
                elif 'omega' in name or 'омега' in name:
                    futures.append(executor.submit(fetch_omega, sup))
                elif 'tehnomir' in name or 'техномир' in name:
                    futures.append(executor.submit(fetch_tehno, sup))
                elif 'vesna' in name or 'весна' in name:
                    futures.append(executor.submit(fetch_vesna, sup))
                elif _is_utr_supplier(sup):
                    futures.append(executor.submit(fetch_utr, sup))
            for _ in as_completed(futures):
                pass

        return Response(info_data)


class MechanicViewSet(SafeMechanicViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class PartSearchView(BasePartSearchView):
    permission_classes = [IsAuthenticated, HasPaidAccess]

    def get(self, request):
        """Use the old search for all suppliers, but replace strict API adapters with normalized results."""
        response = super().get(request)

        try:
            company = safe_ensure_company(request.user)
            query = request.query_params.get('q', '').strip()
            is_analog = request.query_params.get('analog') == 'true'
            sup_id = request.query_params.get('supplier_id')
            sku_param = request.query_params.get('sku', '').strip()
            orig_brand = request.query_params.get('brand', '').strip().upper()

            if not company or not query or not isinstance(response.data, list):
                return response

            # Прибираємо сирі BM-результати з базового пошуку, бо там API повертає
            # кроси без потрібної нам логіки складів/аналогів.
            cleaned = [item for item in response.data if not (_is_bm_supplier(item.get('source')) or _is_utr_supplier(item.get('source')))]
            # Для запиту аналогів з конкретного постачальника не даємо базовому
            # пошуку підмішати результати інших постачальників. Кнопка "Аналоги"
            # має показувати саме аналоги того постачальника, з картки якого її натиснули.
            if is_analog and sup_id:
                cleaned = [item for item in cleaned if str(item.get('supplier_id')) == str(sup_id)]

            connected_suppliers = _connected_suppliers(company)
            bm_suppliers = [sup for sup in connected_suppliers if _is_bm_supplier(sup)]
            utr_suppliers = [sup for sup in connected_suppliers if _is_utr_supplier(sup)]

            if is_analog and sup_id:
                bm_suppliers = [sup for sup in bm_suppliers if str(sup.id) == str(sup_id)]
                utr_suppliers = [sup for sup in utr_suppliers if str(sup.id) == str(sup_id)]

            for sup in bm_suppliers:
                cleaned.extend(_fetch_bm_search(
                    sup,
                    query,
                    is_analog=is_analog,
                    sku_param=sku_param,
                    orig_brand=orig_brand,
                ))

            for sup in utr_suppliers:
                cleaned.extend(_fetch_utr_search(
                    sup,
                    query,
                    is_analog=is_analog,
                    sku_param=sku_param,
                    orig_brand=orig_brand,
                ))

            cleaned.sort(key=lambda item: (
                0 if any(_is_positive_qty(w.get('quantity')) for w in item.get('warehouses', []) or []) else 1,
                float(item.get('buy_price') or 0),
            ))
            response.data = cleaned
        except Exception:
            pass

        return response
