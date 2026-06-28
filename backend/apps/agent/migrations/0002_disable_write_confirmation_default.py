from django.db import migrations, models


def set_direct_execution(apps, schema_editor):
    Settings = apps.get_model('agent', 'AgentCompanySettings')
    Settings.objects.update(require_confirmation_for_writes=False)


def keep_direct_execution(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [('agent', '0001_initial')]

    operations = [
        migrations.AlterField(
            model_name='agentcompanysettings',
            name='require_confirmation_for_writes',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(set_direct_execution, keep_direct_execution),
    ]
