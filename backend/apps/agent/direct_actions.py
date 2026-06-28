from django.db import transaction
from django.utils import timezone

from .actions import execute_confirmed_action
from .models import AgentPendingAction
from .services import require_agent_member, write_audit


class DirectAgentActionError(Exception):
    pass


def execute_or_queue_action(user, action, immediate=False):
    company, settings, _ = require_agent_member(user)
    if settings.require_confirmation_for_writes and not immediate:
        return {
            'requires_confirmation': True,
            'action': action,
            'execution': None,
        }

    with transaction.atomic():
        try:
            locked_action = AgentPendingAction.objects.select_for_update().get(
                id=action.id,
                company=company,
                user=user,
            )
        except AgentPendingAction.DoesNotExist as exc:
            raise DirectAgentActionError('Підготовлену дію Agent не знайдено.') from exc

        if locked_action.status == AgentPendingAction.STATUS_EXECUTED:
            return {
                'requires_confirmation': False,
                'action': locked_action,
                'execution': {
                    'action_id': locked_action.id,
                    'status': locked_action.status,
                    'result': 'already_executed',
                },
            }
        if locked_action.status != AgentPendingAction.STATUS_PENDING:
            raise DirectAgentActionError('Цю дію Agent уже неможливо виконати.')
        if locked_action.expires_at <= timezone.now():
            locked_action.status = AgentPendingAction.STATUS_EXPIRED
            locked_action.save(update_fields=['status'])
            raise DirectAgentActionError('Час виконання дії Agent сплив.')

        locked_action.status = AgentPendingAction.STATUS_CONFIRMED
        locked_action.confirmed_at = timezone.now()
        locked_action.save(update_fields=['status', 'confirmed_at'])

    try:
        execution = execute_confirmed_action(user, action.id)
    except Exception as exc:
        with transaction.atomic():
            failed_action = AgentPendingAction.objects.select_for_update().get(id=action.id, company=company)
            if failed_action.status == AgentPendingAction.STATUS_CONFIRMED:
                failed_action.status = AgentPendingAction.STATUS_FAILED
                failed_action.error_message = str(getattr(exc, 'detail', exc))[:2000]
                failed_action.save(update_fields=['status', 'error_message'])
        write_audit(
            company=company,
            user=user,
            conversation=action.conversation,
            recognized_intent='direct_action_failed',
            tool_name=action.action_type,
            tool_result={'pending_action_id': action.id},
            success=False,
            error_message=str(getattr(exc, 'detail', exc))[:2000],
        )
        raise

    return {
        'requires_confirmation': False,
        'action': action,
        'execution': execution,
    }
