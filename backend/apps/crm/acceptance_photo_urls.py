from django.urls import path

from .acceptance_photo_views import (
    VisitAcceptancePhotoDetailView,
    VisitAcceptancePhotoFileView,
    VisitAcceptancePhotoListCreateView,
)


urlpatterns = [
    path('', VisitAcceptancePhotoListCreateView.as_view(), name='visit-acceptance-photo-list-create'),
    path('<int:pk>/', VisitAcceptancePhotoDetailView.as_view(), name='visit-acceptance-photo-detail'),
    path('<int:pk>/file/', VisitAcceptancePhotoFileView.as_view(), name='visit-acceptance-photo-file'),
]
