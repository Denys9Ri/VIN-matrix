from django.db import migrations, models


def ensure_acceptance_terms_column(apps, schema_editor):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        tables = set(connection.introspection.table_names(cursor))
        if 'core_visitacceptanceact' not in tables:
            return
        columns = {
            column.name
            for column in connection.introspection.get_table_description(cursor, 'core_visitacceptanceact')
        }
        if 'terms_text' not in columns:
            cursor.execute('ALTER TABLE core_visitacceptanceact ADD COLUMN terms_text text NULL')


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0012_ensure_activity_log_table'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='acceptance_act_terms',
            field=models.TextField(blank=True, default='', verbose_name='Acceptance act terms'),
        ),
        migrations.RunPython(ensure_acceptance_terms_column, migrations.RunPython.noop),
    ]
