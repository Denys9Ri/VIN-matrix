import hashlib
import hmac
import json
import logging
import math
import re
import uuid
from copy import deepcopy
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import F, FloatField, Q, Sum
from django.db.models.functions import Cast
from django.utils import timezone

from .clients import (
    ExternalServiceError,
    GA4Client,
    OpenAIProposalClient,
    SearchConsoleClient,
    default_collection_window,
)
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
    'hero.secondary_cta': [
        'Відкрити живе демо без реєстрації',
        'Подивитися VIN-matrix у роботі',
    ],
    'hero.primary_cta': [
        'Спробувати VIN-matrix 14 днів',
        'Створити робочий простір',
    ],
    'hero.note': [
        '14 днів повного доступу · реєстрація займає кілька хвилин',
        'Повний доступ на 14 днів · можна почати без дзвінка менеджеру',
    ],
    'hero.lead': [
        'VIN-matrix об’єднує записи, клієнтів, автомобілі, роботи, запчастини, оплату та аналітику в одному процесі для щоденної роботи СТО.',
    ],
    'tariff.cta': [
        'Почати 14-денний доступ',
        'Створити простір VIN-matrix',
    ],
    'final_cta.cta': [
        'Почати безкоштовний доступ',
        'Створити акаунт VIN-matrix',
    ],
    'seo.title': [
        'CRM для СТО та управління автобізнесом — VIN-matrix',
        'VIN-matrix — CRM і програма управління для СТО',
    ],
    'seo.description': [
        'VIN-matrix — CRM для СТО й автобізнесу: запис клієнтів, дошка візитів, автомобілі, склад, запчастини, документи, оплати та аналітика в одному процесі.',
    ],
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
        child = current.get(part)
        if not isinstance(child, dict):
            child = {}
            current[part] = child
        current = child
    current[parts[-1]] = value
    return data


def session_hash(session_id):
    key = str(getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') or settings.SECRET_KEY)
    return hmac.new(key.encode('utf-8'), str(session_id or '').encode('utf-8'), hashlib.sha256).hexdigest()


def record_registration_conversion(session_id, experiment_id='', variant='none'):
    if not session_id:
        return None
    hashed_session = session_hash(session_id)
    experiment = None
    if experiment_id:
        try:
            experiment = LandingExperiment.objects.filter(
                Q(status=LandingExperiment.STATUS_RUNNING)
                | Q(ended_at__gte=timezone.now() - timedelta(days=7)),
                pk=experiment_id,
                kind=LandingExperiment.KIND_CONVERSION,
            ).first()
        except (TypeError, ValueError):
            experiment = None
    if experiment and not LandingEvent.objects.filter(
        experiment=experiment,
        session_hash=hashed_session,
        event_name='landing_view',
    ).exists():
        experiment = None
    normalized_variant = assigned_variant(experiment, session_id) if experiment else LandingEvent.VARIANT_NONE
    return LandingEvent.objects.create(
        session_hash=hashed_session,
        event_name='register_complete',
        page_path='/register',
        block_key=experiment.block_key if experiment else 'registration',
        experiment=experiment,
        variant=normalized_variant,
        metadata={
            'source': 'server_registration',
            'client_variant': variant if variant in {'control', 'variant'} else 'none',
        },
    )


def _new_run(source):
    return LandingSyncRun.objects.create(source=source, status=LandingSyncRun.STATUS_RUNNING)


_EMAIL_QUERY_RE = re.compile(r'[^\s@]+@[^\s@]+\.[^\s@]+')
_PHONE_QUERY_RE = re.compile(r'(?<!\d)(?:\+?\d[\d\s()\-]{7,}\d)(?!\d)')


def sanitize_search_query(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip()
    text = _EMAIL_QUERY_RE.sub('[email-redacted]', text)
    text = _PHONE_QUERY_RE.sub('[phone-redacted]', text)
    return text[:500]


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
                date=date_value,
                query=sanitize_search_query(query),
                page=str(page)[:600],
                device=str(device)[:24],
                defaults={
                    'clicks': float(row.get('clicks') or 0),
                    'impressions': float(row.get('impressions') or 0),
                    'ctr': float(row.get('ctr') or 0),
                    'position': float(row.get('position') or 0),
                },
            )
            processed += 1
        run.finish(
            LandingSyncRun.STATUS_SUCCESS,
            records=processed,
            details={'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
        )
        return processed
    except ExternalServiceError as exc:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error=str(exc))
        logger.warning('Landing Growth Search Console skipped: %s', exc)
        return 0
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc))
        logger.exception('Landing Growth Search Console collection failed')
        return 0


