from datetime import time

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import apps.push_notifications.models


class Migration(migrations.Migration):

    dependencies = [
        ('push_notifications', '0002_webpushpreference'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='webpushpreference',
            name='visit_reminder_minutes',
            field=models.PositiveSmallIntegerField(default=60),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='debt_schedule_days',
            field=models.CharField(choices=[('weekdays', 'Понеділок–пʼятниця'), ('daily', 'Щодня')], default='weekdays', max_length=20),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='debt_notification_times',
            field=models.JSONField(blank=True, default=apps.push_notifications.models.default_debt_notification_times),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='crm_reminder_days_before',
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='crm_notification_time',
            field=models.TimeField(default=time(10, 0)),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='quiet_hours_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='quiet_hours_start',
            field=models.TimeField(default=time(20, 0)),
        ),
        migrations.AddField(
            model_name='webpushpreference',
            name='quiet_hours_end',
            field=models.TimeField(default=time(8, 0)),
        ),
        migrations.CreateModel(
            name='WebPushDispatchLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_key', models.CharField(max_length=255)),
                ('category', models.CharField(max_length=40)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('delivered', models.PositiveIntegerField(default=0)),
                ('failed', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='web_push_dispatches', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Web Push dispatch log',
                'verbose_name_plural': 'Web Push dispatch logs',
                'ordering': ['-created_at', '-id'],
                'indexes': [models.Index(fields=['category', 'created_at'], name='push_notifi_categor_0eae64_idx')],
                'constraints': [models.UniqueConstraint(fields=('user', 'event_key'), name='push_dispatch_user_event_uniq')],
            },
        ),
    ]
