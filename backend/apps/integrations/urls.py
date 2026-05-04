from django.urls import path
from .views import UnifiedSearchView, UploadSupplierPriceView

urlpatterns = [
    path('search/', UnifiedSearchView.as_view(), name='unified_search'),
    path('suppliers/upload/', UploadSupplierPriceView.as_view(), name='upload_supplier_price'),
]