def _ga4_value(row, index, kind):
    values = row.get(kind) or []
    if index >= len(values):
        return ''
    return values[index].get('value', '')


def collect_ga4(days=3):
    run = _new_run(LandingSyncRun.SOURCE_GA4)
    try:
        start_date, end_date = default_collection_window(days)
        report = GA4Client().main_page_events(start_date, end_date)
        processed = 0
        for row in report.get('rows') or []:
            raw_date = _ga4_value(row, 0, 'dimensionValues')
            if len(raw_date) != 8:
                continue
            date_value = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}'
            event_name = _ga4_value(row, 1, 'dimensionValues')[:80]
            source_medium = _ga4_value(row, 2, 'dimensionValues')[:200]
            LandingAnalyticsMetric.objects.update_or_create(
                date=date_value,
                event_name=event_name,
                source_medium=source_medium,
                defaults={
                    'event_count': float(_ga4_value(row, 0, 'metricValues') or 0),
                    'total_users': float(_ga4_value(row, 1, 'metricValues') or 0),
                    'sessions': float(_ga4_value(row, 2, 'metricValues') or 0),
                },
            )
            processed += 1
        run.finish(
            LandingSyncRun.STATUS_SUCCESS,
            records=processed,
            details={'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
        )
        return processed
    except ExternalServiceError as exc:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error=str(exc))
        logger.warning('Landing Growth GA4 skipped: %s', exc)
        return 0
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc))
        logger.exception('Landing Growth GA4 collection failed')
        return 0


def _search_summary(days=28, *, after=None):
    queryset = LandingSearchMetric.objects.all()
    if after:
        queryset = queryset.filter(date__gte=after)
    else:
        queryset = queryset.filter(date__gte=timezone.localdate() - timedelta(days=days))
    totals = queryset.aggregate(clicks=Sum('clicks'), impressions=Sum('impressions'))
    clicks = float(totals['clicks'] or 0)
    impressions = float(totals['impressions'] or 0)
    weighted = queryset.annotate(
        weighted_position=Cast(F('position') * F('impressions'), FloatField())
    ).aggregate(total=Sum('weighted_position'))['total']
    return {
        'clicks': clicks,
        'impressions': impressions,
        'ctr': clicks / impressions if impressions else 0,
        'position': float(weighted or 0) / impressions if impressions else 0,
    }


def _internal_summary(days=28):
    since = timezone.now() - timedelta(days=days)
    queryset = LandingEvent.objects.filter(occurred_at__gte=since)
    sessions = queryset.filter(event_name='landing_view').values('session_hash').distinct().count()

    def unique(event_name):
        return queryset.filter(event_name=event_name).values('session_hash').distinct().count()

    values = {
        'sessions': sessions,
        'hero_register_click': unique('hero_register_click'),
        'hero_demo_click': unique('hero_demo_click'),
        'pricing_register_click': unique('pricing_register_click'),
        'final_register_click': unique('final_register_click'),
        'register_start': unique('register_start'),
        'register_complete': unique('register_complete'),
    }
    for key in list(values):
        if key != 'sessions':
            values[f'{key}_rate'] = values[key] / sessions if sessions else 0
    return values


def _ga4_summary(days=28):
    since = timezone.localdate() - timedelta(days=days)
    queryset = LandingAnalyticsMetric.objects.filter(date__gte=since)
    event_names = [
        'page_view',
        'hero_register_click',
        'hero_demo_click',
        'pricing_register_click',
        'final_register_click',
        'register_start',
        'register_complete',
    ]
    events = {}
    for event_name in event_names:
        totals = queryset.filter(event_name=event_name).aggregate(
            event_count=Sum('event_count'),
            total_users=Sum('total_users'),
            sessions=Sum('sessions'),
        )
        events[event_name] = {
            'event_count': float(totals['event_count'] or 0),
            'total_users': float(totals['total_users'] or 0),
            'sessions': float(totals['sessions'] or 0),
        }
    return {'events': events, 'rows': queryset.count()}


