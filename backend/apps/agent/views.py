from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .actions import execute_confirmed_action
from .models import AgentMemberAccess, AgentPendingAction, AgentUserChannel
from .services import (
    ACCESS_FIELDS,
    create_connection_code,
    get_company_or_raise,
    get_company_settings,
    get_member_access,
    is_company_owner,
    require_agent_member,
    require_company_owner,
    write_audit,
)


class AgentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_company_or_raise(request.user)
        config = get_company_settings(company)
        access = get_member_access(company, request.user)
        channels = AgentUserChannel.objects.filter(
            company=company,
            user=request.user,
            is_active=True,
        ).order_by('channel_type')

        return Response({
            'company_id': company.id,
            'agent_enabled': config.is_enabled,
            'member_enabled': access.is_enabled,
            'capabilities': {
                'telegram': config.telegram_enabled,
                'viber': config.viber_enabled,
                'voice': config.allow_voice,
                'images': config.allow_images,
                'write_confirmation_required': config.require_confirmation_for_writes,
            },
            'access': {field: getattr(access, field) for field in ACCESS_FIELDS},
            'channels': [
                {
                    'channel_type': channel.channel_type,
                    'display_name': channel.display_name,
                    'linked_at': channel.linked_at,
                    'last_seen_at': channel.last_seen_at,
                }
                for channel in channels
            ],
        })


class AgentSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_company_or_raise(request.user)
        require_company_owner(request.user, company)
        config = get_company_settings(company)

        return Response({
            'is_enabled': config.is_enabled,
            'telegram_enabled': config.telegram_enabled,
            'viber_enabled': config.viber_enabled,
            'allow_voice': config.allow_voice,
            'allow_images': config.allow_images,
            'require_confirmation_for_writes': config.require_confirmation_for_writes,
            'monthly_action_limit': config.monthly_action_limit,
        })

    def patch(self, request):
        company = get_company_or_raise(request.user)
        require_company_owner(request.user, company)
        config = get_company_settings(company)

        allowed_fields = {
            'is_enabled',
            'telegram_enabled',
            'viber_enabled',
            'allow_voice',
            'allow_images',
            'require_confirmation_for_writes',
            'monthly_action_limit',
        }
        changed = []
        for field in allowed_fields:
            if field in request.data:
                setattr(config, field, request.data[field])
                changed.append(field)

        if changed:
            config.save(update_fields=changed + ['updated_at'])
            write_audit(
                company=company,
                user=request.user,
                recognized_intent='agent_settings_updated',
                tool_name='update_agent_settings',
                tool_input={field: request.data[field] for field in changed},
            )

        return Response({
            'detail': 'Налаштування VIN-matrix Agent оновлено.',
        })


class AgentMemberAccessListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = get_company_or_raise(request.user)
        require_company_owner(request.user, company)

        users = [company.owner]
        users.extend(
            employee.user
            for employee in company.employees.select_related('user').order_by('user__username')
            if employee.user_id != company.owner_id
        )

        return Response([
            {
                'user_id': user.id,
                'username': user.username,
                'name': user.get_full_name() or user.username,
                'is_owner': is_company_owner(user, company),
                'is_enabled': get_member_access(company, user).is_enabled,
                'access': {
                    field: getattr(get_member_access(company, user), field)
                    for field in ACCESS_FIELDS
                },
            }
            for user in users
        ])

    def patch(self, request):
        company = get_company_or_raise(request.user)
        require_company_owner(request.user, company)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'detail': 'Потрібно передати user_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        allowed_user_ids = {company.owner_id}
        allowed_user_ids.update(company.employees.values_list('user_id', flat=True))
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Некоректний user_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_id not in allowed_user_ids:
            return Response(
                {'detail': 'Цей користувач не належить до вашої компанії.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_user = User.objects.get(id=user_id)
        access = get_member_access(company, target_user)

        if is_company_owner(target_user, company):
            return Response(
                {'detail': 'Права власника змінювати не можна.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        changed = []
        if 'is_enabled' in request.data:
            access.is_enabled = bool(request.data['is_enabled'])
            changed.append('is_enabled')
        for field in ACCESS_FIELDS:
            if field in request.data:
                setattr(access, field, bool(request.data[field]))
                changed.append(field)

        if changed:
            access.save(update_fields=changed + ['updated_at'])
            write_audit(
                company=company,
                user=request.user,
                recognized_intent='agent_member_access_updated',
                tool_name='update_agent_member_access',
                tool_input={'target_user_id': target_user.id, **{field: request.data[field] for field in changed}},
            )

        return Response({'detail': 'Права працівника оновлено.'})


class AgentConnectionCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        channel_type = str(request.data.get('channel_type') or '').strip().lower()
        connection = create_connection_code(request.user, channel_type)
        return Response({
            'channel_type': connection.channel_type,
            'code': connection.code,
            'expires_at': connection.expires_at,
            'expires_in_minutes': 15,
        }, status=status.HTTP_201_CREATED)


class AgentPendingActionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company, _, _ = require_agent_member(request.user)
        AgentPendingAction.objects.filter(
            company=company,
            user=request.user,
            status=AgentPendingAction.STATUS_PENDING,
            expires_at__lte=timezone.now(),
        ).update(status=AgentPendingAction.STATUS_EXPIRED)

        actions = AgentPendingAction.objects.filter(
            company=company,
            user=request.user,
            status=AgentPendingAction.STATUS_PENDING,
        ).order_by('-created_at')[:50]
        return Response([
            {
                'id': action.id,
                'action_type': action.action_type,
                'summary_text': action.summary_text,
                'payload': action.payload,
                'expires_at': action.expires_at,
            }
            for action in actions
        ])


class AgentPendingActionDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def _mark_failed(self, action, error):
        action.refresh_from_db()
        if action.status != AgentPendingAction.STATUS_CONFIRMED:
            return action
        action.status = AgentPendingAction.STATUS_FAILED
        action.error_message = str(getattr(error, 'detail', error))[:2000]
        action.save(update_fields=['status', 'error_message'])
        return action

    def post(self, request, action_id):
        decision = str(request.data.get('decision') or '').strip().lower()
        if decision not in {'confirm', 'cancel'}:
            return Response(
                {'detail': 'decision має бути confirm або cancel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company, _, _ = require_agent_member(request.user)
        try:
            action = AgentPendingAction.objects.get(
                id=action_id,
                company=company,
                user=request.user,
            )
        except AgentPendingAction.DoesNotExist:
            return Response(
                {'detail': 'Чернетку не знайдено.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action.status != AgentPendingAction.STATUS_PENDING:
            return Response(
                {'detail': 'Ця чернетка вже неактивна.'},
                status=status.HTTP_409_CONFLICT,
            )
        if action.expires_at <= timezone.now():
            action.status = AgentPendingAction.STATUS_EXPIRED
            action.save(update_fields=['status'])
            return Response(
                {'detail': 'Час підтвердження сплив.'},
                status=status.HTTP_410_GONE,
            )

        if decision == 'cancel':
            action.status = AgentPendingAction.STATUS_CANCELLED
            action.save(update_fields=['status'])
            write_audit(
                company=company,
                user=request.user,
                conversation=action.conversation,
                recognized_intent='pending_action_cancelled',
                tool_name=action.action_type,
                tool_result={'pending_action_id': action.id},
            )
            return Response({'status': action.status, 'detail': 'Дію скасовано.'})

        action.status = AgentPendingAction.STATUS_CONFIRMED
        action.confirmed_at = timezone.now()
        action.save(update_fields=['status', 'confirmed_at'])
        write_audit(
            company=company,
            user=request.user,
            conversation=action.conversation,
            recognized_intent='pending_action_confirmed',
            tool_name=action.action_type,
            tool_result={'pending_action_id': action.id},
        )

        try:
            execution = execute_confirmed_action(request.user, action.id)
        except PermissionDenied as error:
            failed_action = self._mark_failed(action, error)
            write_audit(
                company=company,
                user=request.user,
                conversation=action.conversation,
                recognized_intent='pending_action_failed',
                tool_name=action.action_type,
                success=False,
                error_message=failed_action.error_message,
                tool_result={'pending_action_id': action.id},
            )
            return Response(
                {'status': failed_action.status, 'detail': failed_action.error_message},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as error:
            failed_action = self._mark_failed(action, error)
            write_audit(
                company=company,
                user=request.user,
                conversation=action.conversation,
                recognized_intent='pending_action_failed',
                tool_name=action.action_type,
                success=False,
                error_message=failed_action.error_message,
                tool_result={'pending_action_id': action.id},
            )
            return Response(
                {'status': failed_action.status, 'detail': failed_action.error_message or 'Не вдалося виконати дію.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'status': execution['status'],
            'detail': 'Дію підтверджено і виконано.',
            'result': execution['result'],
        })
