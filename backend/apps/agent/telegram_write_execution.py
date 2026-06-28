from .direct_actions import execute_or_queue_action
from .models import AgentPendingAction

DIRECT_ACTION_MESSAGES = {}

def finalize_telegram_write(result):
    return result
