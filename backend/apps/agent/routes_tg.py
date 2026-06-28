from django.urls import path

from .telegram_part_details_webhook import TelegramPartDetailsWebhookView


urlpatterns = [
    path('telegram/webhook/', TelegramPartDetailsWebhookView.as_view()),
]
