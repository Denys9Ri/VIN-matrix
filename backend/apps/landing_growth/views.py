import hashlib
import hmac
import json
import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .defaults import PUBLIC_EVENT_NAMES
from .engine import assigned_variant, build_evidence, session_hash
from .guard import sanitize_metadata
from .models import LandingChangeLog, LandingEvent, LandingExperiment, LandingGrowthSettings, LandingProposal, LandingSyncRun


def _client_ip(request):
    forwarded = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    return forwarded or request.META.get('REMOTE_ADDR') or 'unknown'


def _signature(payload):
    key = str(getattr(settings, 'LANDING_GROWTH_SIGNING_KEY', '') or settings.SECRET_KEY)
    raw = json.dumps(payload, separators=(',', ':'), sort_keys=True, ensure_ascii=False).encode('utf-8')
    return hmac.new(key.encode('utf-8'), raw, hashlib.sha256).hexdigest()


def _public_experiment(experiment):
    return {
        'id': str(experiment.pk),
        'kind': experiment.kind,
        'block_key': experiment.block_key,
        'field_path': experiment.field_path,
        'variant_value': experiment.variant_value,
        'allocation_percentage': experiment.allocation_percentage,
        'metric_name': experiment.metric_name,
        'started_at': experiment.started_at.isoformat() if experiment.started_at else None,
    }


class LandingGrowthConfigView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        growth_settings = LandingGrowthSettings.load()
        experiments = [
            _public_experiment(experiment)
            for experiment in LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING, kind=LandingExperiment.KIND_CONVERSION)[:1]
        ]
        payload = {
            'version': growth_settings.config_version,
            'mode': growth_settings.mode,
            'config': growth_settings.active_config,
            'experiments': experiments,
            'generated_at': timezone.now().isoformat(),
        }
        payload['signature'] = _signature(payload)
        etag = f'"landing-growth-{growth_settings.config_version}-{payload["signature"][:12]}"'
        response = Response(status=status.HTTP_304_NOT_MODIFIED) if request.headers.get('If-None-Match') == etag else Response(payload)
        response['ETag'] = etag
        response['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300'
        return response


class LandingGrowthEventView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        minute = f'{timezone.now():%Y%m%d%H%M}'
        count_key = f'landing-growth-ip-count:{ip}:{minute}'
        try:
            count = cache.incr(count_key)
        except ValueError:
            cache.set(count_key, 1, timeout=70)
            count = 1
        if count > 300:
            return Response({'error': 'Забагато подій.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        event_name = str(request.data.get('event_name') or '').strip()[:64]
        session_id = str(request.data.get('session_id') or '').strip()[:160]
        page_path = str(request.data.get('page_path') or '/')[:200]
        block_key = str(request.data.get('block_key') or '')[:40]
        if event_name not in PUBLIC_EVENT_NAMES:
            return Response({'error': 'Невідома подія.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(session_id) < 16:
            return Response({'error': 'Некоректна сесія.'}, status=status.HTTP_400_BAD_REQUEST)
        if not page_path.startswith('/'):
            page_path = '/'

        try:
            event_id = uuid.UUID(str(request.data.get('event_id'))) if request.data.get('event_id') else uuid.uuid4()
        except (TypeError, ValueError, AttributeError):
            return Response({'error': 'Некоректний event_id.'}, status=status.HTTP_400_BAD_REQUEST)

        experiment = None
        raw_experiment_id = request.data.get('experiment_id')
        if raw_experiment_id:
            try:
                experiment = LandingExperiment.objects.filter(pk=raw_experiment_id, status=LandingExperiment.STATUS_RUNNING, kind=LandingExperiment.KIND_CONVERSION).first()
            except (TypeError, ValueError):
                experiment = None
        variant = assigned_variant(experiment, session_id) if experiment else LandingEvent.VARIANT_NONE

        metadata = sanitize_metadata(request.data.get('metadata'))
        referrer = str(request.data.get('referrer') or '')[:500]
        if referrer:
            try:
                metadata['referrer_host'] = urlparse(referrer).netloc[:200]
            except ValueError:
                pass

        try:
            event, created = LandingEvent.objects.get_or_create(
                event_id=event_id,
                defaults={
                    'session_hash': session_hash(session_id),
                    'event_name': event_name,
                    'page_path': page_path,
                    'block_key': block_key or (experiment.block_key if experiment else ''),
                    'experiment': experiment,
                    'variant': variant,
                    'metadata': metadata,
                    'occurred_at': timezone.now(),
                },
            )
        except IntegrityError:
            event = LandingEvent.objects.filter(event_id=event_id).first()
            created = False
        return Response(
            {'ok': True, 'created': created, 'variant': event.variant if event else variant, 'experiment_id': str(experiment.pk) if experiment else None},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class LandingGrowthStatusView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        growth_settings = LandingGrowthSettings.load()
        running = LandingExperiment.objects.filter(status=LandingExperiment.STATUS_RUNNING).first()
        return Response({
            'settings': {
                'mode': growth_settings.mode,
                'config_version': growth_settings.config_version,
                'openai_enabled': growth_settings.openai_enabled,
                'auto_apply_low_risk': growth_settings.auto_apply_low_risk,
                'auto_apply_seo': growth_settings.auto_apply_seo,
            },
            'running_experiment': _public_experiment(running) if running else None,
            'evidence': build_evidence(),
            'recent_proposals': list(LandingProposal.objects.values('id', 'status', 'field_path', 'proposed_value', 'metric_name', 'source', 'created_at')[:10]),
            'recent_changes': list(LandingChangeLog.objects.values('id', 'action', 'field_path', 'before_value', 'after_value', 'config_version', 'created_at')[:10]),
            'recent_sync_runs': list(LandingSyncRun.objects.values('id', 'source', 'status', 'records_processed', 'error', 'started_at', 'finished_at')[:10]),
        })
