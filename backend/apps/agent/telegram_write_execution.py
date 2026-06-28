from datetime import timedelta

from django.utils import timezone

from .models import AgentPendingAction
from .telegram_direct_actions import execute_telegram_action


MESSAGES = {
    'add_order_part': '✅ Запчастину додано до запису.',
    'create_visit': '✅ Запис створено.',
    'reschedule_visit': '✅ Запис перенесено.',
    'cancel_visit': '✅ Запис скасовано.',
    'update_visit_status': '✅ Статус запису оновлено.',
    'assign_visit': '✅ Пост або майстра для запису оновлено.',
}


def finalize_telegram_write(result, conversation=None):
    if not isinstance(result, dict):
        return result

    action = None
    action_id = result.get('pending_action_id')
    if action_id:
        action = AgentPendingAction.objects.filter(id=action_id).select_related('user').first()
    elif conversation and 'чернетк' in str(result.get('text') or '').lower():
        action = (
            AgentPendingAction.objects.filter(
                conversation=conversation,
                status=AgentPendingAction.STATUS_PENDING,
                created_at__gte=timezone.now() - timedelta(minutes=2),
            )
            .select_related('user')
            .order_by('-id')
            .first()
        )

    if not action:
        return result

    try:
        execution = execute_telegram_action(action.user, action)
    except Exception as error:
        result = dict(result)
        result['text'] = f'⚠️ {error}'
        return result

    result = dict(result)
    result['text'] = MESSAGES.get(action.action_type, '✅ Дію виконано.')
    result['execution'] = execution.get('result')
    result.pop('pending_action_id', None)
    return result
