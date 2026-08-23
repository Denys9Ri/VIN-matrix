from django.db import migrations


INDEX_SQL = [
    "CREATE INDEX IF NOT EXISTS core_activitylog_company_created_idx ON core_activitylog (company_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_visit_idx ON core_activitylog (visit_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_user_idx ON core_activitylog (user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_action_idx ON core_activitylog (action_type, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_mode_idx ON core_activitylog (mode, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_order_part_idx ON core_activitylog (order_part_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS core_activitylog_inventory_idx ON core_activitylog (inventory_item_id, created_at DESC)",
]


def ensure_activity_log_table(apps, schema_editor):
    """Create the legacy activity table on clean installs without touching existing production data."""
    connection = schema_editor.connection
    vendor = connection.vendor

    with connection.cursor() as cursor:
        tables = set(connection.introspection.table_names(cursor))
        if 'core_activitylog' not in tables:
            if vendor == 'postgresql':
                cursor.execute(
                    """
                    CREATE TABLE core_activitylog (
                        id bigserial PRIMARY KEY,
                        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
                        user_id integer NULL REFERENCES auth_user(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
                        visit_id bigint NULL REFERENCES core_visit(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
                        order_part_id bigint NULL REFERENCES core_orderpart(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
                        inventory_item_id bigint NULL REFERENCES core_inventoryitem(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
                        mode varchar(20) NOT NULL DEFAULT 'system',
                        action_type varchar(80) NOT NULL DEFAULT 'system',
                        title varchar(255) NOT NULL DEFAULT 'Дія',
                        description text NULL,
                        old_value text NULL,
                        new_value text NULL,
                        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                        created_at timestamp with time zone NOT NULL DEFAULT now()
                    )
                    """
                )
            else:
                cursor.execute(
                    """
                    CREATE TABLE core_activitylog (
                        id integer PRIMARY KEY AUTOINCREMENT,
                        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE,
                        user_id integer NULL REFERENCES auth_user(id) ON DELETE SET NULL,
                        visit_id bigint NULL REFERENCES core_visit(id) ON DELETE SET NULL,
                        order_part_id bigint NULL REFERENCES core_orderpart(id) ON DELETE SET NULL,
                        inventory_item_id bigint NULL REFERENCES core_inventoryitem(id) ON DELETE SET NULL,
                        mode varchar(20) NOT NULL DEFAULT 'system',
                        action_type varchar(80) NOT NULL DEFAULT 'system',
                        title varchar(255) NOT NULL DEFAULT 'Дія',
                        description text NULL,
                        old_value text NULL,
                        new_value text NULL,
                        metadata text NOT NULL DEFAULT '{}',
                        created_at datetime NOT NULL
                    )
                    """
                )

        for sql in INDEX_SQL:
            cursor.execute(sql)

        if vendor == 'postgresql':
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS core_activitylog_metadata_phone_idx ON core_activitylog ((metadata->>'phone'))"
            )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0011_ensure_visitpayment_table'),
    ]

    operations = [
        migrations.RunPython(ensure_activity_log_table, migrations.RunPython.noop),
    ]
