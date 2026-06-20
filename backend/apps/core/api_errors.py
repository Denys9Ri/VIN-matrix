import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .request_context import get_request_id

logger = logging.getLogger('vin_matrix.api')


def _first_message(value):
    if isinstance(value, dict):
        for item in value.values():
            message = _first_message(item)
            if message:
                return message
        return ''
    if isinstance(value, (list, tuple)):
        for item in value:
            message = _first_message(item)
            if message:
                return message
        return ''
    return str(value or '').strip()


def _status_code_name(status_code):
    return {
        status.HTTP_400_BAD_REQUEST: 'validation_error',
        status.HTTP_401_UNAUTHORIZED: 'authentication_required',
        status.HTTP_403_FORBIDDEN: 'permission_denied',
        status.HTTP_404_NOT_FOUND: 'not_found',
        status.HTTP_405_METHOD_NOT_ALLOWED: 'method_not_allowed',
        status.HTTP_409_CONFLICT: 'conflict',
        status.HTTP_429_TOO_MANY_REQUESTS: 'rate_limited',
    }.get(status_code, 'api_error')


def vin_matrix_exception_handler(exc, context):
    """Keep client errors readable while preserving structured validation details."""

    response = drf_exception_handler(exc, context)
    request = context.get('request')
    request_id = getattr(request, 'request_id', get_request_id())

    if response is None:
        logger.exception(
            'drf_unhandled_exception',
            extra={
                'request_id': request_id,
                'path': getattr(request, 'path', None),
                'method': getattr(request, 'method', None),
            },
        )
        return Response(
            {
                'error': 'Внутрішня помилка сервісу. Спробуйте ще раз або зверніться в підтримку.',
                'code': 'internal_error',
                'request_id': request_id,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    original = response.data
    message = _first_message(original) or 'Не вдалося виконати запит.'
    code = _status_code_name(response.status_code)

    if isinstance(original, dict) and original.get('code'):
        code = str(original['code'])
    if isinstance(original, dict) and original.get('error'):
        message = str(original['error'])

    response.data = {
        'error': message,
        'code': code,
        'request_id': request_id,
        'details': original,
    }
    response['X-Request-ID'] = request_id
    return response
