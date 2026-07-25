import hashlib
import hmac
import json
import logging
import math
from copy import deepcopy
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import F, FloatField, Sum
from django.db.models.functions import Cast
from django.utils import timezone

from .clients import ExternalServiceError, GA4Client, OpenAIProposalClient, SearchConsoleClient, default_collection_window
from .defaults import ALLOWED_FIELD_RULES, BLOCK_BY_FIELD, CONVERSION_EVENT_BY_METRIC
from .guard import validate_candidate
from .models import (
    LandingAnalyticsMetric,
    LandingChangeLog,
    LandingEvent,
    LandingExperiment,
    LandingGrowthSettings,
    LandingProposal,
    LandingSearchMetric,
    LandingSyncRun,
)

logger = logging.getLogger('vin_matrix')

RULE_CANDIDATES = {
    'hero.secondary_cta': ['Відкрити живе демо без реєстрації', 'Подивитися VIN-matrix у роботі'],
    'hero.primary_cta': ['Спробувати VIN-matrix 14 днів', 'Створити робочий простір'],
    'hero.note': ['14 днів повного доступу · реєстрація займає кілька хвилин', 'Повний доступ на 14 днів · можна почати без дзвінка менеджеру'],
    'hero.lead': ['VIN-matrix об’єднує записи, клієнтів, автомобілі, роботи, запчастини, оплату та аналітику в одному процесі для щоденної роботи СТО.'],
    'tariff.cta': ['Почати 14-денний доступ', 'Створити простір VIN-matrix'],
    'final_cta.cta': ['Почати безкоштовний доступ', 'Створити акаунт VIN-matrix'],
    'seo.title': ['CRM для СТО та управління автобізнесом — VIN-matrix', 'VIN-matrix — CRM і програма управління для СТО'],
    'seo.description': ['VIN-matrix — CRM для СТО й автобізнесу: запис клієнтів, дошка візитів, автомобілі, склад запчастин, документи, оплати та аналітика в одному робочому процесі.'],
}


def deep_get(data, path, default=''):
    current = data
    for part in path.split('.'):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def deep_set(data, path, value):
    current = data
    parts = path.split('.')
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = value
    return data


def session_hash(session_id):
    key = str(getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') or settings.SECRET_KEY)
    return hmac.new(key.encode(), str(session_id or '').encode(), hashlib.sha256).hexdigest()


def assigned_variant(experiment, session_id):
    if not experiment or not session_id:
        return LandingEvent.VARIANT_NONE
    value = f'{experiment.pk}:{session_id}'
    hash_value = 2166136261
    for character in value:
        hash_value ^= ord(character)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    return LandingEvent.VARIANT_TEST if hash_value % 100 < experiment.allocation_percentage else LandingEvent.VARIANT_CONTROL


def record_registration_conversion(session_id, experiment_id=''):
    if not session_id:
        return None
    experiment = None
    if experiment_id:
        try:
            experiment = LandingExperiment.objects.filter(pk=experiment_id).first()
        except (TypeError, ValueError):
            experiment = None
    return LandingEvent.objects.create(
        session_hash=session_hash(session_id),
        event_name='register_complete',
        page_path='/register',
        block_key=experiment.block_key if experiment else 'registration',
        experiment=experiment,
        variant=assigned_variant(experiment, session_id) if experiment else LandingEvent.VARIANT_NONE,
        metadata={'source': 'server_registration'},
    )


def _new_run(source):
    return LandingSyncRun.objects.create(source=source, status=LandingSyncRun.STATUS_RUNNING)


def collect_search_console(days=3):
    run = _new_run(LandingSyncRun.SOURCE_SEARCH_CONSOLE)
    try:
        start_date, end_date = default_collection_window(days)
        rows = SearchConsoleClient().query_main_page(start_date, end_date)
        processed = 0
        for row in rows:
            keys = row.get('keys') or []
            if len(keys) < 4:
                continue
            date_value, query, page, device = keys[:4]
            LandingSearchMetric.objects.update_or_create(
                date=date_value, query=str(query)[:500], page=str(page)[:600], device=str(device)[:24],
                defaults={
                    'clicks': float(row.get('clicks') or 0),
                    'impressions': float(row.get('impressions') or 0),
                    'ctr': float(row.get('ctr') or 0),
                    'position': float(row.get('position') or 0),
                },
            )
            processed += 1
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=processed, details={'start': start_date.isoformat(), 'end': end_date.isoformat()})
        return processed
    except ExternalServiceError as exc:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error=str(exc))
        logger.warning('Landing Growth Search Console skipped: %s', exc)
        return 0
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc))
        logger.exception('Landing Growth Search Console collection failed')
        return 0