def build_evidence():
    return {
        'period_days': 28,
        'internal': _internal_summary(28),
        'ga4': _ga4_summary(28),
        'search_console': _search_summary(28),
        'generated_at': timezone.now().isoformat(),
    }


def _expected_organic_ctr(position):
    # Conservative internal heuristic used only to decide whether a title test is worth running.
    curve = {1: 0.25, 2: 0.15, 3: 0.10, 4: 0.075, 5: 0.055, 6: 0.045, 7: 0.038, 8: 0.032, 9: 0.027, 10: 0.023, 15: 0.012}
    rounded = max(1, min(15, int(round(position or 15))))
    if rounded in curve:
        return curve[rounded]
    lower = max(key for key in curve if key < rounded)
    upper = min(key for key in curve if key > rounded)
    ratio = (rounded - lower) / (upper - lower)
    return curve[lower] + (curve[upper] - curve[lower]) * ratio


def _metric_test_budget_available(metric_name, limit=3, days=180):
    return LandingExperiment.objects.filter(
        metric_name=metric_name,
        created_at__gte=timezone.now() - timedelta(days=days),
    ).exclude(status=LandingExperiment.STATUS_PAUSED).count() < limit


def _determine_opportunity(evidence, growth_settings):
    internal = evidence['internal']
    search = evidence['search_console']

    if (
        search['impressions'] >= 300
        and 2 <= search['position'] <= 15
        and search['ctr'] < _expected_organic_ctr(search['position']) * 0.65
        and _metric_test_budget_available('search_ctr', limit=3)
    ):
        return ['seo.title', 'seo.description'], 'search_ctr'
    if internal['sessions'] < growth_settings.min_baseline_sessions:
        return [], ''
    if internal['hero_demo_click_rate'] < 0.08 and _metric_test_budget_available('hero_demo_click'):
        return ['hero.secondary_cta', 'hero.eyebrow'], 'hero_demo_click'
    if internal['hero_register_click_rate'] < 0.025 and _metric_test_budget_available('hero_register_click'):
        return ['hero.primary_cta', 'hero.note', 'hero.lead'], 'hero_register_click'
    if internal['pricing_register_click_rate'] < 0.015 and _metric_test_budget_available('pricing_register_click'):
        return ['tariff.cta', 'tariff.heading'], 'pricing_register_click'
    if internal['final_register_click_rate'] < 0.01 and _metric_test_budget_available('final_register_click'):
        return ['final_cta.cta', 'final_cta.heading'], 'final_register_click'
    if internal['register_complete_rate'] < 0.01 and _metric_test_budget_available('register_complete'):
        return ['hero.primary_cta', 'hero.lead', 'final_cta.cta'], 'register_complete'
    return [], ''


def _candidate_already_used(field_path, value, exclude_proposal_id=None):
    cutoff = timezone.now() - timedelta(days=180)
    tested = LandingExperiment.objects.filter(
        field_path=field_path,
        variant_value=value,
        created_at__gte=cutoff,
    ).exclude(status=LandingExperiment.STATUS_PAUSED).exists()
    pending_queryset = LandingProposal.objects.filter(
        field_path=field_path,
        proposed_value=value,
        status=LandingProposal.STATUS_PENDING,
        created_at__gte=cutoff,
    )
    if exclude_proposal_id is not None:
        pending_queryset = pending_queryset.exclude(pk=exclude_proposal_id)
    pending = pending_queryset.exists()
    return tested or pending


def _rule_proposal(allowed_fields, metric_name, config, evidence):
    for field_path in allowed_fields:
        current = deep_get(config, field_path, '')
        for candidate in RULE_CANDIDATES.get(field_path, []):
            if candidate == current or _candidate_already_used(field_path, candidate):
                continue
            guard = validate_candidate(field_path, candidate, current)
            if guard.ok:
                return {
                    'field_path': field_path,
                    'proposed_value': guard.normalized_value,
                    'metric_name': metric_name or ALLOWED_FIELD_RULES[field_path]['metric'],
                    'rationale': 'Правило обрало один чіткий варіант для контрольованого тесту.',
                    '_source': LandingExperiment.SOURCE_RULE,
                    '_risk': guard.risk_level,
                }
    return None


