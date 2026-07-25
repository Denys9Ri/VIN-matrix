import uuid
from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

import apps.landing_growth.defaults


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='LandingAIUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(unique=True)),
                ('calls', models.PositiveIntegerField(default=0)),
                ('input_tokens', models.PositiveIntegerField(default=0)),
                ('output_tokens', models.PositiveIntegerField(default=0)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-date']},
        ),
        migrations.CreateModel(
            name='LandingAnalyticsMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('event_name', models.CharField(max_length=80)),
                ('source_medium', models.CharField(blank=True, max_length=200)),
                ('event_count', models.FloatField(default=0)),
                ('total_users', models.FloatField(default=0)),
                ('sessions', models.FloatField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='LandingExperiment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=180)),
                ('kind', models.CharField(choices=[('conversion', 'A/B конверсія'), ('seo_sequential', 'Послідовний SEO-тест')], default='conversion', max_length=24)),
                ('status', models.CharField(choices=[('draft', 'Чернетка'), ('running', 'Виконується'), ('won', 'Переміг варіант'), ('lost', 'Переміг контроль'), ('inconclusive', 'Недостатньо даних'), ('paused', 'Призупинено')], db_index=True, default='draft', max_length=20)),
                ('block_key', models.CharField(max_length=40)),
                ('field_path', models.CharField(max_length=80)),
                ('metric_name', models.CharField(max_length=64)),
                ('control_value', models.TextField()),
                ('variant_value', models.TextField()),
                ('allocation_percentage', models.PositiveSmallIntegerField(default=50)),
                ('minimum_relative_lift', models.DecimalField(decimal_places=4, default=Decimal('0.0500'), max_digits=5)),
                ('confidence_threshold', models.DecimalField(decimal_places=4, default=Decimal('0.9500'), max_digits=5)),
                ('min_sessions_per_arm', models.PositiveIntegerField(default=100)),
                ('min_conversions_total', models.PositiveIntegerField(default=12)),
                ('max_days', models.PositiveSmallIntegerField(default=21)),
                ('source', models.CharField(choices=[('rule', 'Правило'), ('openai', 'OpenAI'), ('manual', 'Вручну')], default='rule', max_length=20)),
                ('risk_level', models.CharField(choices=[('low', 'Низький'), ('medium', 'Середній')], default='low', max_length=12)),
                ('rationale', models.TextField(blank=True)),
                ('baseline', models.JSONField(blank=True, default=dict)),
                ('result', models.JSONField(blank=True, default=dict)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='LandingGrowthSettings',
            fields=[
                ('id', models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ('mode', models.CharField(choices=[('observe', 'Спостереження'), ('recommend', 'Рекомендації'), ('safe_autopilot', 'Безпечний автопілот')], default='safe_autopilot', max_length=24)),
                ('active_config', models.JSONField(default=apps.landing_growth.defaults.default_landing_config)),
                ('config_version', models.PositiveIntegerField(default=1)),
                ('openai_enabled', models.BooleanField(default=True)),
                ('auto_apply_low_risk', models.BooleanField(default=True)),
                ('auto_apply_seo', models.BooleanField(default=True)),
                ('daily_openai_limit', models.PositiveSmallIntegerField(default=1)),
                ('monthly_openai_limit', models.PositiveSmallIntegerField(default=20)),
                ('min_baseline_sessions', models.PositiveIntegerField(default=120)),
                ('min_sessions_per_arm', models.PositiveIntegerField(default=100)),
                ('min_conversions_total', models.PositiveIntegerField(default=12)),
                ('experiment_max_days', models.PositiveSmallIntegerField(default=21)),
                ('cycle_lock_token', models.CharField(blank=True, max_length=36)),
                ('cycle_locked_until', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'verbose_name': 'Налаштування Growth Engine', 'verbose_name_plural': 'Налаштування Growth Engine'},
        ),
        migrations.CreateModel(
            name='LandingSearchMetric',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('query', models.CharField(blank=True, max_length=500)),
                ('page', models.URLField(max_length=600)),
                ('device', models.CharField(blank=True, max_length=24)),
                ('clicks', models.FloatField(default=0)),
                ('impressions', models.FloatField(default=0)),
                ('ctr', models.FloatField(default=0)),
                ('position', models.FloatField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name='LandingSyncRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.CharField(choices=[('search_console', 'Search Console'), ('ga4', 'GA4'), ('internal', 'Внутрішні події'), ('engine', 'Growth Engine'), ('deploy', 'Deploy')], max_length=24)),
                ('status', models.CharField(choices=[('running', 'Виконується'), ('success', 'Успішно'), ('skipped', 'Пропущено'), ('failed', 'Помилка')], default='running', max_length=16)),
                ('records_processed', models.PositiveIntegerField(default=0)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('error', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'ordering': ['-started_at']},
        ),
        migrations.CreateModel(
            name='LandingEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('session_hash', models.CharField(db_index=True, max_length=64)),
                ('event_name', models.CharField(db_index=True, max_length=64)),
                ('page_path', models.CharField(default='/', max_length=200)),
                ('block_key', models.CharField(blank=True, max_length=40)),
                ('variant', models.CharField(choices=[('control', 'Контроль'), ('variant', 'Варіант'), ('none', 'Без експерименту')], db_index=True, default='none', max_length=12)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('occurred_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('experiment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='events', to='landing_growth.landingexperiment')),
            ],
            options={'ordering': ['-occurred_at']},
        ),
        migrations.CreateModel(
            name='LandingProposal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Очікує'), ('experiment_created', 'Експеримент створено'), ('rejected', 'Відхилено')], db_index=True, default='pending', max_length=24)),
                ('field_path', models.CharField(max_length=80)),
                ('proposed_value', models.TextField()),
                ('metric_name', models.CharField(max_length=64)),
                ('rationale', models.TextField()),
                ('evidence', models.JSONField(blank=True, default=dict)),
                ('source', models.CharField(choices=[('rule', 'Правило'), ('openai', 'OpenAI'), ('manual', 'Вручну')], max_length=20)),
                ('risk_level', models.CharField(choices=[('low', 'Низький'), ('medium', 'Середній')], max_length=12)),
                ('ai_model', models.CharField(blank=True, max_length=80)),
                ('input_tokens', models.PositiveIntegerField(default=0)),
                ('output_tokens', models.PositiveIntegerField(default=0)),
                ('rejection_reason', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('experiment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='proposals', to='landing_growth.landingexperiment')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='LandingChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('apply', 'Застосовано'), ('rollback', 'Відкочено'), ('deploy', 'Deploy')], max_length=16)),
                ('field_path', models.CharField(blank=True, max_length=80)),
                ('before_value', models.TextField(blank=True)),
                ('after_value', models.TextField(blank=True)),
                ('config_version', models.PositiveIntegerField(default=1)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('experiment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='landing_growth.landingexperiment')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='landingexperiment',
            index=models.Index(fields=['status', 'created_at'], name='lg_exp_status_created'),
        ),
        migrations.AddIndex(
            model_name='landingexperiment',
            index=models.Index(fields=['field_path', 'status'], name='lg_exp_field_status'),
        ),
        migrations.AddIndex(
            model_name='landingevent',
            index=models.Index(fields=['experiment', 'variant', 'event_name'], name='lg_evt_exp_variant_name'),
        ),
        migrations.AddIndex(
            model_name='landingevent',
            index=models.Index(fields=['occurred_at', 'event_name'], name='lg_evt_time_name'),
        ),
        migrations.AddConstraint(
            model_name='landingsearchmetric',
            constraint=models.UniqueConstraint(fields=('date', 'query', 'page', 'device'), name='lg_unique_search_metric'),
        ),
        migrations.AddIndex(
            model_name='landingsearchmetric',
            index=models.Index(fields=['page', 'date'], name='lg_search_page_date'),
        ),
        migrations.AddConstraint(
            model_name='landinganalyticsmetric',
            constraint=models.UniqueConstraint(fields=('date', 'event_name', 'source_medium'), name='lg_unique_analytics_metric'),
        ),
        migrations.AddIndex(
            model_name='landinganalyticsmetric',
            index=models.Index(fields=['event_name', 'date'], name='lg_analytics_event_date'),
        ),
    ]