def _ga_value(row, index, key):
    values = row.get(key) or []
    return values[index].get('value', '') if index < len(values) else ''


def collect_ga4(days=3):
    run = _new_run(LandingSyncRun.SOURCE_GA4)
    try:
        start_date, end_date = default_collection_window(days)
        report = GA4Client().main_page_events(start_date, end_date)
        processed = 0
        for row in report.get('rows') or []:
            raw_date = _ga_value(row, 0, 'dimensionValues')
            if len(raw_date) != 8:
                continue
            date_value = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}'
            event_name = _ga_value(row, 1, 'dimensionValues')[:80]
            source_medium = _ga_value(row, 2, 'dimensionValues')[:200]
            LandingAnalyticsMetric.objects.update_or_create(
                date=date_value, event_name=event_name, source_medium=source_medium,
                defaults={
                    'event_count': float(_ga_value(row, 0, 'metricValues') or 0),
                    'total_users': float(_ga_value(row, 1, 'metricValues') or 0),
                    'sessions': float(_ga_value(row, 2, 'metricValues') or 0),
                },
            )
            processed += 1
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=processed, details={'start': start_date.isoformat(), 'end': end_date.isoformat()})
        return processed
    except ExternalServiceError as exc:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error=str(exc))
        logger.warning('Landing Growth GA4 skipped: %s', exc)
        return 0
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc))
        logger.exception('Landing Growth GA4 collection failed')
        return 0


def search_summary(days=28, after=None):
    queryset = LandingSearchMetric.objects.all()
    queryset = queryset.filter(date__gte=after) if after else queryset.filter(date__gte=timezone.localdate() - timedelta(days=days))
    totals = queryset.aggregate(clicks=Sum('clicks'), impressions=Sum('impressions'))
    clicks = float(totals['clicks'] or 0)
    impressions = float(totals['impressions'] or 0)
    weighted = queryset.annotate(weighted=Cast(F('position') * F('impressions'), FloatField())).aggregate(total=Sum('weighted'))['total']
    return {'clicks': clicks, 'impressions': impressions, 'ctr': clicks / impressions if impressions else 0, 'position': float(weighted or 0) / impressions if impressions else 0}


def internal_summary(days=28):
    since = timezone.now() - timedelta(days=days)
    queryset = LandingEvent.objects.filter(occurred_at__gte=since)
    sessions = queryset.filter(event_name='landing_view').values('session_hash').distinct().count()
    result = {'sessions': sessions}
    for event_name in ['hero_register_click', 'hero_demo_click', 'pricing_register_click', 'final_register_click', 'register_start', 'register_complete']:
        count = queryset.filter(event_name=event_name).values('session_hash').distinct().count()
        result[event_name] = count
        result[f'{event_name}_rate'] = count / sessions if sessions else 0
    return result


def build_evidence():
    return {'period_days': 28, 'internal': internal_summary(), 'search_console': search_summary(), 'generated_at': timezone.now().isoformat()}


def determine_opportunity(evidence, growth_settings):
    internal = evidence['internal']
    search = evidence['search_console']
    if search['impressions'] >= 300 and search['ctr'] < 0.025:
        return ['seo.title', 'seo.description'], 'search_ctr'
    if internal['sessions'] < growth_settings.min_baseline_sessions:
        return [], ''
    if internal['hero_demo_click_rate'] < 0.08:
        return ['hero.secondary_cta', 'hero.eyebrow'], 'hero_demo_click'
    if internal['hero_register_click_rate'] < 0.025:
        return ['hero.primary_cta', 'hero.note', 'hero.lead'], 'hero_register_click'
    if internal['pricing_register_click_rate'] < 0.015:
        return ['tariff.cta', 'tariff.heading'], 'pricing_register_click'
    if internal['final_register_click_rate'] < 0.01:
        return ['final_cta.cta', 'final_cta.heading'], 'final_register_click'
    if internal['register_complete_rate'] < 0.01:
        return ['hero.primary_cta', 'hero.lead', 'final_cta.cta'], 'register_complete'
    return [], ''