def generate_proposal(growth_settings, evidence):
    allowed_fields, metric_name = _determine_opportunity(evidence, growth_settings)
    if not allowed_fields:
        return None

    if growth_settings.mode == LandingGrowthSettings.MODE_SAFE_AUTOPILOT:
        allowed_fields = [
            field_path
            for field_path in allowed_fields
            if ALLOWED_FIELD_RULES[field_path].get('risk') == 'low'
            or ALLOWED_FIELD_RULES[field_path].get('seo')
        ]
        if not allowed_fields:
            return None

    current_config = growth_settings.active_config
    raw = None
    usage = {}
    if growth_settings.openai_enabled:
        try:
            raw, usage = OpenAIProposalClient().generate(
                growth_settings=growth_settings,
                current_config=current_config,
                evidence=evidence,
                allowed_fields=allowed_fields,
            )
            raw['_source'] = LandingExperiment.SOURCE_OPENAI
        except ExternalServiceError as exc:
            logger.warning('Landing Growth OpenAI proposal skipped: %s', exc)
        except Exception:
            logger.exception('Landing Growth OpenAI proposal failed')

    if not raw:
        raw = _rule_proposal(allowed_fields, metric_name, current_config, evidence)
        usage = {}
    if not raw:
        return None

    field_path = raw.get('field_path', '')
    current_value = str(deep_get(current_config, field_path, ''))
    guard = validate_candidate(field_path, raw.get('proposed_value'), current_value)
    proposal = LandingProposal.objects.create(
        field_path=field_path,
        proposed_value=guard.normalized_value or str(raw.get('proposed_value') or ''),
        metric_name=metric_name or ALLOWED_FIELD_RULES.get(field_path, {}).get('metric', ''),
        rationale=str(raw.get('rationale') or '')[:2000],
        evidence=evidence,
        source=raw.get('_source', LandingExperiment.SOURCE_RULE),
        risk_level=guard.risk_level,
        ai_model=usage.get('model', ''),
        input_tokens=usage.get('input_tokens', 0),
        output_tokens=usage.get('output_tokens', 0),
    )
    if not guard.ok:
        proposal.status = LandingProposal.STATUS_REJECTED
        proposal.rejection_reason = guard.reason
        proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return None
    if field_path not in allowed_fields:
        proposal.status = LandingProposal.STATUS_REJECTED
        proposal.rejection_reason = 'Модель запропонувала поле поза поточною можливістю.'
        proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return None
    if _candidate_already_used(field_path, guard.normalized_value, exclude_proposal_id=proposal.pk):
        proposal.status = LandingProposal.STATUS_REJECTED
        proposal.rejection_reason = 'Такий варіант уже тестувався протягом останніх 180 днів.'
        proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return None
    return proposal


def _apply_config_value(field_path, value, *, experiment, action):
    with transaction.atomic():
        growth_settings = LandingGrowthSettings.objects.select_for_update().get(pk=1)
        before = str(deep_get(growth_settings.active_config, field_path, ''))
        new_config = deepcopy(growth_settings.active_config)
        deep_set(new_config, field_path, value)
        growth_settings.active_config = new_config
        growth_settings.config_version += 1
        growth_settings.save(update_fields=['active_config', 'config_version', 'updated_at'])
        LandingChangeLog.objects.create(
            action=action,
            field_path=field_path,
            before_value=before,
            after_value=value,
            config_version=growth_settings.config_version,
            experiment=experiment,
        )
        return growth_settings, before


