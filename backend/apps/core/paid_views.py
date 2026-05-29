import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
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


def _clean_article(value):
    """Normalize supplier articles for strict code comparison."""
    return re.sub(r'[^A-ZА-ЯІЇЄҐ0-9]', '', str(value or '').upper())


def _is_bm_supplier(supplier_or_name):
    name = str(getattr(supplier_or_name, 'name', supplier_or_name) or '').lower()
    return 'bm' in name or 'bm.parts' in name or 'bm-parts' in name


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
        suppliers = Supplier.objects.filter(company=company).exclude(api_key='')

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

        with ThreadPoolExecutor(max_workers=4) as executor:
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
            for _ in as_completed(futures):
                pass

        return Response(info_data)


class MechanicViewSet(SafeMechanicViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class PartSearchView(BasePartSearchView):
    permission_classes = [IsAuthenticated, HasPaidAccess]

    def get(self, request):
        """Use the old search for all suppliers, but replace BM Parts with a strict adapter."""
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
            cleaned = [item for item in response.data if not _is_bm_supplier(item.get('source'))]

            bm_suppliers = Supplier.objects.filter(company=company).exclude(api_key='')
            bm_suppliers = [sup for sup in bm_suppliers if _is_bm_supplier(sup)]
            if is_analog and sup_id:
                bm_suppliers = [sup for sup in bm_suppliers if str(sup.id) == str(sup_id)]

            for sup in bm_suppliers:
                cleaned.extend(_fetch_bm_search(
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
