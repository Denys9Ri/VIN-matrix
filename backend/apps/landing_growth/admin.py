from django.contrib import admin

from .models import (
    LandingAIUsage, LandingAnalyticsMetric, LandingChangeLog, LandingEvent,
    LandingExperiment, LandingGrowthSettings, LandingProposal,
    LandingSearchMetric, LandingSyncRun,
)


@admin.register(LandingGrowthSettings)
class LandingGrowthSettingsAdmin(admin.ModelAdmin):
    list_display = ('mode', 'config_version', 'openai_enabled', 'auto_apply_low_risk', 'auto_apply_seo', 'updated_at')
    readonly_fields = ('config_version', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return not LandingGrowthSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LandingExperiment)
class LandingExperimentAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'status', 'field_path', 'metric_name', 'source', 'started_at', 'ended_at')
    list_filter = ('kind', 'status', 'source', 'risk_level')
    search_fields = ('name', 'field_path', 'variant_value', 'rationale')
    readonly_fields = ('id', 'baseline', 'result', 'started_at', 'ended_at', 'created_at', 'updated_at')


@admin.register(LandingProposal)
class LandingProposalAdmin(admin.ModelAdmin):
    list_display = ('field_path', 'status', 'metric_name', 'source', 'risk_level', 'created_at')
    list_filter = ('status', 'source', 'risk_level')
    search_fields = ('field_path', 'proposed_value', 'rationale', 'rejection_reason')
    readonly_fields = ('evidence', 'input_tokens', 'output_tokens', 'created_at', 'updated_at')


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