def trigger_deploy(reason, *, experiment=None):
    url = str(getattr(settings, 'DEPLOY_TRIGGER_URL', '') or '').strip()
    growth_settings = LandingGrowthSettings.load()
    run = _new_run(LandingSyncRun.SOURCE_DEPLOY)
    if not url:
        run.finish(LandingSyncRun.STATUS_SKIPPED, error='DEPLOY_TRIGGER_URL не налаштовано.')
        return False

    payload = {
        'source': 'vin-matrix-landing-growth',
        'reason': reason,
        'config_version': growth_settings.config_version,
        'experiment_id': str(experiment.pk) if experiment else '',
        'timestamp': timezone.now().isoformat(),
    }
    body = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    signing_key = str(getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') or settings.SECRET_KEY)
    signature = hmac.new(signing_key.encode('utf-8'), body, hashlib.sha256).hexdigest()
    headers = {
        'Content-Type': 'application/json',
        'X-Landing-Growth-Signature': signature,
    }
    deploy_token = str(getattr(settings, 'LANDING_GROWTH_DEPLOY_TOKEN', '') or '').strip()
    if deploy_token:
        headers['Authorization'] = f'Bearer {deploy_token}'
    method = str(getattr(settings, 'LANDING_GROWTH_DEPLOY_METHOD', 'AUTO') or 'AUTO').upper()
    if method == 'AUTO':
        method = 'GET' if ('/api/v1/deploy' in url and ('uuid=' in url or 'tag=' in url)) else 'POST'
    if method not in {'GET', 'POST'}:
        method = 'POST'
    try:
        response = requests.request(method, url, data=None if method == 'GET' else body, headers=headers, timeout=20)
        if response.status_code >= 400:
            raise RuntimeError(f'Deploy webhook {response.status_code}: {response.text[:300]}')
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=1, details={'status_code': response.status_code})
        LandingChangeLog.objects.create(
            action=LandingChangeLog.ACTION_DEPLOY,
            config_version=growth_settings.config_version,
            experiment=experiment,
            details={'reason': reason, 'status_code': response.status_code},
        )
        return True
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc), details=payload)
        logger.exception('Landing Growth deploy trigger failed')
        return False


def recover_failed_deploy():
    latest = LandingSyncRun.objects.filter(source=LandingSyncRun.SOURCE_DEPLOY).first()
    if not latest or latest.status != LandingSyncRun.STATUS_FAILED:
        return True
    experiment_id = (latest.details or {}).get('experiment_id')
    experiment = None
    if experiment_id:
        try:
            experiment = LandingExperiment.objects.filter(pk=experiment_id).first()
        except (TypeError, ValueError):
            experiment = None
    return trigger_deploy('retry_current_landing_config', experiment=experiment)


def create_experiment_from_proposal(proposal, growth_settings):
    current_value = str(deep_get(growth_settings.active_config, proposal.field_path, ''))
    guard = validate_candidate(proposal.field_path, proposal.proposed_value, current_value)
    if not guard.ok:
        proposal.status = LandingProposal.STATUS_REJECTED
        proposal.rejection_reason = guard.reason
        proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        return None
    proposal_updates = []
    if proposal.proposed_value != guard.normalized_value:
        proposal.proposed_value = guard.normalized_value
        proposal_updates.append('proposed_value')
    if proposal.risk_level != guard.risk_level:
        proposal.risk_level = guard.risk_level
        proposal_updates.append('risk_level')
    if proposal_updates:
        proposal.save(update_fields=[*proposal_updates, 'updated_at'])

    rule = ALLOWED_FIELD_RULES[proposal.field_path]
    is_seo = bool(rule.get('seo'))
    if is_seo and not str(getattr(settings, 'DEPLOY_TRIGGER_URL', '') or '').strip():
        return None

    with transaction.atomic():
        locked_settings = LandingGrowthSettings.objects.select_for_update().get(pk=1)
        if LandingExperiment.objects.select_for_update().filter(
            status=LandingExperiment.STATUS_RUNNING
        ).exists():
            return None
        current_value = str(deep_get(locked_settings.active_config, proposal.field_path, ''))
        locked_guard = validate_candidate(proposal.field_path, proposal.proposed_value, current_value)
        if not locked_guard.ok:
            proposal.status = LandingProposal.STATUS_REJECTED
            proposal.rejection_reason = locked_guard.reason
            proposal.save(update_fields=['status', 'rejection_reason', 'updated_at'])
            return None
        experiment = LandingExperiment(
            name=f'{proposal.field_path}: {proposal.proposed_value[:80]}',
            kind=LandingExperiment.KIND_SEO if is_seo else LandingExperiment.KIND_CONVERSION,
            block_key=BLOCK_BY_FIELD[proposal.field_path],
            field_path=proposal.field_path,
            metric_name=proposal.metric_name,
            control_value=current_value,
            variant_value=proposal.proposed_value,
            allocation_percentage=50,
            min_sessions_per_arm=locked_settings.min_sessions_per_arm,
            min_conversions_total=locked_settings.min_conversions_total,
            max_days=locked_settings.experiment_max_days,
            source=proposal.source,
            risk_level=proposal.risk_level,
            rationale=proposal.rationale,
            baseline=_search_summary(28) if is_seo else {},
        )
        experiment.full_clean()
        experiment.save()
        experiment.start()
        proposal.status = LandingProposal.STATUS_EXPERIMENT
        proposal.experiment = experiment
        proposal.save(update_fields=['status', 'experiment', 'updated_at'])

    if is_seo:
        _apply_config_value(
            proposal.field_path,
            proposal.proposed_value,
            experiment=experiment,
            action=LandingChangeLog.ACTION_APPLY,
        )
        if not trigger_deploy('seo_experiment_started', experiment=experiment):
            _apply_config_value(
                experiment.field_path,
                experiment.control_value,
                experiment=experiment,
                action=LandingChangeLog.ACTION_ROLLBACK,
            )
            trigger_deploy('seo_experiment_deploy_failed_rollback', experiment=experiment)
            experiment.status = LandingExperiment.STATUS_PAUSED
            experiment.result = {'reason': 'deploy_failed'}
            experiment.ended_at = timezone.now()
            experiment.save(update_fields=['status', 'result', 'ended_at', 'updated_at'])
            proposal.status = LandingProposal.STATUS_PENDING
            proposal.experiment = None
            proposal.save(update_fields=['status', 'experiment', 'updated_at'])
            return None
    return experiment


