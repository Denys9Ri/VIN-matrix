from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('crm', '0002_visitacceptancephoto'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='visitacceptancephoto',
            name='locked_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='visitacceptancephoto',
            name='locked_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='acceptance_photos_locked',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name='VisitAcceptanceActRevision',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot', models.JSONField(default=dict)),
                ('reason', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='acceptance_act_revisions', to='core.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acceptance_act_revisions_created', to=settings.AUTH_USER_MODEL)),
                ('visit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='acceptance_act_revisions', to='core.visit')),
            ],
            options={
                'verbose_name': 'Коригування акта приймання',
                'verbose_name_plural': 'Коригування актів приймання',
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='visitacceptanceactrevision',
            index=models.Index(fields=['company', 'visit', 'created_at'], name='accept_act_rev_visit_idx'),
        ),
    ]
