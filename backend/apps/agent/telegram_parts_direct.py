from . import telegram_parts_webhook as router
from .models import AgentPendingAction
from .telegram_direct_actions import execute_telegram_action
from .telegram_part_details_webhook import TelegramPartDetailsWebhookView


callback_handler = router.handle_part_callback
text_handler = router.handle_part_text


def apply_action(channel, response):
    text, intent, data = response
    if not isinstance(data, dict):
        return response
    action_id = data.get('pending_action_id')
    if not action_id:
        return response
    try:
        action = AgentPendingAction.objects.select_related('user').get(
            id=int(action_id),
            company=channel.company,
            user=channel.user,
        )
        execute_telegram_action(channel.user, action)
    except Exception as error:
        return f'⚠️ Не вдалося додати запчастину: {error}', 'part_error', {}
    data = dict(data)
    data.pop('pending_action_id', None)
    data['executed_action_id'] = action.id
    return '✅ Запчастину додано до запису.', 'part_added', data


def handle_callback(channel, conversation, callback_data):
    return apply_action(channel, callback_handler(channel, conversation, callback_data))


def handle_text(channel, conversation, text):
    return apply_action(channel, text_handler(channel, conversation, text))


router.handle_part_callback = handle_callback
router.handle_part_text = handle_text


class TelegramPartsDirectWebhookView(TelegramPartDetailsWebhookView):
    pass
