import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.safe_crm_views import safe_ensure_company
from .models import AgentAuditLog, AgentCompanySettings, AgentConnectionCode, AgentPendingAction


CONNECTION_CODE_TTL_MINUTES = 15
PENDING_ACTION_TTL_MINUTES = 10


def company_for_user(user):
    company = safe_ensure_company(user)
    if not company:
        raise PermissionDenied('Для цього користувача не знайдено компанію VIN-matrix.')
    return company


def company_settings(company):
    settings, _ = AgentCompanySettings.objects.get_or_create(company=company)
    return settings


def ensure_agent_enabled(user):
    company = company_for_user(user)
    settings = company_settings(company)
    if not settings.is_enabled:
        raise PermissionDenied('VIN-matrix Agent вимкнений для вашої компанії.')
    return company, settings


def create_connection_code(*, user, channel_type):
    company, settings = ensure_agent_enabled(user)
    if channel_type == 'telegram' and not settings.telegram_enabled:
        raise ValidationError('Telegram Agent вимкнений для вашої компанії.')
    if channel_type == 'viber' and not settings.viber_enabled:
        raise ValidationError('Viber Agent вимкнений для вашої компанії.')
    if channel_type not in {'telegram', 'viber'}:
        raise ValidationError('Непідтримуваний канал.')

    AgentConnectionCode.objects.filter(
        user=user,
        channel_type=channel_type,
        used_at__isnull=True,
    ).delete()

    code = secrets.token_urlsafe(9).replace('-', '').replace('_', '')[:12].upper()
    link = AgentConnectionCode.objects.create(
        company=company,
        user=user,
        channel_type=channel_type,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=CONNECTION_CODE_TTL_MINUTES),
    )
    audit(user=user, company=company, intent='connection_code_created', tool_name='create_connection_code', tool_input={'channel_type': channel_type}, tool_result={'expires_at': link.expires_at.isoformat()})
    return link


def create_pending_action(*, user, action_type, payload, summary_text, conversation=None):
    company, settings = ensure_agent_enabled(user)
    if not settings.require_confirmation_for_writes:
        raise ValidationError('Чернетки не потрібні лише для явно дозволених серверних дій.')
    action = AgentPendingAction.objects.create(
        company=company,
        user=user,
        conversation=conversation,
        action_type=action_type,
        payload=payload,
        summary_text=summary_text,
        expires_at=timezone.now() + timedelta(minutes=PENDING_ACTION_TTL_MINUTES),
    )
    audit(user=user, company=company, conversation=conversation, intent='pending_action_created', tool_name=action_type, tool_input=payload, tool_result={'pending_action_id': action.id})
    return action


def audit(*, user, company, intent='', tool_name='', tool_input=None, tool_result=None, success=True, error_message='', conversation=None, request_text=''):
    return AgentAuditLog.objects.create(
        company=company,
        user=user,
        conversation=conversation,
        request_text=request_text,
        recognized_intent=intent,
        tool_name=tool_name,
        tool_input=tool_input or {},
        tool_result=tool_result or {},
        success=success,
        error_message=error_message,
    )
