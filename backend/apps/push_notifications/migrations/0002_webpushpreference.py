from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('push_notifications', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WebPushPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('visit_reminders', models.BooleanField(default=True)),
                ('status_updates', models.BooleanField(default=True)),
                ('payments', models.BooleanField(default=True)),
                ('inventory', models.BooleanField(default=True)),
                ('delivery', models.BooleanField(default=True)),
                ('crm', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='web_push_preferences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Web Push preference',
                'verbose_name_plural': 'Web Push preferences',
            },
        ),
    ]
