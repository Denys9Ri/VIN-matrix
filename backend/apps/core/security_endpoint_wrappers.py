"""Security boundaries for APIViews that historically relied on UI visibility.

The existing business implementations stay untouched. These wrappers add
server-side authorization and remove data the current employee was not granted.
"""

from rest_framework.permissions import IsAuthenticated

from .access_control import (
    CanManageInventory,
    CanReadPayments,
    CanTakePayments,
    CanViewFinances,
    CompanyOwnerOrPlatformAdmin,
    OwnerWritePermission,
    can_manage_inventory_data,
    can_take_payment_data,
    can_view_client_data,
    can_view_financial_data,
    is_mechanic_user,
    mechanic_feature_allowed,
)
from .activity_views import ActivityLogView as BaseActivityLogView
from .company_option_views import (
    CompanyDictionariesView,
    CompanyOptionBulkView as BaseCompanyOptionBulkView,
    CompanyOptionDetailView as BaseCompanyOptionDetailView,
    CompanyOptionListCreateView as BaseCompanyOptionListCreateView,
)
from .dashboard_views import DashboardSummaryView as BaseDashboardSummaryView
from .data_exchange_views import (
    BackupExportView as BaseBackupExportView,
    ClientsExportView as BaseClientsExportView,
    InventoryExportView as BaseInventoryExportView,
    LegacyClientsImportView as BaseLegacyClientsImportView,
    OrdersExportView as BaseOrdersExportView,
)
from .expense_views import StoExpenseViewSet as BaseStoExpenseViewSet
from .inventory_insights_views import InventoryInsightsView as BaseInventoryInsightsView
from .notification_views import NotificationsSummaryView as BaseNotificationsSummaryView
from .novapost_views import (
    NovaPostProfileDetailView as BaseNovaPostProfileDetailView,
    NovaPostProfileListCreateView as BaseNovaPostProfileListCreateView,
    NovaPostProfileTestView as BaseNovaPostProfileTestView,
)
from .onboarding_views import OnboardingView as BaseOnboardingView
from .payment_views import (
    VisitDebtReminderView as BaseVisitDebtReminderView,
    VisitPaymentListView as BaseVisitPaymentListView,
)
from .profile_views import ProfileSettingsView as BaseProfileSettingsView


OWNER_EXPORT_PERMISSIONS = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]


class ClientsExportView(BaseClientsExportView):
    permission_classes = OWNER_EXPORT_PERMISSIONS


class OrdersExportView(BaseOrdersExportView):
    permission_classes = OWNER_EXPORT_PERMISSIONS


class InventoryExportView(BaseInventoryExportView):
    permission_classes = OWNER_EXPORT_PERMISSIONS


class BackupExportView(BaseBackupExportView):
    permission_classes = OWNER_EXPORT_PERMISSIONS


class LegacyClientsImportView(BaseLegacyClientsImportView):
    permission_classes = OWNER_EXPORT_PERMISSIONS


class InventoryInsightsView(BaseInventoryInsightsView):
    permission_classes = [IsAuthenticated, CanManageInventory]


class StoExpenseViewSet(BaseStoExpenseViewSet):
    # CanViewFinances is deliberately read-only for mechanics. Owners retain
    # full CRUD through the same endpoint.
    permission_classes = [IsAuthenticated, CanViewFinances]


class CompanyOptionListCreateView(BaseCompanyOptionListCreateView):
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class CompanyOptionDetailView(BaseCompanyOptionDetailView):
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class CompanyOptionBulkView(BaseCompanyOptionBulkView):
    permission_classes = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]


class ActivityLogView(BaseActivityLogView):
    # The journal can contain historical prices, payment metadata and old/new
    # snapshots, so it is an owner-level audit surface.
    permission_classes = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]


class NovaPostProfileListCreateView(BaseNovaPostProfileListCreateView):
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class NovaPostProfileDetailView(BaseNovaPostProfileDetailView):
    permission_classes = [IsAuthenticated, OwnerWritePermission]


class NovaPostProfileTestView(BaseNovaPostProfileTestView):
    permission_classes = [IsAuthenticated, CompanyOwnerOrPlatformAdmin]


class VisitPaymentListView(BaseVisitPaymentListView):
    def get_permissions(self):
        classes = [IsAuthenticated, CanTakePayments] if self.request.method == 'POST' else [IsAuthenticated, CanReadPayments]
        return [permission() for permission in classes]


class VisitDebtReminderView(BaseVisitDebtReminderView):
    permission_classes = [IsAuthenticated, CanTakePayments]


SAFE_COMPANY_FIELDS = {
    'id',
    'name',
    'logo',
    'phone',
    'phones',
    'address',
    'business_type',
}

SAFE_MECHANIC_SETTINGS_FIELDS = {
    'user',
    'company',
    'role',
    'actual_role',
    'account_role',
    'permissions',
    'access_allowed',
    'access_message',
}


def _redact_company(company):
    if not isinstance(company, dict):
        return {}
    return {key: value for key, value in company.items() if key in SAFE_COMPANY_FIELDS}


