from django.urls import re_path
from . import novapost_views as v

urlpatterns = [
    re_path(r'^profiles/$', v.NovaPostProfileListCreateView.as_view()),
    re_path(r'^profiles/(?P<pk>[0-9]+)/$', v.NovaPostProfileDetailView.as_view()),
    re_path(r'^profiles/(?P<pk>[0-9]+)/test/$', v.NovaPostProfileTestView.as_view()),
    re_path(r'^cities/$', v.NovaPostCitiesView.as_view()),
    re_path(r'^warehouses/$',