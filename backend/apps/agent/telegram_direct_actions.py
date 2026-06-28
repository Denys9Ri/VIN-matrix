from django.db import transaction
from django.utils import timezone

from .actions import execute_confirmed_action
from .models import AgentPendingAction
from .services import require_agent_member


def execute_telegram_action(user, action):
    company, _, _ = require_agent_member(user)
    with transaction.atomic():
        pending = AgentPendingAction.objects.select_for_update().get(
            id=action.id,
            company=company,
            user=user,
        )
        if pending.status == AgentPendingAction.STATUS_EXECUTED:
            return {'action_id': pending.id, 'status': pending.status, 'result': 'already_executed'}
        if pending.status != AgentPendingAction.STATUS_PENDING:
            raise ValueError('Цю дію вже неможливо виконати.')
        if pending.expires_at <= timezone.now():
            pending.status = AgentPendingAction.STATUS_EXPIRED
            pending.save(update_fields=['status'])
            raise ValueError('Час виконання дії сплив.')
        pending.status = AgentPendingAction.STATUS_CONFIRMED
        pending.confirmed_at = timezone.now()
        pending.save(update_fields=['status', 'confirmed_at'])
    return execute_confirmed_action(user, action.id)
