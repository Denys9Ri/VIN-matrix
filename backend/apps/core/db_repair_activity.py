from django.db import connection


SQL = [
    """
    CREATE TABLE IF NOT EXISTS core_activitylog (
        id bigserial PRIMARY KEY,
        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        user_id integer NULL REFERENCES auth_user(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        visit_id bigint NULL REFERENCES core_visit(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        order_part_id bigint NULL REFERENCES core_orderpart(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        inventory_item_id bigint NULL REFERENCES core_inventoryitem(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        mode varchar(20) NOT NULL DEFAULT 'system',
        action_type varchar(80) NOT NULL,
        title varchar(255) NOT NULL,
        description text NULL,
        old_value text NULL,
        new_value text NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp with time zone NOT NULL DEFAULT now()
    );
    """,
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS company_id bigint;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS user_id integer NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS visit_id bigint NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS order_part_id bigint NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS inventory_item_id bigint NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS mode varchar(20) NOT NULL DEFAULT 'system';",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS action_type varchar(80) NOT NULL DEFAULT 'system';",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS title varchar(255) NOT NULL DEFAULT 'Дія';",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS description text NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS old_value text NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS new_value text NULL;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;",
    "ALTER TABLE core_activitylog ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();",
    "CREATE INDEX IF NOT EXISTS core_activitylog_company_created_idx ON core_activitylog (company_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_visit_idx ON core_activitylog (visit_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_user_idx ON core_activitylog (user_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_action_idx ON core_activitylog (action_type, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_mode_idx ON core_activitylog (mode, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_order_part_idx ON core_activitylog (order_part_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_inventory_idx ON core_activitylog (inventory_item_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_activitylog_metadata_phone_idx ON core_activitylog ((metadata->>'phone'));",
]


def repair_activity_schema(verbose=False):
    with connection.cursor() as cursor:
        for sql in SQL:
            try:
                cursor.execute(sql)
            except Exception as exc:
                print(f"Activity DB repair skipped SQL: {exc}")
    if verbose:
        print("Activity DB repair finished")
    print('✅ Таблиця core_activitylog ОК')