def _candidate_used(field_path, value):
    return LandingExperiment.objects.filter(field_path=field_path, variant_value=value, created_at__gte=timezone.now() - timedelta(days=180)).exists()


def _rule_proposal(fields, metric_name, config):
    for field_path in fields:
        current = str(deep_get(config, field_path, ''))
        for candidate in RULE_CANDIDATES.get(field_path, []):
            guard = validate_candidate(field_path, candidate, current)
            if guard.ok and not _candidate_used(field_path, guard.normalized_value):
                return {'field_path': field_path, 'proposed_value': guard.normalized_value, 'metric_name': metric_name, 'rationale': 'Детерміноване правило обрало одну контрольовану зміну.', '_source': LandingExperiment.SOURCE_RULE}
    return None


def generate_proposal(growth_settings, evidence):
    fields, metric_name = determine_opportunity(evidence, growth_settings)
    if growth_settings.mode == LandingGrowthSettings.MODE_SAFE_AUTOPILOT:
        fields = [path for path in fields if ALLOWED_FIELD_RULES[path].get('risk') == 'low' or ALLOWED_FIELD_RULES[path].get('seo')]
    if not fields:
        return None

    raw = None
    usage = {}
    if growth_settings.openai_enabled:
        try:
            raw, usage = OpenAIProposalClient().generate(growth_settings=growth_settings, current_config=growth_settings.active_config, evidence=evidence, allowed_fields=fields)
            raw['_source'] = LandingExperiment.SOURCE_OPENAI
        except ExternalServiceError as exc:
            logger.warning('Landing Growth OpenAI skipped: %s', exc)
        except Exception:
            logger.exception('Landing Growth OpenAI proposal failed')
    raw = raw or _rule_proposal(fields, metric_name, growth_settings.active_config)
    if not raw:
        return None

    field_path = str(raw.get('field_path') or '')
    current = str(deep_get(growth_settings.active_config, field_path, ''))
    guard = validate_candidate(field_path, raw.get('proposed_value'), current)
    proposal = LandingProposal.objects.create(
        field_path=field_path,
        proposed_value=guard.normalized_value or str(raw.get('proposed_value') or ''),
        metric_name=metric_name,
        rationale=str(raw.get('rationale') or '')[:2000],
        evidence=evidence,
        source=raw.get('_source', LandingExperiment.SOURCE_RULE),
        risk_level=guard.risk_level,
        ai_model=usage.get('model', ''),
        input_tokens=usage.get('input_tokens', 0),
        output_tokens=usage.get('output_tokens', 0),
    )
    reason = ''
    if field_path not in fields:
        reason = 'Запропоноване поле не входить до поточної можливості.'
    elif not guard.ok:
        reason = guard.reason
    elif _candidate_used(field_path, guard.normalized_value):
        reason = 'Цей варіант уже тестувався протягом 180 днів.'
    if reason:
        proposal.status = LandingProposal.STATUS_REJECTED
        proposal.rejection_reason = reason
        proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return None
    return proposal


def apply_config_value(field_path, value, experiment, action):
    with transaction.atomic():
        growth_settings = LandingGrowthSettings.objects.select_for_update().get(pk=1)
        before = str(deep_get(growth_settings.active_config, field_path, ''))
        updated = deepcopy(growth_settings.active_config)
        deep_set(updated, field_path, value)
        growth_settings.active_config = updated
        growth_settings.config_version += 1
        growth_settings.save(update_fields=['active_config', 'config_version', 'updated_at'])
        LandingChangeLog.objects.create(action=action, field_path=field_path, before_value=before, after_value=value, config_version=growth_settings.config_version, experiment=experiment)
    return growth_settings


def trigger_deploy(reason, experiment=None):
    url = str(getattr(settings, 'DEPLOY_TRIGGER_URL', '') or '').strip()
    run = _new_run(LandingSyncRun.SOURCE_DEPLOY)
    if not url:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error='DEPLOY_TRIGGER_URL не налаштовано.')
        return False
    growth_settings = LandingGrowthSettings.load()
    payload = {'source': 'vin-matrix-landing-growth', 'reason': reason, 'config_version': growth_settings.config_version, 'experiment_id': str(experiment.pk) if experiment else '', 'timestamp': timezone.now().isoformat()}
    body = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()
    signing_key = str(getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') or settings.SECRET_KEY).encode()
    signature = hmac.new(signing_key, body, hashlib.sha256).hexdigest()
    try:
        response = requests.post(url, data=body, headers={'Content-Type': 'application/json', 'X-Landing-Growth-Signature': signature}, timeout=30)
        response.raise_for_status()
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=1, details=payload)
        LandingChangeLog.objects.create(action=LandingChangeLog.ACTION_DEPLOY, config_version=growth_settings.config_version, experiment=experiment, details=payload)
        return True
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc), details=payload)
        logger.exception('Landing Growth deploy trigger failed')
        return False


