import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.landing_growth.engine import (
    assigned_variant,
    create_experiment_from_proposal,
    deep_get,
    evaluate_conversion_experiment,
    record_registration_conversion,
    run_growth_cycle,
    session_hash,
)
from apps.landing_growth.guard import validate_candidate
from apps.landing_growth.models import (
    LandingEvent,
    LandingExperiment,
    LandingGrowthSettings,
    LandingProposal,
)


class LandingGrowthApiTests(TestCase):
    def setUp(self):
        self.settings_obj = LandingGrowthSettings.load()

    def test_public_config_has_defaults_and_etag(self):
        response = self.client.get('/api/landing-growth/config/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], 1)
        self.assertEqual(response.json()['config']['hero']['title'], 'Менше хаосу.')
        self.assertIn('ETag', response)

        cached = self.client.get('/api/landing-growth/config/', HTTP_IF_NONE_MATCH=response['ETag'])
        self.assertEqual(cached.status_code, 304)

    def test_event_endpoint_recomputes_stable_variant(self):
        experiment = LandingExperiment.objects.create(
            name='CTA test',
            kind=LandingExperiment.KIND_CONVERSION,
            status=LandingExperiment.STATUS_RUNNING,
            block_key='hero',
            field_path='hero.primary_cta',
            metric_name='hero_register_click',
            control_value='Почати безкоштовно',
            variant_value='Спробувати VIN-matrix 14 днів',
            allocation_percentage=50,
            started_at=timezone.now(),
        )
        session_id = 'test-session-1234567890'
        response = self.client.post(
            '/api/landing-growth/events/',
            data={
                'event_id': str(uuid.uuid4()),
                'session_id': session_id,
                'event_name': 'landing_view',
                'page_path': '/',
                'experiment_id': str(experiment.pk),
                'metadata': {'utm_source': 'test', 'unexpected': 'discard-me'},
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        event = LandingEvent.objects.get()
        self.assertEqual(event.variant, assigned_variant(experiment, session_id))
        self.assertEqual(event.metadata, {'utm_source': 'test'})

    def test_public_endpoint_rejects_server_only_registration_event(self):
        response = self.client.post(
            '/api/landing-growth/events/',
            data={
                'event_id': str(uuid.uuid4()),
                'session_id': 'test-session-1234567890',
                'event_name': 'register_complete',
                'page_path': '/register',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(LandingEvent.objects.count(), 0)

    def test_duplicate_event_id_is_idempotent(self):
        event_id = str(uuid.uuid4())
        payload = {
            'event_id': event_id,
            'session_id': 'test-session-1234567890',
            'event_name': 'landing_view',
            'page_path': '/',
        }
        first = self.client.post('/api/landing-growth/events/', payload, content_type='application/json')
        second = self.client.post('/api/landing-growth/events/', payload, content_type='application/json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(LandingEvent.objects.count(), 1)


class LandingGrowthEngineTests(TestCase):
    def setUp(self):
        self.settings_obj = LandingGrowthSettings.load()

    def _event(self, experiment, variant, event_name, index):
        return LandingEvent.objects.create(
            event_id=uuid.uuid5(uuid.NAMESPACE_URL, f'{variant}-{event_name}-{index}'),
            session_hash=f'{variant}-session-{index:04d}',
            event_name=event_name,
            experiment=experiment,
            variant=variant,
            block_key='hero',
        )

    def test_statistically_strong_variant_is_applied(self):
        experiment = LandingExperiment.objects.create(
            name='Hero CTA winner',
            kind=LandingExperiment.KIND_CONVERSION,
            status=LandingExperiment.STATUS_RUNNING,
            block_key='hero',
            field_path='hero.primary_cta',
            metric_name='hero_register_click',
            control_value='Почати безкоштовно',
            variant_value='Спробувати VIN-matrix 14 днів',
            min_sessions_per_arm=100,
            min_conversions_total=20,
            started_at=timezone.now(),
        )
        for index in range(100):
            self._event(experiment, LandingEvent.VARIANT_CONTROL, 'landing_view', index)
            self._event(experiment, LandingEvent.VARIANT_TEST, 'landing_view', index)
        for index in range(10):
            self._event(experiment, LandingEvent.VARIANT_CONTROL, 'hero_register_click', index)
        for index in range(35):
            self._event(experiment, LandingEvent.VARIANT_TEST, 'hero_register_click', index)

        result = evaluate_conversion_experiment(experiment, self.settings_obj)
        self.assertEqual(result, 'variant_won')
        experiment.refresh_from_db()
        self.settings_obj.refresh_from_db()
        self.assertEqual(experiment.status, LandingExperiment.STATUS_WON)
        self.assertEqual(
            deep_get(self.settings_obj.active_config, 'hero.primary_cta'),
            'Спробувати VIN-matrix 14 днів',
        )

    def test_registration_conversion_uses_server_assignment(self):
        experiment = LandingExperiment.objects.create(
            name='Server attribution',
            kind=LandingExperiment.KIND_CONVERSION,
            status=LandingExperiment.STATUS_RUNNING,
            block_key='hero',
            field_path='hero.primary_cta',
            metric_name='register_complete',
            control_value='Почати безкоштовно',
            variant_value='Спробувати VIN-matrix 14 днів',
            started_at=timezone.now(),
        )
        session_id = 'server-attribution-session-1234'
        LandingEvent.objects.create(
            session_hash=session_hash(session_id),
            event_name='landing_view',
            experiment=experiment,
            variant=assigned_variant(experiment, session_id),
            block_key='hero',
        )
        event = record_registration_conversion(
            session_id,
            experiment_id=str(experiment.pk),
        )
        self.assertEqual(event.variant, assigned_variant(experiment, session_id))
        self.assertEqual(event.metadata['source'], 'server_registration')

    def test_registration_without_prior_landing_is_not_attributed(self):
        experiment = LandingExperiment.objects.create(
            name='No forged attribution',
            kind=LandingExperiment.KIND_CONVERSION,
            status=LandingExperiment.STATUS_RUNNING,
            block_key='hero',
            field_path='hero.primary_cta',
            metric_name='register_complete',
            control_value='Почати безкоштовно',
            variant_value='Спробувати VIN-matrix 14 днів',
            started_at=timezone.now(),
        )
        event = record_registration_conversion(
            'unseen-session-1234567890',
            experiment_id=str(experiment.pk),
        )
        self.assertIsNone(event.experiment)
        self.assertEqual(event.variant, LandingEvent.VARIANT_NONE)

    @override_settings(DEPLOY_TRIGGER_URL='https://example.test/deploy')
    @patch('apps.landing_growth.engine.trigger_deploy', side_effect=[False, False])
    def test_failed_seo_deploy_rolls_back_and_keeps_proposal_pending(self, deploy_mock):
        proposal = LandingProposal.objects.create(
            field_path='seo.title',
            proposed_value='CRM для СТО та управління автобізнесом — VIN-matrix',
            metric_name='search_ctr',
            rationale='SEO test',
            source=LandingExperiment.SOURCE_RULE,
            risk_level=LandingExperiment.RISK_MEDIUM,
        )
        experiment = create_experiment_from_proposal(proposal, self.settings_obj)
        self.assertIsNone(experiment)
        proposal.refresh_from_db()
        self.settings_obj.refresh_from_db()
        paused = LandingExperiment.objects.get()
        self.assertEqual(paused.status, LandingExperiment.STATUS_PAUSED)
        self.assertEqual(proposal.status, LandingProposal.STATUS_PENDING)
        self.assertEqual(deep_get(self.settings_obj.active_config, 'seo.title'), paused.control_value)
        self.assertEqual(deploy_mock.call_count, 2)

    def test_concurrent_cycle_is_skipped(self):
        self.settings_obj.cycle_lock_token = 'existing-lock'
        self.settings_obj.cycle_locked_until = timezone.now() + timedelta(minutes=30)
        self.settings_obj.save(update_fields=['cycle_lock_token', 'cycle_locked_until', 'updated_at'])
        result = run_growth_cycle(collect=False, propose=False)
        self.assertEqual(result['skipped'], 'another_growth_cycle_is_running')

    def test_guard_rejects_unverifiable_claim(self):
        result = validate_candidate(
            'hero.primary_cta',
            'Гарантовано станьте №1 за один день',
            'Почати безкоштовно',
        )
        self.assertFalse(result.ok)
        self.assertIn('маніпулятивну', result.reason)
