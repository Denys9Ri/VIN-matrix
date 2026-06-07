from django.db import connection


SQL = [
    """
    CREATE TABLE IF NOT EXISTS core_companyoption (
        id bigserial PRIMARY KEY,
        company_id bigint NOT NULL REFERENCES core_company(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
        mode varchar(20) NOT NULL DEFAULT 'both',
        "group" varchar(60) NOT NULL,
        key varchar(80) NOT NULL,
        label varchar(120) NOT NULL,
        description text NULL,
        color varchar(30) NOT NULL DEFAULT 'slate',
        icon varchar(40) NULL,
        sort_order integer NOT NULL DEFAULT 100,
        is_active boolean NOT NULL DEFAULT true,
        is_system boolean NOT NULL DEFAULT false,
        is_default boolean NOT NULL DEFAULT false,
        semantic_role varchar(60) NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT core_companyoption_company_group_key_uniq UNIQUE (company_id, "group", key)
    );
    """,
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS company_id bigint;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS mode varchar(20) NOT NULL DEFAULT 'both';",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS \"group\" varchar(60) NOT NULL DEFAULT 'system';",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS key varchar(80) NOT NULL DEFAULT 'default';",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS label varchar(120) NOT NULL DEFAULT 'Опція';",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS description text NULL;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS color varchar(30) NOT NULL DEFAULT 'slate';",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS icon varchar(40) NULL;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS semantic_role varchar(60) NULL;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();",
    "ALTER TABLE core_companyoption ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();",
    "CREATE UNIQUE INDEX IF NOT EXISTS core_companyoption_company_group_key_uidx ON core_companyoption (company_id, \"group\", key);",
    "CREATE INDEX IF NOT EXISTS core_companyoption_company_group_active_idx ON core_companyoption (company_id, \"group\", is_active);",
    "CREATE INDEX IF NOT EXISTS core_companyoption_company_mode_group_idx ON core_companyoption (company_id, mode, \"group\");",
    "CREATE INDEX IF NOT EXISTS core_companyoption_company_role_idx ON core_companyoption (company_id, semantic_role);",
]


def repair_options_schema(verbose=False):
    with connection.cursor() as cursor:
        for sql in SQL:
            try:
                cursor.execute(sql)
            except Exception as exc:
                print(f"CompanyOption DB repair skipped SQL: {exc}")

    try:
        from .models import Company
        from .company_options import seed_company_options
        for company in Company.objects.all().only('id'):
            seed_company_options(company)
    except Exception as exc:
        print(f"CompanyOption default seed skipped: {exc}")

    if verbose:
        print("CompanyOption DB repair finished")
    print('✅ Таблиця core_companyoption ОК')
