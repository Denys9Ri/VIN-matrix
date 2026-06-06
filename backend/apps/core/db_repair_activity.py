from django.db import connection


def repair_activity_schema():
    """Create lightweight SaaS activity log table without requiring migrations."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS core_activitylog (
                    id BIGSERIAL PRIMARY KEY,
                    company_id BIGINT NOT NULL REFERENCES core_company(id) ON DELETE CASCADE,
                    user_id INTEGER NULL REFERENCES auth_user(id) ON DELETE SET NULL,
                    visit_id BIGINT NULL REFERENCES core_visit(id) ON DELETE SET NULL,
                    order_part_id BIGINT NULL REFERENCES core_orderpart(id) ON DELETE SET NULL,
                    inventory_item_id BIGINT NULL REFERENCES core_inventoryitem(id) ON DELETE SET NULL,
                    mode VARCHAR(20) NOT NULL DEFAULT 'system',
                    action_type VARCHAR(80) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    old_value TEXT NULL,
                    new_value TEXT NULL,
                    metadata JSONB NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_company_created ON core_activitylog(company_id, created_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_visit_created ON core_activitylog(visit_id, created_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_action_type ON core_activitylog(company_id, action_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_mode ON core_activitylog(company_id, mode)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_metadata_phone ON core_activitylog((metadata->>'phone'))")
        print('✅ Таблиця core_activitylog ОК')
    except Exception as exc:
        print(f'Activity schema repair failed: {exc}')
