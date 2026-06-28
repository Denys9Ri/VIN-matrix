from django.db import transaction
from django.utils import timezone

from .actions import execute_confirmed_action
from .models import AgentPendingAction
from .services import require_agent_member


def execute_telegram_action(user, action):
    """Runs a prepared Telegram action immediately, bypassing AI control mode."""
    company, _, _ = require_agent_member(user)

    with transaction.atomic():
        locked = AgentPendingAction.objects.select_for_update().get(
            id=action.id,
            company=company,
            user=user,
        )
        if locked.status == AgentPendingAction.STATUS_EXECUTED:
            return {
                'action_id': locked.id,
                'status': locked.status,
                'result': 'already_executed',
            }
        if locked.status != AgentPendingAction.STATUS_PENDING:
            raise ValueError('Цю дію вже неможливо виконати.')
        if locked.expires_at <= timezone.now():
            locked.status = AgentPendingAction.STATUS_EXPIRED
            locked.save(update_fields=['status'])
            raise ValueError('Час виконання дії сплив.')
        locked.status = AgentPendingAction.STATUS_CONFIRMED
        locked.confirmed_at = timezone.now()
        locked.save(update_fields=['status', 'confirmed_at'])

    return execute_confirmed_action(user, action.id)
