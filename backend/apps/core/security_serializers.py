"""Permission-aware response serializers for sensitive business data.

The base serializers remain the canonical validation/write layer. These wrappers
remove internal costs, margin and payroll data unless the owner explicitly grants
finance access. Employees allowed to take payments can still see the customer-
facing totals they need to close a bill, without seeing internal profit data.
"""

from .access_control import can_take_payment_data, can_view_financial_data
from .serializers import (
    OrderPartSerializer,
    OrderServiceSerializer,
    ServiceComplexSerializer,
    VisitSerializer,
)


SENSITIVE_PART_FIELDS = {'buy_price'}

SENSITIVE_SERVICE_FIELDS = {
    'commission_percent',
    'commission_amount',
    'commission_base',
    'commission_label',
}

PAYMENT_VISIT_FIELDS = {
    'payments',
    'paid_amount',
    'debt_amount',
    'grand_total',
    'prepayment_amount',
    'payment_status',
}

INTERNAL_FINANCE_KEYS = {
    'profit',
    'profit_after_mechanics',
    'mechanic_commission_total',
    'margin',
}


def _request(serializer):
    return serializer.context.get('request') if getattr(serializer, 'context', None) else None


def _request_can_view_finances(serializer):
    request = _request(serializer)
    # Internal serializer use without HTTP request keeps historical full payload.
    if request is None:
        return True
    return can_view_financial_data(request.user)


def _request_can_take_payments(serializer):
    request = _request(serializer)
    if request is None:
        return True
    return can_take_payment_data(request.user)


def _redact_part(data):
    if isinstance(data, dict):
        for field in SENSITIVE_PART_FIELDS:
            data.pop(field, None)
    return data


def _redact_service(data):
    if isinstance(data, dict):
        for field in SENSITIVE_SERVICE_FIELDS:
            data.pop(field, None)
    return data


def _redact_internal_finance(finance):
    if not isinstance(finance, dict):
        return finance
    for field in INTERNAL_FINANCE_KEYS:
        finance.pop(field, None)
    return finance


class SecureOrderPartSerializer(OrderPartSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _request_can_view_finances(self):
            _redact_part(data)
        return data


class SecureOrderServiceSerializer(OrderServiceSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _request_can_view_finances(self):
            _redact_service(data)
        return data


class SecureVisitSerializer(VisitSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        can_finance = _request_can_view_finances(self)
        can_payments = _request_can_take_payments(self)

        if not can_finance:
            for part in data.get('parts') or []:
                _redact_part(part)
            for service in data.get('services') or []:
                _redact_service(service)

            if can_payments:
                # Payment operators need the amount the customer owes, not the
                # company's internal margin, costs or payroll calculation.
                _redact_internal_finance(data.get('finance'))
            else:
                data.pop('finance', None)
                for field in PAYMENT_VISIT_FIELDS:
                    data.pop(field, None)

        return data


class SecureServiceComplexSerializer(ServiceComplexSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _request_can_view_finances(self):
            for part in data.get('parts') or []:
                _redact_part(part)
        return data
