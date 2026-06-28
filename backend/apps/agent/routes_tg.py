from django.urls import path
from .telegram_views import TelegramWebhookView

urlpatterns = [
    path('telegram/webhook/', TelegramWebhookView.as_view()),
]
