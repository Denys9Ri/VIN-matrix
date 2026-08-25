from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import apps.crm.models
import apps.crm.private_storage


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0012_ensure_activity_log_table'),
        ('crm', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='VisitAcceptancePhoto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('damages', 'Пошкодження кузова'), ('interior', 'Салон / речі в авто'), ('exterior', 'Зовнішній стан'), ('general', 'Загальне фото')], max_length=20)),
                ('image', models.ImageField(max_length=500, storage=apps.crm.private_storage.PrivateAcceptancePhotoStorage(), upload_to=apps.crm.models.acceptance_photo_upload_to)),
                ('original_name', models.CharField(blank=True, default='', max_length=255)),
                ('content_type', models.CharField(blank=True, default='', max_length=100)),
                ('size_bytes', models.PositiveBigIntegerField(default=0)),
                ('sha256', models.CharField(db_index=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visit_acceptance_photos', to='core.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acceptance_photos_created', to=settings.AUTH_USER_MODEL)),
                ('visit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='acceptance_photos', to='core.visit')),
            ],
            options={
                'verbose_name': 'Фото акта приймання',
                'verbose_name_plural': 'Фото актів приймання',
                'ordering': ['created_at', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='visitacceptancephoto',
            index=models.Index(fields=['company', 'visit', 'category'], name='accept_photo_visit_cat_idx'),
        ),
        migrations.AddIndex(
            model_name='visitacceptancephoto',
            index=models.Index(fields=['company', 'created_at'], name='accept_photo_company_date_idx'),
        ),
    ]
