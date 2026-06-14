# Generated for VIN-matrix UI payment settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_sync_model_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='payment_link',
            field=models.URLField(blank=True, max_length=500, null=True, verbose_name='Payment link'),
        ),
        migrations.AddField(
            model_name='company',
            name='payment_requisites',
            field=models.TextField(blank=True, null=True, verbose_name='Payment requisites'),
        ),
        migrations.AddField(
            model_name='company',
            name='payment_instruction',
            field=models.TextField(blank=True, null=True, verbose_name='Payment instruction'),
        ),
    ]
