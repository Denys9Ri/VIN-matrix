from rest_framework.response import Response

from .partner_views import (
    ADMIN_CODE,
    ProfileSettingsView as BaseProfileSettingsView,
    detect_role,
    ensure_partner_code,
    get_employee,
    get_platform_client,
    get_user_company,
    repair_legacy_account,
)
from .serializers import CompanySerializer, UserSerializer


class ProfileSettingsView(BaseProfileSettingsView):
    """
    Compatibility layer for old Settings.jsx.

    Old settings page expects role='owner' for every full CRM account so it can
    load mechanics and company settings. New access logic still needs the real
    hierarchy role, so we also return actual_role/account_role.
    """

    def get(self, request):
        repair_legacy_account(request.user)

        user = request.user
        company = get_user_company(user)
        employee = get_employee(user)
        client_profile = get_platform_client(user)
        actual_role = detect_role(user)
        settings_role = 'mechanic' if actual_role == 'mechanic' else 'owner'

        access_allowed = True
        access_message = ''
        if actual_role == 'client' and client_profile and not client_profile.is_access_enabled:
            access_allowed = False
            access_message = 'Немає доступу через відсутність оплати.'

        permissions = {
            'can_create_visits': actual_role in ['admin', 'partner', 'client'] or bool(employee and employee.can_create_visits),
            'can_view_finances': actual_role in ['admin', 'partner', 'client'] or bool(employee and employee.can_view_finances),
            'can_view_clients': actual_role in ['admin', 'partner', 'client'],
            'can_view_analytics': actual_role in ['admin', 'partner', 'client'],
            'can_manage_partners': actual_role == 'admin',
            'can_manage_accounts': actual_role in ['admin', 'partner'],
            'can_view_partner_clients': actual_role == 'partner',
            'can_manage_mechanics': actual_role in ['admin', 'partner', 'client'],
        }

        company_data = CompanySerializer(company, context={'request': request}).data if company else {
            'name': '',
            'logo': None,
            'phone': '',
            'address': '',
            'document_footer': '',
            'global_margin_percent': 20,
            'business_type': 'sto',
        }

        partner_code = ensure_partner_code(employee) if actual_role == 'partner' else None
        user_code = ADMIN_CODE if actual_role == 'admin' else (
            partner_code if actual_role == 'partner' else (
                f'C{client_profile.client_code}' if client_profile else None
            )
        )

        return Response({
            'user': UserSerializer(user).data,
            'company': company_data,
            'role': settings_role,
            'actual_role': actual_role,
            'account_role': actual_role,
            'permissions': permissions,
            'user_code': user_code,
            'admin_code': ADMIN_CODE if actual_role == 'admin' else None,
            'partner_code': partner_code,
            'client_code': client_profile.client_code if client_profile else None,
            'client_code_display': f'C{client_profile.client_code}' if client_profile else None,
            'phone': client_profile.phone if client_profile else None,
            'subscription_status': client_profile.payment_status if client_profile else None,
            'is_access_enabled': client_profile.is_access_enabled if client_profile else None,
            'access_allowed': access_allowed,
            'access_message': access_message,
        })
