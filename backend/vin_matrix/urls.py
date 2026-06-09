from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include,path,re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt import views as jwt_views
from apps.core.views import RegisterView,VisitViewSet,ServiceCatalogViewSet,ProfileSettingsView,LogoutView,ChangePasswordView
from apps.core.novapost