from django.urls import path

from .telegram_parts_direct import TelegramPartsDirectWebhookView


urlpatterns = [
    path('telegram/webhook/', TelegramPartsDirectWebhookView.as_view()),
]