def _conversion_stats(experiment):
    queryset = LandingEvent.objects.filter(experiment=experiment)
    target_event = CONVERSION_EVENT_BY_METRIC.get(experiment.metric_name, experiment.metric_name)

    def arm(variant):
        sessions = queryset.filter(
            variant=variant,
            event_name='landing_view',
        ).values('session_hash').distinct().count()
        conversions = queryset.filter(
            variant=variant,
            event_name=target_event,
        ).values('session_hash').distinct().count()
        return sessions, conversions

    control_sessions, control_conversions = arm(LandingEvent.VARIANT_CONTROL)
    variant_sessions, variant_conversions = arm(LandingEvent.VARIANT_TEST)
    control_rate = control_conversions / control_sessions if control_sessions else 0
    variant_rate = variant_conversions / variant_sessions if variant_sessions else 0
    pooled_sessions = control_sessions + variant_sessions
    pooled_conversions = control_conversions + variant_conversions
    pooled_rate = pooled_conversions / pooled_sessions if pooled_sessions else 0
    variance = pooled_rate * (1 - pooled_rate) * (
        (1 / control_sessions if control_sessions else 0) + (1 / variant_sessions if variant_sessions else 0)
    )
    z_score = (variant_rate - control_rate) / math.sqrt(variance) if variance > 0 else 0
    p_value = math.erfc(abs(z_score) / math.sqrt(2)) if variance > 0 else 1
    confidence = 1 - p_value
    relative_lift = (
        (variant_rate - control_rate) / control_rate
        if control_rate > 0
        else (1.0 if variant_rate > 0 else 0.0)
    )
    return {
        'target_event': target_event,
        'control_sessions': control_sessions,
        'variant_sessions': variant_sessions,
        'control_conversions': control_conversions,
        'variant_conversions': variant_conversions,
        'control_rate': control_rate,
        'variant_rate': variant_rate,
        'relative_lift': relative_lift,
        'confidence': confidence,
        'p_value': p_value,
        'z_score': z_score,
    }


def _complete_experiment(experiment, status, result):
    experiment.status = status
    experiment.result = result
    experiment.ended_at = timezone.now()
    experiment.save(update_fields=['status', 'result', 'ended_at', 'updated_at'])


