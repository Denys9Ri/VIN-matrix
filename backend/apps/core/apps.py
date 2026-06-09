from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field='django.db.models.BigAutoField'
    name='apps.core'
    def ready(self):
        from django.urls import path
        import vin_matrix.urls as u
        from .novapost_views import NovaPostDeliveryCreateView as V
        n={getattr(x,'name',None) for x in u.urlpatterns}
        if 'novapost-delivery-create-ttn' not in n:
            u.urlpatterns.append