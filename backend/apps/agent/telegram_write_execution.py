from datetime import timedelta

from django.utils import timezone

from .models import AgentPendingAction
from .telegram_direct_actions import execute_telegram_action


def finalize_telegram_write(result, conversation=None):
    if not isinstance(result, dict):
        return result
    return result
