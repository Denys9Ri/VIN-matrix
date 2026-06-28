import re

from rest_framework.test import APIRequestFactory, force_authenticate

from apps.core.paid_views import PartSearchView

from .services import require_agent_member


_factory = APIRequestFactory()


def clean_article(value):
    return re.sub(r'[^A-ZА-ЯІЇЄҐ0-9]', '', str(value or '').upper())


def clean_brand(value):
    return ' '.join(str(value or '').upper().split())


def _search(user, params):
    request = _factory.get('/api/search-parts/', data=params)
    force_authenticate(request, user=user)
    response = PartSearchView.as_view()(request)
    if response.status_code >= 400:
        raise ValueError(getattr(response, 'data', None) or 'Пошук недоступний.')
    return response.data if isinstance(response.data, list) else []


def _offer(item):
    return {
        'id': item.get('id', ''),
        'supplier_id': item.get('supplier_id'),
        'source': item.get('source', ''),
        'brand': item.get('brand', ''),
        'article': item.get('article', ''),
        'name': item.get('name', ''),
        'buy_price': item.get('buy_price', 0),
        'quantity': item.get('quantity', ''),
        'warehouses': item.get('warehouses', []),
        'sku': item.get('sku', ''),
        'min_qty': item.get('min_qty', 1),
    }


def _sorted(items):
    def price(item):
        try:
            return float(item.get('buy_price') or 0)
        except (TypeError, ValueError):
            return 0.0
    return sorted(items, key=lambda item: (price(item) <= 0, price(item)))


def search_original(user, article):
    _, _, access = require_agent_member(user)
    if not access.can_search_parts:
        raise PermissionError('Немає права шукати запчастини через Agent.')
    article = clean_article(article)
    if len(article) < 3:
        raise ValueError('Некоректний артикул.')
    return _sorted([
        _offer(item) for item in _search(user, {'q': article})
        if clean_article(item.get('article')) == article
    ])


def search_analogs(user, original_offer):
    _, _, access = require_agent_member(user)
    if not access.can_search_parts:
        raise PermissionError('Немає права шукати запчастини через Agent.')
    article = clean_article(original_offer.get('article'))
    supplier_id = original_offer.get('supplier_id')
    sku = str(original_offer.get('sku') or '').strip()
    if not article or not supplier_id or not sku:
        raise ValueError('Оберіть точну пропозицію оригіналу з постачальником.')
    source_brand = clean_brand(original_offer.get('brand'))
    results = _search(user, {
        'q': article,
        'analog': 'true',
        'supplier_id': supplier_id,
        'sku': sku,
        'brand': original_offer.get('brand', ''),
    })
    seen = set()
    offers = []
    for item in results:
        key = (clean_brand(item.get('brand')), clean_article(item.get('article')))
        if not key[1] or key == (source_brand, article) or key in seen:
            continue
        seen.add(key)
        offers.append(_offer(item))
    return _sorted(offers)


def search_selected_analog(user, article, brand):
    _, _, access = require_agent_member(user)
    if not access.can_search_parts:
        raise PermissionError('Немає права шукати запчастини через Agent.')
    article = clean_article(article)
    brand = clean_brand(brand)
    if len(article) < 3 or not brand:
        raise ValueError('Потрібні точні артикул і бренд аналога.')
    return _sorted([
        _offer(item) for item in _search(user, {'q': article})
        if clean_article(item.get('article')) == article
        and clean_brand(item.get('brand')) == brand
    ])