class ProfileSettingsView(BaseProfileSettingsView):
    def get_permissions(self):
        classes = [IsAuthenticated]
        if self.request.method not in {'GET', 'HEAD', 'OPTIONS'}:
            classes.append(CompanyOwnerOrPlatformAdmin)
        return [permission() for permission in classes]

    def get(self, request):
        response = super().get(request)
        if is_mechanic_user(request.user) and isinstance(response.data, dict):
            data = dict(response.data)
            data['company'] = _redact_company(data.get('company'))
            response.data = {key: value for key, value in data.items() if key in SAFE_MECHANIC_SETTINGS_FIELDS}
        return response


class OnboardingView(BaseOnboardingView):
    permission_classes = [IsAuthenticated, OwnerWritePermission]

    def get(self, request):
        response = super().get(request)
        if is_mechanic_user(request.user) and isinstance(response.data, dict):
            data = dict(response.data)
            data['company'] = _redact_company(data.get('company'))
            response.data = data
        return response


def _strip_keys(mapping, keys):
    if not isinstance(mapping, dict):
        return mapping
    for key in keys:
        mapping.pop(key, None)
    return mapping


def _redact_collection(rows, keys):
    if not isinstance(rows, list):
        return rows
    for row in rows:
        if isinstance(row, dict):
            _strip_keys(row, keys)
    return rows


class DashboardSummaryView(BaseDashboardSummaryView):
    def get(self, request):
        response = super().get(request)
        if not isinstance(response.data, dict):
            return response

        data = response.data
        can_finance = can_view_financial_data(request.user)
        can_payments = can_take_payment_data(request.user)
        can_money = can_finance or can_payments
        can_inventory = can_manage_inventory_data(request.user)
        can_clients = can_view_client_data(request.user)
        can_analytics = mechanic_feature_allowed(request.user, 'can_view_analytics')

        if not can_finance:
            for period in (data.get('periods') or {}).values():
                _strip_keys(period, {'revenue', 'profit', 'average_check'})

        if not can_money:
            data['money'] = {}

        stock = data.get('stock')
        if not can_inventory:
            data['stock'] = {}
        elif not can_finance and isinstance(stock, dict):
            _strip_keys(stock, {
                'buy_value', 'sell_value', 'potential_profit', 'stock_buy_value',
                'stock_sell_value', 'purchase_value', 'purchase_expected_profit',
                'frozen_money', 'margin_percent', 'global_margin_percent',
            })

        if not (can_analytics and can_inventory):
            data['top_products'] = []
        elif not can_finance:
            _redact_collection(data.get('top_products'), {'revenue', 'profit'})

        if not can_clients:
            data['top_clients'] = []
            if isinstance(data.get('crm'), dict):
                data['crm']['recommendations'] = {'active': 0, 'soon': 0, 'overdue': 0, 'priority': []}
        elif not can_finance:
            _redact_collection(data.get('top_clients'), {'revenue', 'debt'})

        novapost = data.get('novapost')
        if isinstance(novapost, dict) and not can_money:
            novapost['cod_waiting_count'] = 0
            novapost['cod_waiting_total'] = 0
            if isinstance(novapost.get('sections'), list):
                novapost['sections'] = [section for section in novapost['sections'] if section.get('key') != 'np_cod_waiting']

        hidden_attention = set()
        if not can_money:
            hidden_attention.update({'debts', 'np_cod_waiting'})
        if not can_inventory:
            hidden_attention.add('low_stock')
        if isinstance(data.get('attention'), list):
            data['attention'] = [item for item in data['attention'] if item.get('key') not in hidden_attention]

        data['capabilities'] = {
            'can_view_finances': can_finance,
            'can_take_payments': can_payments,
            'can_manage_inventory': can_inventory,
            'can_view_clients': can_clients,
            'can_view_analytics': can_analytics,
        }
        return response


class NotificationsSummaryView(BaseNotificationsSummaryView):
    def get(self, request):
        response = super().get(request)
        if not isinstance(response.data, dict):
            return response

        data = response.data
        can_money = can_view_financial_data(request.user) or can_take_payment_data(request.user)
        can_inventory = can_manage_inventory_data(request.user)
        can_clients = can_view_client_data(request.user)

        hidden = set()
        if not can_inventory:
            hidden.add('low_stock')
        if not can_money:
            hidden.update({'debts', 'payment_due', 'np_cod_waiting'})
        if not can_clients:
            hidden.update({'crm_tasks', 'service_reminders', 'recommendations'})

        sections = [section for section in (data.get('sections') or []) if section.get('key') not in hidden]
        active = [section for section in sections if int(section.get('count') or 0) > 0]
        data['sections'] = sections
        data['active_sections'] = active
        data['total'] = sum(int(section.get('count') or 0) for section in active)
        data['critical'] = sum(int(section.get('count') or 0) for section in active if section.get('severity') == 'critical')
        data['warning'] = sum(int(section.get('count') or 0) for section in active if section.get('severity') == 'warning')
        data['info'] = sum(int(section.get('count') or 0) for section in active if section.get('severity') == 'info')
        return response
