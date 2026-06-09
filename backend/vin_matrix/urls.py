from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.views import (
    RegisterView,
    VisitViewSet,
    ServiceCatalogViewSet,
    OrderPartViewSet,
    OrderServiceViewSet,
    CategoryViewSet,
    InventoryItemViewSet,
    SupplierViewSet,
    MechanicViewSet,
    PlatformClientViewSet,
    ProfileSettingsView,
    LogoutView,
    ChangePasswordView,
    PartSearchView,
)

from apps.core.novapost_views import (
    NovaPostProfileListCreateView,
    NovaPostProfileDetailView,
    NovaPostProfileTestView,
    NovaPostCitiesView,
    NovaPostWarehousesView,
    NovaPostDeliveryView,
    NovaPostDeliveryStatusView,
    NovaPostDeliveryCreateView,
)

router = DefaultRouter()
router.register(r'visits', VisitViewSet, basename='visit')
router.register(r'services', ServiceCatalogViewSet, basename='service')
router.register(r'order-parts', OrderPartViewSet, basename='order-part')
router.register(r'order-services', OrderServiceViewSet, basename='order-service')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'inventory', InventoryItemViewSet, basename='inventory')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'mechanics', MechanicViewSet, basename='mechanic')
router.register(r'platform-clients', PlatformClientViewSet, basename='platform-client')

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),

    # Важливо: старий фронт ходить саме сюди
    path('api/settings/', ProfileSettingsView.as_view(), name='settings'),
    path('api/profile/settings/', ProfileSettingsView.as_view(), name='profile_settings'),
    path('api/profile/change-password/', ChangePasswordView.as_view(), name='change_password'),

    # Пошук запчастин
    path('api/parts/search/', PartSearchView.as_view(), name='parts-search'),
    path('api/part-search/', PartSearchView.as_view(), name='part-search'),

    # Тимчасово, щоб фронт не падав 404, поки dictionaries/notifications не відновлені окремими view
    path(
        'api/settings/dictionaries/',
        lambda request: JsonResponse({
            'store_order_status': [],
            'part_status': [],
            'visit_status': [],
            'payment_status': [],
        }),
        name='settings-dictionaries',
    ),
    path(
        'api/notifications/summary/',
        lambda request: JsonResponse({
            'unread': 0,
            'count': 0,
            'items': [],
        }),
        name='notifications-summary',
    ),

    path('api/', include(router.urls)),

    path('api/integrations/', include('apps.integrations.urls')),
    path('api/crm/', include('apps.crm.urls')),
    path('api/analytics/', include('apps.analytics.urls')),

    path(
        'api/delivery/novapost/profiles/',
        NovaPostProfileListCreateView.as_view(),
        name='novapost-profiles',
    ),
    path(
        'api/delivery/novapost/profiles/<int:pk>/',
        NovaPostProfileDetailView.as_view(),
        name='novapost-profile-detail',
    ),
    path(
        'api/delivery/novapost/profiles/<int:pk>/test/',
        NovaPostProfileTestView.as_view(),
        name='novapost-profile-test',
    ),
    path(
        'api/delivery/novapost/cities/',
        NovaPostCitiesView.as_view(),
        name='novapost-cities',
    ),
    path(
        'api/delivery/novapost/warehouses/',
        NovaPostWarehousesView.as_view(),
        name='novapost-warehouses',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/$',
        NovaPostDeliveryView.as_view(),
        name='novapost-delivery',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/status/$',
        NovaPostDeliveryStatusView.as_view(),
        name='novapost-delivery-status',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create-ttn/$',
        NovaPostDeliveryCreateView.as_view(),
        name='novapost-delivery-create-ttn',
    ),
    re_path(
        r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create/$',
        NovaPostDeliveryCreateView.as_view(),
        name='novapost-delivery-create-fallback',
    ),

    path('', lambda request: JsonResponse({'message': 'VIN Matrix API'})),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
