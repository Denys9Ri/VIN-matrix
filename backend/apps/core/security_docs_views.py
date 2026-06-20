from django.conf import settings
from django.http import Http404, HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .partner_views import is_platform_admin


def docs_allowed(request):
    if settings.DEBUG:
        return True
    if not getattr(settings, 'ENABLE_API_DOCS', False):
        return False
    return bool(getattr(request, 'user', None) and is_platform_admin(request.user))


class SecureSchemaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not docs_allowed(request):
            raise Http404
        # Delayed import avoids URLconf initialization cycles.
        from vin_matrix.urls import openapi_schema
        return openapi_schema(request)


class SecureDocsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not docs_allowed(request):
            raise Http404
        return HttpResponse(
            """<!doctype html><html><head><title>VIN-matrix API docs</title>
            <link rel='stylesheet' href='https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'></head>
            <body><div id='swagger-ui'></div><script src='https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'></script>
            <script>
              const token = localStorage.getItem('access_token');
              SwaggerUIBundle({
                url:'/schema/', dom_id:'#swagger-ui',
                requestInterceptor: (request) => {
                  if (token) request.headers.Authorization = `Bearer ${token}`;
                  return request;
                }
              });
            </script></body></html>""",
            content_type='text/html',
        )
