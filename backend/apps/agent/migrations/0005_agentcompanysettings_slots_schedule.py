from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0004_agentcompanysettings_default_visit_duration_minutes'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentcompanysettings',
            name='workday_start_time',
            field=models.TimeField(default='09:00'),
        ),
        migrations.AddField(
            model_name='agentcompanysettings',
            name='workday_end_time',
            field=models.TimeField(default='18:00'),
        ),
        migrations.AddField(
            model_name='agentcompanysettings',
            name='slot_step_minutes',
            field=models.PositiveIntegerField(default=30),
        ),
    ]
