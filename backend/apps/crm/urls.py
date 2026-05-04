from django.urls import path
from .views import AddToCartView, CheckoutVisitView

urlpatterns = [
    path('cart/add/', AddToCartView.as_view(), name='add_to_cart'),
    path('cart/<int:visit_id>/checkout/', CheckoutVisitView.as_view(), name='checkout_visit'),
]
