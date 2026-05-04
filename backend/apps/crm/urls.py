from django.urls import path
from .views import AddToCartView, CheckoutVisitView, UpdateItemStatusView

urlpatterns = [
    path('cart/add/', AddToCartView.as_view(), name='add_to_cart'),
    path('cart/<int:visit_id>/checkout/', CheckoutVisitView.as_view(), name='checkout_visit'),
    path('item/<int:item_id>/status/', UpdateItemStatusView.as_view(), name='update_item_status'), # <--- Новий рядок
]
