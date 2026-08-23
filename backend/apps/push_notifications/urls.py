from django.urls import path

from .views import (
    WebPushPreferencesView,
    WebPushStatusView,
    WebPushSubscribeView,
    WebPushTestView,
    WebPushUnsubscribeView,
)


urlpatterns = [
    path('status/', WebPushStatusView.as_view(), name='push-status'),
    path('preferences/', WebPushPreferencesView.as_view(), name='push-preferences'),
    path('subscribe/', WebPushSubscribeView.as_view(), name='push-subscribe'),
    path('unsubscribe/', WebPushUnsubscribeView.as_view(), name='push-unsubscribe'),
    path('test/', WebPushTestView.as_view(), name='push-test'),
]
