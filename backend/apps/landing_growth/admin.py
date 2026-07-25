from django.contrib import admin, messages
from django.utils import timezone

from .engine import create_experiment_from_proposal
from .models import (
    LandingAIUsage,
    LandingAnalyticsMetric,
    LandingChangeLog,
    LandingEvent,
    LandingExperiment,
    LandingGrowthSettings,
    LandingProposal,
    LandingSearchMetric,
    LandingSyncRun,
)


@admin.register(LandingGrowthSettings)
class LandingGrowthSettingsAdmin(admin.ModelAdmin):
    list_display = ('mode', 'config_version', 'openai_enabled', 'auto_apply_low_risk', 'auto_apply_seo', 'updated_at')
    readonly_fields = ('active_config', 'config_version', 'cycle_lock_token', 'cycle_locked_until', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return not LandingGrowthSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LandingExperiment)
class LandingExperimentAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'status', 'field_path', 'metric_name', 'source', 'started_at', 'ended_at')
    list_filter = ('kind', 'status', 'source', 'risk_level')
    search_fields = ('name', 'field_path', 'variant_value', 'rationale')
    readonly_fields = tuple(field.name for field in LandingExperiment._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LandingProposal)
class LandingProposalAdmin(admin.ModelAdmin):
    list_display = ('field_path', 'status', 'metric_name', 'source', 'risk_level', 'created_at')
    list_filter = ('status', 'source', 'risk_level')
    search_fields = ('field_path', 'proposed_value', 'rationale', 'rejection_reason')
    readonly_fields = ('status', 'evidence', 'ai_model', 'input_tokens', 'output_tokens', 'rejection_reason', 'experiment', 'created_at', 'updated_at')
    actions = ('start_selected_proposal', 'reject_selected_proposals')

    @admin.action(description='Запустити вибрану пропозицію як експеримент')
    def start_selected_proposal(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, 'Оберіть рівно одну пропозицію.', level=messages.ERROR)
            return
        proposal = queryset.first()
        if proposal.status != LandingProposal.STATUS_PENDING:
            self.message_user(request, 'Можна запустити лише пропозицію зі статусом «Очікує».', level=messages.ERROR)
            return
        try:
            experiment = create_experiment_from_proposal(proposal, LandingGrowthSettings.load())
        except Exception as exc:
            self.message_user(request, f'Не вдалося запустити експеримент: {exc}', level=messages.ERROR)
            return
        if not experiment:
            proposal.refresh_from_db()
            reason = proposal.rejection_reason or 'перевірте активний тест і deploy webhook'
            self.message_user(request, f'Експеримент не запущено: {reason}.', level=messages.WARNING)
            return
        self.message_user(request, f'Експеримент «{experiment.name}» запущено.', level=messages.SUCCESS)

    @admin.action(description='Відхилити вибрані пропозиції')
    def reject_selected_proposals(self, request, queryset):
        updated = queryset.filter(status=LandingProposal.STATUS_PENDING).update(
            status=LandingProposal.STATUS_REJECTED,
            rejection_reason='Відхилено адміністратором.',
            updated_at=timezone.now(),
        )
        self.message_user(request, f'Відхилено пропозицій: {updated}.', level=messages.SUCCESS)


@admin.register(LandingEvent)
class LandingEventAdmin(admin.ModelAdmin):
    list_display = ('event_name', 'variant', 'block_key', 'experiment', 'occurred_at')
    list_filter = ('event_name', 'variant', 'occurred_at')
    search_fields = ('session_hash', 'page_path', 'block_key')
    readonly_fields = tuple(field.name for field in LandingEvent._meta.fields)


@admin.register(LandingSearchMetric)
class LandingSearchMetricAdmin(admin.ModelAdmin):
    list_display = ('date', 'query', 'device', 'clicks', 'impressions', 'ctr', 'position')
    list_filter = ('date', 'device')
    search_fields = ('query', 'page')


@admin.register(LandingAnalyticsMetric)
class LandingAnalyticsMetricAdmin(admin.ModelAdmin):
    list_display = ('date', 'event_name', 'source_medium', 'event_count', 'total_users', 'sessions')
    list_filter = ('date', 'event_name')
    search_fields = ('source_medium',)


@admin.register(LandingChangeLog)
class LandingChangeLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'field_path', 'config_version', 'experiment', 'created_at')
    list_filter = ('action', 'created_at')
    readonly_fields = tuple(field.name for field in LandingChangeLog._meta.fields)


@admin.register(LandingSyncRun)
class LandingSyncRunAdmin(admin.ModelAdmin):
    list_display = ('source', 'status', 'records_processed', 'started_at', 'finished_at')
    list_filter = ('source', 'status')
    readonly_fields = tuple(field.name for field in LandingSyncRun._meta.fields)


@admin.register(LandingAIUsage)
class LandingAIUsageAdmin(admin.ModelAdmin):
    list_display = ('date', 'calls', 'input_tokens', 'output_tokens', 'updated_at')
    readonly_fields = ('updated_at',)
