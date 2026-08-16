from django.urls import path

from .views import (
    FinanceAccountDetailView,
    FinanceAccountListCreateView,
    FinanceExportView,
    FinanceSummaryView,
    LegalEntityDetailView,
    LegalEntityListCreateView,
    ManualTransactionDetailView,
    ManualTransactionListCreateView,
    SourceAllocationView,
    VisitAssignmentView,
)


urlpatterns = [
    path('summary/', FinanceSummaryView.as_view(), name='finance-summary'),
    path('legal-entities/', LegalEntityListCreateView.as_view(), name='finance-legal-entities'),
    path('legal-entities/<int:pk>/', LegalEntityDetailView.as_view(), name='finance-legal-entity-detail'),
    path('accounts/', FinanceAccountListCreateView.as_view(), name='finance-accounts'),
    path('accounts/<int:pk>/', FinanceAccountDetailView.as_view(), name='finance-account-detail'),
    path('transactions/', ManualTransactionListCreateView.as_view(), name='finance-transactions'),
    path('transactions/<int:pk>/', ManualTransactionDetailView.as_view(), name='finance-transaction-detail'),
    path('visit/<int:visit_id>/assignment/', VisitAssignmentView.as_view(), name='finance-visit-assignment'),
    path('source-allocation/', SourceAllocationView.as_view(), name='finance-source-allocation'),
    path('export/', FinanceExportView.as_view(), name='finance-export'),
]
