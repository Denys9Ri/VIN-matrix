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
    if not isinstance(result, dict):
        return result
    action_id = result.get('pending_action_id')
    if not action_id:
        return result
    try:
        action = AgentPendingAction.objects.select_related('user').get(id=int(action_id))
    except (AgentPendingAction.DoesNotExist, TypeError, ValueError):
        return result
    try:
        outcome = execute_or_queue_action(action.user, action, immediate=True)
    except Exception as exc:
        failed = dict(result)
        failed['text'] = f"⚠️ {str(getattr(exc, 'detail', exc)).strip() or 'Не вдалося виконати дію.'}"
        failed['direct_execution_failed'] = True
        return failed
    completed = dict(result)
    completed['text'] = DIRECT_ACTION_MESSAGES.get(action.action_type, '✅ Дію виконано.')
    completed['executed_action_id'] = action.id
    completed['execution'] = outcome['execution'].get('result')
    completed.pop('pending_action_id', None)
    return completed
