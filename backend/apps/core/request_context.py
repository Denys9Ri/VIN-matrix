import logging
import os
import time
import uuid
from contextvars import ContextVar

from django.http import JsonResponse


_request_id = ContextVar('vin_matrix_request_id', default='-')
logger = logging.getLogger('vin_matrix.api')

# Deployment can set TRUSTED_BROWSER_ORIGINS as a comma-separated list. The
# current Coolify frontend is included only as a temporary compatibility default
# while the frontend moves to the same-origin API proxy.
_DEFAULT_TRUSTED_BROWSER_ORIGINS = {
    'http://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
    'https://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
}
_CORS_PATH_PREFIXES = ('/api/', '/token/', '/schema/', '/docs/')


def get_request_id():
    return _request_id.get()


def trusted_browser_origins():
    configured = {
        item.strip().rstrip('/')
        for item in str(os.getenv('TRUSTED_BROWSER_ORIGINS', '')).split(',')
        if item.strip()
    }
    return configured or _DEFAULT_TRUSTED_BROWSER_ORIGINS


def apply_trusted_cors(request, response):
    """Add CORS only for explicit trusted browser origins, never reflect arbitrary Origin."""
    if not request.path.startswith(_CORS_PATH_PREFIXES):
        return response
    origin = str(request.headers.get('Origin', '')).strip().rstrip('/')
    if origin not in trusted_browser_origins():
        return response

    response['Access-Control-Allow-Origin'] = origin
    response['Access-Control-Allow-Credentials'] = 'true'
    response['Access-Control-Allow-Methods'] = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
    response['Access-Control-Allow-Headers'] = 'accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with, x-request-id'
    response['Access-Control-Expose-Headers'] = 'X-Request-ID'
    response['Vary'] = 'Origin'
    return response


class RequestContextFilter(logging.Filter):
    """Inject safe request metadata into every configured VIN-matrix log record."""

    def filter(self, record):
        defaults = {
            'request_id': get_request_id(),
            'method': '-',
            'path': '-',
            'status_code': '-',
            'duration_ms': '-',
            'user_id': '-',
        }
        for field, value in defaults.items():
            if not hasattr(record, field):
                setattr(record, field, value)
        return True


class RequestIdMiddleware:
    """Attach an opaque request id to every response without trusting client input."""

    header_name = 'HTTP_X_REQUEST_ID'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = str(request.META.get(self.header_name, '')).strip()
        request_id = incoming[:64] if incoming and incoming.replace('-', '').isalnum() else uuid.uuid4().hex
        token = _request_id.set(request_id)
        request.request_id = request_id
        started = time.monotonic()

        try:
            response = self.get_response(request)
        finally:
            _request_id.reset(token)

        response['X-Request-ID'] = request_id
        response = apply_trusted_cors(request, response)
        duration_ms = int((time.monotonic() - started) * 1000)
        if request.path.startswith('/api/'):
            user = getattr(request, 'user', None)
            logger.info(
                'api_request_complete',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.path,
                    'status_code': getattr(response, 'status_code', 0),
                    'duration_ms': duration_ms,
                    'user_id': getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None,
                },
            )
        return response


class ApiExceptionMiddleware:
    """Return safe JSON for unexpected API failures and log the full server-side traceback."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception:
            if not request.path.startswith('/api/'):
                raise

            request_id = getattr(request, 'request_id', get_request_id())
            user = getattr(request, 'user', None)
            logger.exception(
                'api_unhandled_exception',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.path,
                    'status_code': 500,
                    'user_id': getattr(user, 'id', None) if getattr(user, 'is_authenticated', False) else None,
                },
            )
            response = JsonResponse(
                {
                    'error': 'Внутрішня помилка сервісу. Спробуйте ще раз або зверніться в підтримку.',
                    'code': 'internal_error',
                    'request_id': request_id,
                },
                status=500,
                json_dumps_params={'ensure_ascii': False},
            )
            response['X-Request-ID'] = request_id
            return apply_trusted_cors(request, response)