def evaluate_conversion_experiment(experiment, growth_settings):
    stats = _conversion_stats(experiment)
    age_days = max(0, (timezone.now() - experiment.started_at).days)
    enough_sessions = (
        stats['control_sessions'] >= experiment.min_sessions_per_arm
        and stats['variant_sessions'] >= experiment.min_sessions_per_arm
    )
    enough_conversions = (
        stats['control_conversions'] + stats['variant_conversions'] >= experiment.min_conversions_total
    )
    threshold = float(experiment.confidence_threshold)
    minimum_lift = float(experiment.minimum_relative_lift)

    if enough_sessions and enough_conversions and stats['confidence'] >= threshold:
        if stats['relative_lift'] >= minimum_lift:
            _apply_config_value(
                experiment.field_path,
                experiment.variant_value,
                experiment=experiment,
                action=LandingChangeLog.ACTION_APPLY,
            )
            _complete_experiment(experiment, LandingExperiment.STATUS_WON, stats)
            return 'variant_won'
        if stats['relative_lift'] <= -minimum_lift:
            _complete_experiment(experiment, LandingExperiment.STATUS_LOST, stats)
            return 'control_won'

    if age_days >= experiment.max_days:
        _complete_experiment(experiment, LandingExperiment.STATUS_INCONCLUSIVE, stats)
        return 'inconclusive'
    experiment.result = stats
    experiment.save(update_fields=['result', 'updated_at'])
    return 'continue'


def evaluate_seo_experiment(experiment, growth_settings):
    age_days = max(0, (timezone.now() - experiment.started_at).days)
    if age_days < 14:
        return 'continue'
    current = _search_summary(after=experiment.started_at.date())
    baseline = experiment.baseline or {}
    baseline_ctr = float(baseline.get('ctr') or 0)
    current_ctr = float(current.get('ctr') or 0)
    baseline_position = float(baseline.get('position') or 0)
    current_position = float(current.get('position') or 0)
    relative_lift = (
        (current_ctr - baseline_ctr) / baseline_ctr
        if baseline_ctr > 0
        else (1.0 if current_ctr > 0 else 0.0)
    )
    position_delta = current_position - baseline_position if baseline_position and current_position else 0
    result = {
        'baseline': baseline,
        'current': current,
        'relative_ctr_lift': relative_lift,
        'position_delta': position_delta,
        'age_days': age_days,
    }
    enough_data = current['impressions'] >= max(100, float(baseline.get('impressions') or 0) * 0.35)
    if enough_data and relative_lift >= 0.05 and position_delta <= 1.5:
        _complete_experiment(experiment, LandingExperiment.STATUS_WON, result)
        return 'variant_won'
    if enough_data and (relative_lift <= -0.05 or position_delta > 1.5):
        _apply_config_value(
            experiment.field_path,
            experiment.control_value,
            experiment=experiment,
            action=LandingChangeLog.ACTION_ROLLBACK,
        )
        trigger_deploy('seo_experiment_rollback', experiment=experiment)
        _complete_experiment(experiment, LandingExperiment.STATUS_LOST, result)
        return 'control_won'
    if age_days >= experiment.max_days:
        _apply_config_value(
            experiment.field_path,
            experiment.control_value,
            experiment=experiment,
            action=LandingChangeLog.ACTION_ROLLBACK,
        )
        trigger_deploy('seo_experiment_inconclusive_rollback', experiment=experiment)
        _complete_experiment(experiment, LandingExperiment.STATUS_INCONCLUSIVE, result)
        return 'inconclusive'
    experiment.result = result
    experiment.save(update_fields=['result', 'updated_at'])
    return 'continue'


def evaluate_running_experiment(growth_settings):
    experiment = LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING).first()
    if not experiment:
        return None
    if experiment.kind == LandingExperiment.KIND_SEO:
        return evaluate_seo_experiment(experiment, growth_settings)
    return evaluate_conversion_experiment(experiment, growth_settings)


def _proposal_can_auto_start(proposal, growth_settings):
    rule = ALLOWED_FIELD_RULES.get(proposal.field_path, {})
    if rule.get('seo'):
        return bool(
            growth_settings.auto_apply_seo
            and str(getattr(settings, 'DEPLOY_TRIGGER_URL', '') or '').strip()
        )
    return bool(
        proposal.risk_level == LandingExperiment.RISK_LOW
        and growth_settings.auto_apply_low_risk
    )


def _next_eligible_pending_proposal(growth_settings):
    for proposal in LandingProposal.objects.filter(
        status=LandingProposal.STATUS_PENDING
    ).order_by('created_at')[:50]:
        if _proposal_can_auto_start(proposal, growth_settings):
            return proposal
    return None


