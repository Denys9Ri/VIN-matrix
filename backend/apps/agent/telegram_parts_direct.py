from . import telegram_parts_webhook as parts_webhook
from .models import AgentPendingAction
from .telegram_direct_actions import execute_telegram_action
from .telegram_part_details_webhook import TelegramPartDetailsWebhookView


_ORIGINAL_PART_CALLBACK = parts_webhook.handle_part_callback
_ORIGINAL_PART_TEXT = parts_webhook.handle_part_text


SUCCESS_MESSAGES = {
    'add_order_part': '✅ Запчастину додано до запису.',
}


def _run_write(channel, response):
    reply, intent, result = response
    if not isinstance(result, dict):
        return response

    action_id = result.get('pending_action_id')
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
        return f'⚠️ Не вдалося виконати дію: {error}', 'telegram_write_failed', {}

    completed = dict(result)
    completed.pop('pending_action_id', None)
    completed['executed_action_id'] = action.id
    return (
        SUCCESS_MESSAGES.get(action.action_type, '✅ Дію виконано.'),
        'telegram_write_executed',
        completed,
    )


def _direct_part_callback(channel, conversation, callback_data):
    return _run_write(channel, _ORIGINAL_PART_CALLBACK(channel, conversation, callback_data))


def _direct_part_text(channel, conversation, text):
    return _run_write(channel, _ORIGINAL_PART_TEXT(channel, conversation, text))


# The existing parts router resolves these callables from its module globals.
# Replace only write-producing responses before the router strips action metadata.
parts_webhook.handle_part_callback = _direct_part_callback
parts_webhook.handle_part_text = _direct_part_text


class TelegramPartsDirectWebhookView(TelegramPartDetailsWebhookView):
    pass
