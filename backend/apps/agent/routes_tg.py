from django.urls import path

from .telegram_parts_webhook import TelegramPartsWebhookView


urlpatterns = [
    path('telegram/webhook/', TelegramPartsWebhookView.as_view()),
]
