from django.db import connection


SQL = [
    """
    CREATE TABLE IF NOT EXISTS core_novapostprofile (
        id bigserial PRIMARY KEY,
        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        name varchar(160) NOT NULL DEFAULT 'Нова пошта',
        api_key text NOT NULL DEFAULT '',
        sender_name varchar(255) NULL,
        sender_phone varchar(40) NULL,
        sender_city varchar(255) NULL,
        sender_city_ref varchar(120) NULL,
        sender_warehouse varchar(255) NULL,
        sender_warehouse_ref varchar(120) NULL,
        is_default boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
    """,
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS company_id bigint;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS name varchar(160) NOT NULL DEFAULT 'Нова пошта';",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS api_key text NOT NULL DEFAULT '';",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_name varchar(255) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_phone varchar(40) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_city varchar(255) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_city_ref varchar(120) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_warehouse varchar(255) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS sender_warehouse_ref varchar(120) NULL;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();",
    "ALTER TABLE core_novapostprofile ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();",
    """
    CREATE TABLE IF NOT EXISTS core_delivery (
        id bigserial PRIMARY KEY,
        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        visit_id bigint NULL REFERENCES core_visit(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        novapost_profile_id bigint NULL REFERENCES core_novapostprofile(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        service varchar(40) NOT NULL DEFAULT 'nova_post',
        ttn varchar(80) NULL,
        status varchar(80) NOT NULL DEFAULT 'draft',
        status_text varchar(255) NULL,
        recipient_name varchar(255) NULL,
        recipient_phone varchar(40) NULL,
        recipient_city varchar(255) NULL,
        recipient_city_ref varchar(120) NULL,
        recipient_warehouse varchar(255) NULL,
        recipient_warehouse_ref varchar(120) NULL,
        payer_type varchar(40) NOT NULL DEFAULT 'recipient',
        payment_method varchar(40) NOT NULL DEFAULT 'cash',
        cod_enabled boolean NOT NULL DEFAULT false,
        cod_amount numeric(10, 2) NOT NULL DEFAULT 0,
        declared_value numeric(10, 2) NOT NULL DEFAULT 0,
        weight numeric(10, 3) NOT NULL DEFAULT 1,
        seats_amount integer NOT NULL DEFAULT 1,
        tracking_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now(),
        last_checked_at timestamp with time zone NULL
    );
    """,
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS company_id bigint;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS visit_id bigint NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS novapost_profile_id bigint NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS service varchar(40) NOT NULL DEFAULT 'nova_post';",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS ttn varchar(80) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS status varchar(80) NOT NULL DEFAULT 'draft';",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS status_text varchar(255) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_name varchar(255) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_phone varchar(40) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_city varchar(255) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_city_ref varchar(120) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_warehouse varchar(255) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS recipient_warehouse_ref varchar(120) NULL;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS payer_type varchar(40) NOT NULL DEFAULT 'recipient';",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS payment_method varchar(40) NOT NULL DEFAULT 'cash';",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT false;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS cod_amount numeric(10, 2) NOT NULL DEFAULT 0;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS declared_value numeric(10, 2) NOT NULL DEFAULT 0;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS weight numeric(10, 3) NOT NULL DEFAULT 1;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS seats_amount integer NOT NULL DEFAULT 1;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS tracking_data jsonb NOT NULL DEFAULT '{}'::jsonb;",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();",
    "ALTER TABLE core_delivery ADD COLUMN IF NOT EXISTS last_checked_at timestamp with time zone NULL;",
    "CREATE INDEX IF NOT EXISTS core_novapostprofile_company_idx ON core_novapostprofile (company_id, is_active);",
    "CREATE INDEX IF NOT EXISTS core_novapostprofile_default_idx ON core_novapostprofile (company_id, is_default) WHERE is_default = true;",
    "CREATE INDEX IF NOT EXISTS core_delivery_company_idx ON core_delivery (company_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_delivery_visit_idx ON core_delivery (visit_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_delivery_profile_idx ON core_delivery (novapost_profile_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_delivery_ttn_idx ON core_delivery (ttn);",
    "CREATE INDEX IF NOT EXISTS core_delivery_status_idx ON core_delivery (service, status, updated_at DESC);",
    "CREATE INDEX IF NOT EXISTS core_delivery_active_tracking_idx ON core_delivery (service, last_checked_at) WHERE status NOT IN ('received', 'returned', 'cancelled');",
]


def repair_novapost_schema(verbose=False):
    with connection.cursor() as cursor:
        for sql in SQL:
            try:
                cursor.execute(sql)
            except Exception as exc:
                print(f"NovaPost DB repair skipped SQL: {exc}")
    if verbose:
        print("NovaPost DB repair finished")
    print('✅ Таблиці core_novapostprofile та core_delivery ОК')
