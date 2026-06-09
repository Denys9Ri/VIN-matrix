from django.urls import re_path
from apps.core.novapost_views import NovaPostDeliveryCreateView as V
urlpatterns=[
re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create-ttn/$',V.as_view()),
re_path(r'^api/delivery/novapost/visits/(?P<visit_id>\d+)/create/$',V.as_view())]
