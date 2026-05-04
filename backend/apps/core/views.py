from rest_framework import viewsets
from .models import Visit
from .serializers import VisitSerializer

class VisitViewSet(viewsets.ModelViewSet):
    serializer_class = VisitSerializer

    def get_queryset(self):
        # Віддаємо візити ТІЛЬКИ тієї компанії, якій належить користувач
        return Visit.objects.filter(company=self.request.user.company).order_by('-created_at')

    def perform_create(self, serializer):
        # При створенні авто, автоматично прив'язуємо його до СТО користувача
        serializer.save(company=self.request.user.company)
