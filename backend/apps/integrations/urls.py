from django.urls import path
from .views import UnifiedSearchView, UploadPricesView

urlpatterns = [
    # Пошук запчастин (Омега + локальні прайси)
    path('search/', UnifiedSearchView.as_view(), name='unified_search'),
    
    # Завантаження Excel-файлів із цінами
    path('upload-prices/', UploadPricesView.as_view(), name='upload_prices'),
]
