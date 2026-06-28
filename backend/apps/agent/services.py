from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.safe_crm_views import safe_ensure_company

from .models import (
    AgentAuditLog,
    AgentCompanySettings,
    AgentConnectionCode,
    AgentMemberAccess,
    AgentPendingAction,
    AgentUserChannel,
)


CONNECTION_CODE_TTL_MINUTES = 15
PENDING_ACTION_TTL_MINUTES = 10


ACCESS_FIELDS = [
    'can_view_all_visits',
    'can_view_client_phone',
    'can_create_visits',
    'can_update_visits',
    'can_search_parts',
    'can_add_parts',
    'can_view_finances',
]


def get_company_or_raise(user):
    company = safe_ensure_company(user)
    if not company:
        raise PermissionDenied('Для користувача не знайдено компанію VIN-matrix.')
    return company


def is_company_owner(user, company):
    return company.owner_id == user.id


def get_company_settings(company):
    settings, _ = AgentCompanySettings.objects.get_or_create(company=company)
    return settings


def default_member_access(company, user):
    if is_company_owner(user, company):
        return {
            'is_enabled': True,
            'can_view_all_visits': True,
            'can_view_client_phone': True,
            'can_create_visits': True,
            'can_update_visits': True,
            'can_search_parts': True,
            'can_add_parts': True,
            'can_view_finances': True,
        }

    employee = getattr(user, 'employee_profile', None)
    if not employee or employee.company_id != company.id:
        return {
            'is_enabled': False,
            'can_view_all_visits': False,
            'can_view_client_phone': False,
            'can_create_visits': False,
            'can_update_visits': False,
            'can_search_parts': False,
            'can_add_parts': False,
            'can_view_finances': False,
        }

    elevated_role = str(employee.role or '').strip().lower() in {
        'admin', 'administrator', 'manager', 'owner', 'director'
    }
    return {
        'is_enabled': True,
        'can_view_all_visits': elevated_role,
        'can_view_client_phone': True,
        'can_create_visits': bool(employee.can_create_visits) or elevated_role,
        'can_update_visits': elevated_role,
        'can_search_parts': True,
        'can_add_parts': True,
        'can_view_finances': bool(employee.can_view_finances) or elevated_role,
    }


def get_member_access(company, user):
    access, _ = AgentMemberAccess.objects.get_or_create(
        company=company,
        user=user,
        defaults=default_member_access(company, user),
    )
    return access


def require_agent_member(user):
    company = get_company_or_raise(user)
    settings = get_company_settings(company)
    if not settings.is_enabled:
        raise PermissionDenied('VIN-matrix Agent вимкнений для цієї компанії.')

    access = get_member_access(company, user)
    if not access.is_enabled:
        raise PermissionDenied('Доступ до VIN-matrix Agent вимкнений для цього працівника.')
    return company, settings, access


def require_company_owner(user, company):
    if not is_company_owner(user, company):
        raise PermissionDenied('Лише власник компанії може змінювати налаштування AI Agent.')


def create_connection_code(user, channel_type):
    company, settings, _ = require_agent_member(user)
    channel_type = str(channel_type or '').strip().lower()

    if channel_type not in {AgentUserChannel.CHANNEL_TELEGRAM, AgentUserChannel.CHANNEL_VIBER}:
        raise ValidationError('Непідтримуваний канал.')
    if channel_type == AgentUserChannel.CHANNEL_TELEGRAM and not settings.telegram_enabled:
        raise ValidationError('Telegram Agent вимкнений у налаштуваннях компанії.')
    if channel_type == AgentUserChannel.CHANNEL_VIBER and not settings.viber_enabled:
        raise ValidationError('Viber Agent вимкнений у налаштуваннях компанії.')

    now = timezone.now()
    AgentConnectionCode.objects.filter(
        user=user,
        channel_type=channel_type,
        used_at__isnull=True,
        expires_at__gt=now,
    ).update(expires_at=now)

    code = get_random_string(
        length=10,
        allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    )
    connection = AgentConnectionCode.objects.create(
        company=company,
        user=user,
        channel_type=channel_type,
        code=code,
        expires_at=now + timedelta(minutes=CONNECTION_CODE_TTL_MINUTES),
    )
    write_audit(
        company=company,
        user=user,
        recognized_intent='connection_code_created',
        tool_name='create_connection_code',
        tool_input={'channel_type': channel_type},
        tool_result={'expires_at': connection.expires_at.isoformat()},
    )
    return connection


def link_channel_by_code(channel_type, code, external_user_id, chat_id, display_name=''):
    channel_type = str(channel_type or '').strip().lower()
    code = str(code or '').strip().upper()
    external_user_id = str(external_user_id or '').strip()
    chat_id = str(chat_id or '').strip()
    display_name = str(display_name or '').strip()[:160]

    if not code or not external_user_id or not chat_id:
        raise ValidationError('Недостатньо даних для прив’язки месенджера.')

    with transaction.atomic():
        try:
            connection = (
                AgentConnectionCode.objects
                .select_for_update()
                .select_related('company', 'user')
                .get(
                    channel_type=channel_type,
                    code=code,
                    used_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
            )
        except AgentConnectionCode.DoesNotExist:
            raise ValidationError('Код недійсний або час його дії сплив.')

        occupied = (
            AgentUserChannel.objects
            .select_for_update()
            .filter(channel_type=channel_type, external_user_id=external_user_id)
            .exclude(user=connection.user)
            .exists()
        )
        if occupied:
            raise ValidationError('Цей акаунт месенджера вже прив’язаний до іншого працівника.')

        channel, _ = AgentUserChannel.objects.update_or_create(
            user=connection.user,
            channel_type=channel_type,
            defaults={
                'company': connection.company,
                'external_user_id': external_user_id,
                'chat_id': chat_id,
                'display_name': display_name,
                'is_active': True,
                'last_seen_at': timezone.now(),
            },
        )
        connection.used_at = timezone.now()
        connection.save(update_fields=['used_at'])

    write_audit(
        company=connection.company,
        user=connection.user,
        recognized_intent='channel_linked',
        tool_name='link_channel_by_code',
        tool_input={'channel_type': channel_type},
        tool_result={'channel_id': channel.id},
    )
    return channel


def create_pending_action(user, action_type, payload, summary_text, conversation=None):
    company, _, _ = require_agent_member(user)
    action = AgentPendingAction.objects.create(
        company=company,
        user=user,
        conversation=conversation,
        action_type=str(action_type or '').strip()[:100],
        payload=payload or {},
        summary_text=str(summary_text or '').strip(),
        expires_at=timezone.now() + timedelta(minutes=PENDING_ACTION_TTL_MINUTES),
    )
    write_audit(
        company=company,
        user=user,
        conversation=conversation,
        recognized_intent='pending_action_created',
        tool_name=action.action_type,
        tool_input=action.payload,
        tool_result={'pending_action_id': action.id},
    )
    return action


def write_audit(
    company,
    user=None,
    conversation=None,
    request_text='',
    recognized_intent='',
    tool_name='',
    tool_input=None,
    tool_result=None,
    success=True,
    error_message='',
):
    return AgentAuditLog.objects.create(
        company=company,
        user=user,
        conversation=conversation,
        request_text=request_text,
        recognized_intent=recognized_intent,
        tool_name=tool_name,
        tool_input=tool_input or {},
        tool_result=tool_result or {},
        success=success,
        error_message=error_message,
    )
