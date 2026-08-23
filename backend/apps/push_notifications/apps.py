from django.apps import AppConfig


class PushNotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.push_notifications'
    verbose_name = 'Push notifications'

    def ready(self):
        # Register model listeners only after Django has loaded every installed app.
        from . import signals  # noqa: F401