def acquire_cycle_lock(lock_minutes=90):
    token = str(uuid.uuid4())
    now = timezone.now()
    with transaction.atomic():
        growth_settings = LandingGrowthSettings.objects.select_for_update().get(pk=1)
        if growth_settings.cycle_locked_until and growth_settings.cycle_locked_until > now:
            return None
        growth_settings.cycle_lock_token = token
        growth_settings.cycle_locked_until = now + timedelta(minutes=max(15, lock_minutes))
        growth_settings.save(update_fields=['cycle_lock_token', 'cycle_locked_until', 'updated_at'])
    return token


def release_cycle_lock(token):
    if not token:
        return
    with transaction.atomic():
        growth_settings = LandingGrowthSettings.objects.select_for_update().get(pk=1)
        if growth_settings.cycle_lock_token != token:
            return
        growth_settings.cycle_lock_token = ''
        growth_settings.cycle_locked_until = None
        growth_settings.save(update_fields=['cycle_lock_token', 'cycle_locked_until', 'updated_at'])


def cleanup_old_growth_data():
    today = timezone.localdate()
    deleted = {}
    deleted['events'] = LandingEvent.objects.filter(
        occurred_at__lt=timezone.now() - timedelta(days=180)
    ).delete()[0]
    deleted['search_metrics'] = LandingSearchMetric.objects.filter(
        date__lt=today - timedelta(days=400)
    ).delete()[0]
    deleted['analytics_metrics'] = LandingAnalyticsMetric.objects.filter(
        date__lt=today - timedelta(days=400)
    ).delete()[0]
    deleted['sync_runs'] = LandingSyncRun.objects.filter(
        started_at__lt=timezone.now() - timedelta(days=180)
    ).delete()[0]
    return deleted


def run_growth_cycle(*, collect=True, propose=True):
    LandingGrowthSettings.load()
    lock_minutes = int(getattr(settings, 'LANDING_GROWTH_LOCK_MINUTES', 90) or 90)
    lock_token = acquire_cycle_lock(lock_minutes=lock_minutes)
    run = _new_run(LandingSyncRun.SOURCE_ENGINE)
    if not lock_token:
        details = {'skipped': 'another_growth_cycle_is_running'}
        run.finish(LandingSyncRun.STATUS_SKIPPED, details=details)
        return details

    details = {}
    try:
        growth_settings = LandingGrowthSettings.load()
        details['cleanup'] = cleanup_old_growth_data()
        details['deploy_ready'] = recover_failed_deploy()
        if collect:
            details['search_console_records'] = collect_search_console()
            details['ga4_records'] = collect_ga4()

        details['experiment_result'] = evaluate_running_experiment(growth_settings)
        growth_settings.refresh_from_db()
        running = LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING).exists()

        if (
            propose
            and details['deploy_ready']
            and not running
            and growth_settings.mode != LandingGrowthSettings.MODE_OBSERVE
        ):
            proposal = None
            if growth_settings.mode == LandingGrowthSettings.MODE_SAFE_AUTOPILOT:
                proposal = _next_eligible_pending_proposal(growth_settings)
            if not proposal:
                evidence = build_evidence()
                details['evidence'] = evidence
                proposal = generate_proposal(growth_settings, evidence)
            if proposal:
                details['proposal_id'] = proposal.pk
                if (
                    growth_settings.mode == LandingGrowthSettings.MODE_SAFE_AUTOPILOT
                    and _proposal_can_auto_start(proposal, growth_settings)
                ):
                    experiment = create_experiment_from_proposal(proposal, growth_settings)
                    details['experiment_id'] = str(experiment.pk) if experiment else ''
        run.finish(LandingSyncRun.STATUS_SUCCESS, records=1, details=details)
        return details
    except Exception as exc:
        run.finish(LandingSyncRun.STATUS_FAILED, error=str(exc), details=details)
        logger.exception('Landing Growth cycle failed')
        raise
    finally:
        release_cycle_lock(lock_token)


def assigned_variant(experiment, raw_session_id):
    # FNV-1a 32-bit mirrors the browser implementation exactly. The assignment is
    # deterministic, stable across page loads and does not require exposing a secret.
    value = f'{experiment.pk}:{raw_session_id}'
    hash_value = 2166136261
    for character in value:
        hash_value ^= ord(character)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    bucket = hash_value % 100
    return (
        LandingEvent.VARIANT_TEST
        if bucket < experiment.allocation_percentage
        else LandingEvent.VARIANT_CONTROL
    )
