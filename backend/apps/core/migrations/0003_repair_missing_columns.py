from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_platformclient_referred_by'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE core_employee
            ADD COLUMN IF NOT EXISTS partner_code varchar(20) NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS core_employee_partner_code_unique
            ON core_employee (partner_code)
            WHERE partner_code IS NOT NULL;

            ALTER TABLE core_supplier
            ADD COLUMN IF NOT EXISTS warehouse_prefs jsonb NOT NULL DEFAULT '[]'::jsonb;

            ALTER TABLE core_company
            ADD COLUMN IF NOT EXISTS euro_rate numeric(6,2) NOT NULL DEFAULT 42.00;
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS core_employee_partner_code_unique;
            """,
        ),
    ]
