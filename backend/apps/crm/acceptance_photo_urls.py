from django.urls import path

from .acceptance_photo_views import (
    VehicleConditionHistoryView,
    VisitAcceptancePhotoDetailView,
    VisitAcceptancePhotoFileView,
    VisitAcceptancePhotoListCreateView,
)


urlpatterns = [
    path('', VisitAcceptancePhotoListCreateView.as_view(), name='visit-acceptance-photo-list-create'),
    path('vehicle-history/', VehicleConditionHistoryView.as_view(), name='vehicle-condition-history'),
    path('<int:pk>/', VisitAcceptancePhotoDetailView.as_view(), name='visit-acceptance-photo-detail'),
    path('<int:pk>/file/', VisitAcceptancePhotoFileView.as_view(), name='visit-acceptance-photo-file'),
]
