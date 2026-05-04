from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Наші API маршрути:
    path('api/integrations/', include('apps.integrations.urls')),
    path('api/crm/', include('apps.crm.urls')),
    path('api/analytics/', include('apps.analytics.urls')), # <--- Додана Аналітика
]
