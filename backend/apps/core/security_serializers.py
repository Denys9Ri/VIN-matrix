"""Response serializers that fail closed for employee-level sensitive data.

The base serializers remain the canonical write/validation layer. These wrappers
only remove fields from API responses when a mechanic was not granted the
corresponding financial permission by the company owner.
"""

from .access_control import can_view_financial_data
from .serializers import (
    OrderPartSerializer,
    OrderServiceSerializer,
    ServiceComplexSerializer,
    VisitSerializer,
)


SENSITIVE_PART_FIELDS = {
    'buy_price',
}

SENSITIVE_SERVICE_FIELDS = {
    'commission_percent',
    'commission_amount',
    'commission_base',
    'commission_label',
}

SENSITIVE_VISIT_FIELDS = {
    'finance',
    'payments',
    'paid_amount',
    'debt_amount',
    'prepayment_amount',
}


def _request_can_view_finances(serializer):
    request = serializer.context.get('request') if getattr(serializer, 'context', None) else None
    # Internal serializer use without an HTTP request keeps the historical full
    # payload. Every DRF API response has request context and therefore uses the
    # permission-aware branch below.
    if request is None:
        return True
    return can_view_financial_data(request.user)


def _redact_part(data):
    if not isinstance(data, dict):
        return data
    for field in SENSITIVE_PART_FIELDS:
        data.pop(field, None)
    return data


def _redact_service(data):
    if not isinstance(data, dict):
        return data
    for field in SENSITIVE_SERVICE_FIELDS:
        data.pop(field, None)
    return data


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
        if _request_can_view_finances(self):
            return data

        for field in SENSITIVE_VISIT_FIELDS:
            data.pop(field, None)
        for part in data.get('parts') or []:
            _redact_part(part)
        for service in data.get('services') or []:
            _redact_service(service)
        return data


class SecureServiceComplexSerializer(ServiceComplexSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not _request_can_view_finances(self):
            for part in data.get('parts') or []:
                _redact_part(part)
        return data
