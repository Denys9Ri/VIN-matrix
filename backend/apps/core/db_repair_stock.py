from django.db import connection


SQL = [
    "ALTER TABLE core_inventoryitem ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;",
    "ALTER TABLE core_inventoryitem ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 0;",
    "UPDATE core_inventoryitem SET reserved_quantity = 0 WHERE reserved_quantity IS NULL;",
    "UPDATE core_inventoryitem SET min_quantity = 0 WHERE min_quantity IS NULL;",
    "ALTER TABLE core_orderpart ADD COLUMN IF NOT EXISTS inventory_item_id bigint NULL REFERENCES core_inventoryitem(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;",
    "ALTER TABLE core_orderpart ADD COLUMN IF NOT EXISTS stock_status varchar(20) NOT NULL DEFAULT 'none';",
    "UPDATE core_orderpart SET stock_status = 'none' WHERE stock_status IS NULL;",
    "CREATE INDEX IF NOT EXISTS core_orderpart_inventory_item_idx ON core_orderpart (inventory_item_id);",
    "CREATE INDEX IF NOT EXISTS core_orderpart_stock_status_idx ON core_orderpart (stock_status);",
    "CREATE INDEX IF NOT EXISTS core_stockm_company_type_idx ON core_stockmovement (company_id, movement_type);",
]


def repair_stock_schema(verbose=False):
    with connection.cursor() as cursor:
        for sql in SQL:
            try:
                cursor.execute(sql)
            except Exception as exc:
                print(f"Stock DB repair skipped SQL: {exc}")
    if verbose:
        print("Stock DB repair finished")
