from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'

    def ready(self):
        try:
            from django.urls import path
            from importlib import import_module
            from .billing_client_link_views import BillingAdminClientLinkView

            urlconf = import_module('vin_matrix.urls')
            route =