from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter
from apps.core.views import LogoutView, ChangePasswordView
from apps.core.safe_crm_views import VisitViewSet, ServiceCatalogViewSet,