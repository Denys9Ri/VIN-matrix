from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UnifiedSearchView, UploadPricesView, SupplierConfigViewSet

router = DefaultRouter()
router.register(r'suppliers', SupplierConfigViewSet, basename='suppliers')

urlpatterns = [
    path('', include(router.urls)), # Тут будуть /suppliers/
    path('search/', UnifiedSearchView.as_view(), name='unified_search'),
    path('upload-prices/', UploadPricesView.as_view(), name='upload_prices'),
]
