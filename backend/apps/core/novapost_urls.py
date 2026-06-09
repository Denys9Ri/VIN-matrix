from django.urls import path

from .novapost_views import (
    NovaPostCitiesView,
    NovaPostDeliveryCreateView,
    NovaPostDeliveryStatusView,
    NovaPostDeliveryView,
    NovaPostProfileDetailView,
    NovaPostProfileListCreateView,
    NovaPostProfileTestView,
    NovaPostWarehousesView,
)

urlpatterns = [
    path('profiles/', NovaPostProfileListCreateView.as_view(), name='novapost-profile-list'),
    path('profiles/<int:pk>/', NovaPostProfileDetailView.as_view(), name='novapost-profile-detail'),
    path('profiles/<int:pk