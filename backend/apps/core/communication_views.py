from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import CRMCommunication, CRMClientStatus, Visit
from .safe_crm_views import safe_ensure_company


class CRMCommunicationSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = CRMCommunication
        fields = [
            'id', 'visit', 'client', 'phone', 'plate', 'status', 'status_label',
            'comment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status_label', 'created_at', 'updated_at']

    def get_status_label(self, obj):
        return dict(CRMCommunication.STATUS_CHOICES).get(obj.status, 'Контакт')


class CRMCommunicationViewSet(viewsets.ModelViewSet):
    serializer_class = CRMCommunicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = CRMCommunication.objects.filter(company=company) if company else CRMCommunication.objects.none()

        search = self.request.query_params.get('search', '').strip()
        visit_id = self.request.query_params.get('visit', '').strip()
        plate = self.request.query_params.get('plate', '').strip()
        phone = self.request.query_params.get('phone', '').strip()
        client = self.request.query_params.get('client', '').strip()

        if search:
            queryset = queryset.filter(
                Q(client__icontains=search) | Q(phone__icontains=search) |
                Q(plate__icontains=search) | Q(comment__icontains=search)
            )
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        if plate:
            queryset = queryset.filter(plate__iexact=plate)
        if phone:
            queryset = queryset.filter(phone__iexact=phone)
        if client:
            queryset = queryset.filter(client__iexact=client)

        return queryset.order_by('-created_at', '-id')

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення комунікації.')

        visit = None
        visit_id = self.request.data.get('visit')
        if visit_id:
            try:
                visit = Visit.objects.get(id=visit_id, company=company)
            except Visit.DoesNotExist:
                visit = None

        defaults = {}
        if visit:
            defaults = {
                'client': self.request.data.get('client') or visit.client,
                'phone': self.request.data.get('phone') or visit.phone,
                'plate': self.request.data.get('plate') or visit.plate,
            }

        serializer.save(company=company, visit=visit, created_by=self.request.user, **defaults)


class CRMClientStatusSerializer(serializers.ModelSerializer):
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = CRMClientStatus
        fields = [
            'id', 'client', 'phone', 'plate', 'status', 'status_label',
            'note', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status_label', 'created_at', 'updated_at']

    def get_status_label(self, obj):
        return dict(CRMClientStatus.STATUS_CHOICES).get(obj.status, 'Новий')


class CRMClientStatusViewSet(viewsets.ModelViewSet):
    serializer_class = CRMClientStatusSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        queryset = CRMClientStatus.objects.filter(company=company) if company else CRMClientStatus.objects.none()

        search = self.request.query_params.get('search', '').strip()
        plate = self.request.query_params.get('plate', '').strip()
        phone = self.request.query_params.get('phone', '').strip()
        client = self.request.query_params.get('client', '').strip()

        if search:
            queryset = queryset.filter(
                Q(client__icontains=search) | Q(phone__icontains=search) |
                Q(plate__icontains=search) | Q(note__icontains=search)
            )
        if plate:
            queryset = queryset.filter(plate__iexact=plate)
        if phone:
            queryset = queryset.filter(phone__iexact=phone)
        if client:
            queryset = queryset.filter(client__iexact=client)

        return queryset.order_by('-updated_at', '-id')

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise ValueError('Немає CRM-компанії для створення статусу клієнта.')
        serializer.save(company=company, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
