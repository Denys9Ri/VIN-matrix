from django.urls import path
from .views import UnifiedSearchView, UploadPricesView

urlpatterns = [
    # Пошук по артикулу (Омега + локальна база)
    # URL: /api/integrations/search/?part_number=OC90
    path('search/', UnifiedSearchView.as_view(), name='unified_search'),
    
    # Завантаження Excel прайсу
    # URL: /api/integrations/upload-prices/
    path('upload-prices/', UploadPricesView.as_view(), name='upload_prices'),
]
