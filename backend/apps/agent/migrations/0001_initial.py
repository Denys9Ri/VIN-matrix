# Generated manually for VIN-matrix Agent foundation.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentCompanySettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=False)),
                ('telegram_enabled', models.BooleanField(default=False)),
                ('viber_enabled', models.BooleanField(default=False)),
                ('allow_voice', models.BooleanField(default=True)),
                ('allow_images', models.BooleanField(default=True)),
                ('require_confirmation_for_writes', models.BooleanField(default=True)),
                ('monthly_action_limit', models.PositiveIntegerField(default=0, help_text='0 means no product-level limit.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='agent_settings', to='core.company')),
            ],
        ),
        migrations.CreateModel(
            name='AgentUserChannel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel_type', models.CharField(choices=[('telegram', 'Telegram'), ('viber', 'Viber')], max_length=20)),
                ('external_user_id', models.CharField(max_length=120)),
                ('chat_id', models.CharField(max_length=120)),
                ('display_name', models.CharField(blank=True, max_length=160)),
                ('is_active', models.BooleanField(default=True)),
                ('linked_at', models.DateTimeField(auto_now_add=True)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_channels', to='core.company')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_channels', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='AgentConnectionCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel_type', models.CharField(choices=[('telegram', 'Telegram'), ('viber', 'Viber')], max_length=20)),
                ('code', models.CharField(max_length=32, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_connection_codes', to='core.company')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_connection_codes', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='AgentConversation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('context', models.JSONField(blank=True, default=dict)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('last_message_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('channel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='conversations', to='agent.agentuserchannel')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_conversations', to='core.company')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_conversations', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='AgentPendingAction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action_type', models.CharField(max_length=80)),
                ('payload', models.JSONField(default=dict)),
                ('summary_text', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Очікує підтвердження'), ('confirmed', 'Підтверджено'), ('cancelled', 'Скасовано'), ('expired', 'Прострочено'), ('failed', 'Помилка')], default='pending', max_length=20)),
                ('expires_at', models.DateTimeField()),
                ('confirmed_at', models.DateTimeField(blank=True, null=True)),
                ('executed_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_pending_actions', to='core.company')),
                ('conversation', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pending_actions', to='agent.agentconversation')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_pending_actions', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='AgentAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_text', models.TextField(blank=True)),
                ('recognized_intent', models.CharField(blank=True, max_length=120)),
                ('tool_name', models.CharField(blank=True, max_length=120)),
                ('tool_input', models.JSONField(blank=True, default=dict)),
                ('tool_result', models.JSONField(blank=True, default=dict)),
                ('success', models.BooleanField(default=True)),
                ('error_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agent_audit_logs', to='core.company')),
                ('conversation', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to='agent.agentconversation')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='agent_audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.AddConstraint(
            model_name='agentuserchannel',
            constraint=models.UniqueConstraint(fields=('channel_type', 'external_user_id'), name='agent_unique_external_user_channel'),
        ),
        migrations.AddConstraint(
            model_name='agentuserchannel',
            constraint=models.UniqueConstraint(fields=('user', 'channel_type'), name='agent_unique_user_channel'),
        ),
        migrations.AddConstraint(
            model_name='agentconversation',
            constraint=models.UniqueConstraint(fields=('channel',), name='agent_one_active_conversation_per_channel'),
        ),
        migrations.AddIndex(model_name='agentuserchannel', index=models.Index(fields=['company', 'channel_type', 'is_active'], name='agent_chan_company_channel_active_idx')),
        migrations.AddIndex(model_name='agentuserchannel', index=models.Index(fields=['channel_type', 'chat_id'], name='agent_chan_channel_chat_idx')),
        migrations.AddIndex(model_name='agentconnectioncode', index=models.Index(fields=['code', 'expires_at'], name='agent_code_code_expires_idx')),
        migrations.AddIndex(model_name='agentconversation', index=models.Index(fields=['company', 'user', 'last_message_at'], name='agent_conv_company_user_last_idx')),
        migrations.AddIndex(model_name='agentpendingaction', index=models.Index(fields=['company', 'user', 'status', 'expires_at'], name='agent_action_company_user_status_idx')),
        migrations.AddIndex(model_name='agentpendingaction', index=models.Index(fields=['status', 'expires_at'], name='agent_action_status_expires_idx')),
        migrations.AddIndex(model_name='agentauditlog', index=models.Index(fields=['company', 'created_at'], name='agent_audit_company_created_idx')),
        migrations.AddIndex(model_name='agentauditlog', index=models.Index(fields=['user', 'created_at'], name='agent_audit_user_created_idx')),
        migrations.AddIndex(model_name='agentauditlog', index=models.Index(fields=['tool_name', 'created_at'], name='agent_audit_tool_created_idx')),
    ]
