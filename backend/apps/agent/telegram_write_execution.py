from .direct_actions import execute_or_queue_action
from .models import AgentPendingAction


DIRECT_ACTION_MESSAGES = {
    'add_order_part': '✅ Запчастину додано до запису.',
    'create_visit': '✅ Запис створено.',
    'reschedule_visit': '✅ Запис перенесено.',
    'cancel_visit': '✅ Запис скасовано.',
    'update_visit_status': '✅ Статус запису оновлено.',
    'assign_visit': '✅ Пост або майстра для запису оновлено.',
}


def finalize_telegram_write(result):
    """Turns a just-created Telegram write draft into an immediate execution.

    This is intentionally called only by the production Telegram webhook path.
    The normal pending-action UI remains available when the company enables
    control mode for future AI-assisted operations.
    """
    if not isinstance(result, dict):
        return result
    pending_action_id = result.get('pending_action_id')
    if not pending_action_id:
        return result

    try:
        action = AgentPendingAction.objects.select_related('user').get(id=int(pending_action_id))
    except (AgentPendingAction.DoesNotExist, TypeError, ValueError):
        return result

    try:
        outcome = execute_or_queue_action(action.user, action)
    except Exception as exc:
        detail = str(getattr(exc, 'detail', exc)).strip() or 'Не вдалося виконати дію.'
        failed = dict(result)
        failed['text'] = f'⚠️ {detail}'
        failed['direct_execution_failed'] = True
        return failed

    if outcome['requires_confirmation']:
        return result

    completed = dict(result)
    completed['text'] = DIRECT_ACTION_MESSAGES.get(
        action.action_type,
        '✅ Дію виконано.',
    )
    completed['executed_action_id'] = action.id
    completed['execution'] = outcome['execution'].get('result')
    completed.pop('pending_action_id', None)
    return completed
