from django.db import migrations, models


def copy_legacy_phone(apps, schema_editor):
    Company = apps.get_model('core', 'Company')
    for company in Company.objects.exclude(phone__isnull=True).exclude(phone='').iterator():
        company.phones = [{
            'number': company.phone.strip(),
            'show_in_documents': True,
        }]
        company.save(update_fields=['phones'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_supportaccesssession'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='phones',
            field=models.JSONField(blank=True, default=list, verbose_name='Company phones'),
        ),
        migrations.RunPython(copy_legacy_phone, migrations.RunPython.noop),
    ]
