from django.urls import path
from .views import AddToCartView

urlpatterns = [
    path('cart/add/', AddToCartView.as_view(), name='add_to_cart'),
]