def create_experiment_from_proposal(proposal, growth_settings):
    current = str(deep_get(growth_settings.active_config, proposal.field_path, ''))
    rule = ALLOWED_FIELD_RULES[proposal.field_path]
    experiment = LandingExperiment(
        name=f'{proposal.field_path}: {proposal.proposed_value[:70]}',
        kind=LandingExperiment.KIND_SEO if rule.get('seo') else LandingExperiment.KIND_CONVERSION,
        block_key=BLOCK_BY_FIELD[proposal.field_path],
        field_path=proposal.field_path,
        metric_name=proposal.metric_name,
        control_value=current,
        variant_value=proposal.proposed_value,
        min_sessions_per_arm=growth_settings.min_sessions_per_arm,
        min_conversions_total=growth_settings.min_conversions_total,
        max_days=growth_settings.experiment_max_days,
        source=proposal.source,
        risk_level=proposal.risk_level,
        rationale=proposal.rationale,
        baseline=search_summary() if rule.get('seo') else {},
    )
    experiment.full_clean()
    experiment.save()
    experiment.start()
    proposal.status = LandingProposal.STATUS_EXPERIMENT
    proposal.experiment = experiment
    proposal.save(update_fields=['status', 'experiment', 'updated_at'])
    if experiment.kind == LandingExperiment.KIND_SEO:
        apply_config_value(experiment.field_path, experiment.variant_value, experiment, LandingChangeLog.ACTION_APPLY)
        trigger_deploy('seo_experiment_started', experiment)
    return experiment


def conversion_stats(experiment):
    target = CONVERSION_EVENT_BY_METRIC.get(experiment.metric_name, experiment.metric_name)
    queryset = LandingEvent.objects.filter(experiment=experiment, occurred_at__gte=experiment.started_at)
    def unique(variant, event):
        return queryset.filter(variant=variant, event_name=event).values('session_hash').distinct().count()
    control_sessions = unique(LandingEvent.VARIANT_CONTROL, 'landing_view')
    variant_sessions = unique(LandingEvent.VARIANT_TEST, 'landing_view')
    control_conversions = unique(LandingEvent.VARIANT_CONTROL, target)
    variant_conversions = unique(LandingEvent.VARIANT_TEST, target)
    control_rate = control_conversions / control_sessions if control_sessions else 0
    variant_rate = variant_conversions / variant_sessions if variant_sessions else 0
    total_n = control_sessions + variant_sessions
    pooled = (control_conversions + variant_conversions) / total_n if total_n else 0
    variance = pooled * (1 - pooled) * ((1 / control_sessions if control_sessions else 0) + (1 / variant_sessions if variant_sessions else 0))
    z_score = (variant_rate - control_rate) / math.sqrt(variance) if variance > 0 else 0
    p_value = math.erfc(abs(z_score) / math.sqrt(2)) if variance > 0 else 1
    confidence = 1 - p_value
    relative_lift = ((variant_rate - control_rate) / control_rate) if control_rate else (1 if variant_rate else 0)
    return {'target_event': target, 'control_sessions': control_sessions, 'variant_sessions': variant_sessions, 'control_conversions': control_conversions, 'variant_conversions': variant_conversions, 'control_rate': control_rate, 'variant_rate': variant_rate, 'relative_lift': relative_lift, 'confidence': confidence, 'p_value': p_value, 'z_score': z_score}


def complete_experiment(experiment, status, result):
    experiment.status = status
    experiment.result = result
    experiment.ended_at = timezone.now()
    experiment.save(update_fields=['status', 'result', 'ended_at', 'updated_at'])


