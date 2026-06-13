from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import StoExpense
from .safe_crm_views import safe_ensure_company


class StoExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    payment_method_label = serializers.SerializerMethodField()
    recurring_period_label = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StoExpense
        fields = [
            'id',
            'date',
            'category',
            'category_label',
            'title',
            'amount',
            'payment_method',
            'payment_method_label',
            'comment',
            'is_recurring',
            'recurring_period',
            'recurring_period_label',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'category_label',
            'payment_method_label',
            'recurring_period_label',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]

    def get_category_label(self, obj):
        return obj.get_category_display()

    def get_payment_method_label(self, obj):
        return obj.get_payment_method_display()

    def get_recurring_period_label(self, obj):
        return obj.get_recurring_period_display()

    def get_created_by_name(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return ''
        return user.first_name or user.username


class StoExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = StoExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        company = safe_ensure_company(self.request.user)
        if not company:
            return StoExpense.objects.none()

        queryset = StoExpense.objects.filter(company=company).select_related('created_by').order_by('-date', '-id')

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        category = self.request.query_params.get('category')

        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if category:
            queryset = queryset.filter(category=category)

        return queryset

    def perform_create(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise serializers.ValidationError({'company': 'Компанію не знайдено.'})
        serializer.save(company=company, created_by=self.request.user)

    def perform_update(self, serializer):
        company = safe_ensure_company(self.request.user)
        if not company:
            raise serializers.ValidationError({'company': 'Компанію не знайдено.'})
        serializer.save(company=company)

    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        return Response({
            'categories': [
                {'key': key, 'label': label}
                for key, label in StoExpense.CATEGORY_CHOICES
            ],
            'payment_methods': [
                {'key': key, 'label': label}
                for key, label in StoExpense.PAYMENT_METHOD_CHOICES
            ],
            'recurring_periods': [
                {'key': key, 'label': label}
                for key, label in StoExpense.RECURRING_CHOICES
            ],
        })
