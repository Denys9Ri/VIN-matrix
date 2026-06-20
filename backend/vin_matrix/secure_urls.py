from django.urls import include, path

from apps.core.security_auth_views import SecureTokenObtainPairView, SecureTokenRefreshView
from apps.core.security_docs_views import SecureDocsView, SecureSchemaView
from apps.core.security_registration_views import SecureRegisterView


# These paths are declared before the legacy URLconf. The legacy routes remain
# available for all application modules, while security-sensitive endpoints use
# hardened views without a risky broad URL rewrite.
urlpatterns = [
    path('token/', SecureTokenObtainPairView.as_view(), name='secure-token-obtain-pair'),
    path('token/refresh/', SecureTokenRefreshView.as_view(), name='secure-token-refresh'),
    path('api/register/', SecureRegisterView.as_view(), name='secure-register'),
    path('schema/', SecureSchemaView.as_view(), name='secure-schema'),
    path('docs/', SecureDocsView.as_view(), name='secure-docs'),
    path('', include('vin_matrix.urls')),
]