def evaluate_conversion(experiment):
    stats = conversion_stats(experiment)
    age_days = max(0, (timezone.now() - experiment.started_at).days)
    enough_sessions = stats['control_sessions'] >= experiment.min_sessions_per_arm and stats['variant_sessions'] >= experiment.min_sessions_per_arm
    enough_conversions = stats['control_conversions'] + stats['variant_conversions'] >= experiment.min_conversions_total
    if enough_sessions and enough_conversions and stats['confidence'] >= float(experiment.confidence_threshold):
        minimum_lift = float(experiment.minimum_relative_lift)
        if stats['relative_lift'] >= minimum_lift:
            apply_config_value(experiment.field_path, experiment.variant_value, experiment, LandingChangeLog.ACTION_APPLY)
            complete_experiment(experiment, LandingExperiment.STATUS_WON, stats)
            return 'variant_won'
        if stats['relative_lift'] <= -minimum_lift:
            complete_experiment(experiment, LandingExperiment.STATUS_LOST, stats)
            return 'control_won'
    if age_days >= experiment.max_days:
        complete_experiment(experiment, LandingExperiment.STATUS_INCONCLUSIVE, stats)
        return 'inconclusive'
    experiment.result = stats
    experiment.save(update_fields=['result', 'updated_at'])
    return 'continue'


def evaluate_seo(experiment):
    age_days = max(0, (timezone.now() - experiment.started_at).days)
    if age_days < 14:
        return 'continue'
    current = search_summary(after=experiment.started_at.date())
    baseline = experiment.baseline or {}
    base_ctr = float(baseline.get('ctr') or 0)
    base_position = float(baseline.get('position') or 0)
    relative_lift = ((current['ctr'] - base_ctr) / base_ctr) if base_ctr else (1 if current['ctr'] else 0)
    position_delta = current['position'] - base_position if base_position and current['position'] else 0
    result = {'baseline': baseline, 'current': current, 'relative_ctr_lift': relative_lift, 'position_delta': position_delta, 'age_days': age_days}
    enough_data = current['impressions'] >= max(100, float(baseline.get('impressions') or 0) * 0.35)
    if enough_data and relative_lift >= 0.05 and position_delta <= 1.5:
        complete_experiment(experiment, LandingExperiment.STATUS_WON, result)
        return 'variant_won'
    if enough_data and (relative_lift <= -0.05 or position_delta > 1.5):
        apply_config_value(experiment.field_path, experiment.control_value, experiment, LandingChangeLog.ACTION_ROLLBACK)
        trigger_deploy('seo_experiment_rollback', experiment)
        complete_experiment(experiment, LandingExperiment.STATUS_LOST, result)
        return 'control_won'
    if age_days >= experiment.max_days:
        apply_config_value(experiment.field_path, experiment.control_value, experiment, LandingChangeLog.ACTION_ROLLBACK)
        trigger_deploy('seo_experiment_inconclusive_rollback', experiment)
        complete_experiment(experiment, LandingExperiment.STATUS_INCONCLUSIVE, result)
        return 'inconclusive'
    experiment.result = result
    experiment.save(update_fields=['result', 'updated_at'])
    return 'continue'


def evaluate_running_experiment():
    experiment = LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING).first()
    if not experiment:
        return None
    return evaluate_seo(experiment) if experiment.kind == LandingExperiment.KIND_SEO else evaluate_conversion(experiment)


def run_growth_cycle(collect=True, propose=True):
    run = _new_run(LandingSyncRun.SOURCE_ENGINE)
    details = {}
    try:
        growth_settings = LandingGrowthSettings.load()
        if collect:
            details['search_console_records'] = collect_search_console()
            details['ga4_records'] = collect_ga4()
        details['experiment_result'] = evaluate_running_experiment()
        growth_settings.refresh_from_db()
        running = LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING).exists()
        if propose and not running and growth_settings.mode != LandingGrowthSettings.MODE_OBSERVE:
            evidence = build_evidence()
            details['evidence'] = evidence
            proposal = generate_proposal(growth_settings, evidence)
            if proposal:
                details['proposal_id'] = proposal.pk
                if growth_settings.mode == LandingGrowthSettings.MODE_SAFE_AUTOPILOT:
                    rule = ALLOWED_FIELD_RULES[proposal.field_path]
                    allowed = (proposal.risk_level == LandingExperiment.RISK_LOW and growth_settings.auto_apply_low_risk) or (rule.get('seo') and growth_settings.auto_apply_seo)
                    if allowed:
                        experiment = create_experiment_from_proposal(proposal, growth_settings)
                        details['experiment_id'] = str(experiment.pk)
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=1, details=details)
        return details
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc), details=details)
        logger.exception('Landing Growth cycle failed')
        raise
