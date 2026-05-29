import re

from rest_framework.permissions import IsAuthenticated

from .access_control import HasPaidAccess
from .safe_crm_views import (
    CategoryViewSet as SafeCategoryViewSet,
    InventoryItemViewSet as SafeInventoryItemViewSet,
    SupplierViewSet as SafeSupplierViewSet,
    MechanicViewSet as SafeMechanicViewSet,
)
from .views import PartSearchView as BasePartSearchView


def _clean_article(value):
    """Normalize supplier articles for strict code comparison."""
    return re.sub(r'[^A-ZА-ЯІЇЄҐ0-9]', '', str(value or '').upper())


class CategoryViewSet(SafeCategoryViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class InventoryItemViewSet(SafeInventoryItemViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class SupplierViewSet(SafeSupplierViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class MechanicViewSet(SafeMechanicViewSet):
    permission_classes = [IsAuthenticated, HasPaidAccess]


class PartSearchView(BasePartSearchView):
    permission_classes = [IsAuthenticated, HasPaidAccess]

    def get(self, request):
        """
        BM Parts /search/products працює як розширений пошук і часто повертає
        кроси та схожі фільтри вже в основній видачі. Для нашої логіки основний
        пошук має працювати як у інших постачальників: спочатку показуємо тільки
        прямі збіги по артикулу, а аналоги відкриваємо окремою кнопкою.
        """
        response = super().get(request)

        try:
            is_analog = request.query_params.get('analog') == 'true'
            query = request.query_params.get('q', '').strip()
            q_clean = _clean_article(query)

            if is_analog or not q_clean or not isinstance(response.data, list):
                return response

            filtered = []
            for item in response.data:
                source = str(item.get('source') or '').lower()
                if 'bm' not in source:
                    filtered.append(item)
                    continue

                article_clean = _clean_article(item.get('article'))
                # Для BM в основному пошуку залишаємо тільки прямі артикульні збіги.
                # Наприклад OC90 залишить OC90 / OC90F / OC90 OF, але прибере LS370,
                # WL129 та інші кроси, які мають зʼявлятися лише через "Пошук аналогів".
                if article_clean and (q_clean in article_clean or article_clean in q_clean):
                    filtered.append(item)

            response.data = filtered
        except Exception:
            # Пошук не має падати через фільтр. Якщо щось не так — повертаємо базову відповідь.
            pass

        return response
