from django.urls import path
from .views import (
    AddToCartView, 
    CheckoutVisitView, 
    UpdateItemStatusView,
    AddServiceToVisitView,  # Новий імпорт
    ExportVisitPDFView      # Новий імпорт
)

urlpatterns = [
    path('cart/add/', AddToCartView.as_view(), name='add_to_cart'),
    path('cart/<int:visit_id>/checkout/', CheckoutVisitView.as_view(), name='checkout_visit'),
    path('item/<int:item_id>/status/', UpdateItemStatusView.as_view(), name='update_item_status'), 
    
    # --- НОВІ МАРШРУТИ ---
    # Додавання послуги/роботи до візиту
    path('visits/add-service/', AddServiceToVisitView.as_view(), name='add_service'),
    
    # Генерація наряд-замовлення для друку/PDF
    path('visits/<int:visit_id>/pdf/', ExportVisitPDFView.as_view(), name='export_pdf'),
]
