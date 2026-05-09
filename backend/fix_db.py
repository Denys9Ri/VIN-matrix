import os
import django

# Налаштовуємо доступ до Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vin_matrix.settings")
django.setup()

from django.db import connection

# Наші SQL-команди для додавання колонок
queries = [
    "ALTER TABLE core_company ADD COLUMN IF NOT EXISTS logo varchar(100);",
    "ALTER TABLE core_company ADD COLUMN IF NOT EXISTS phone varchar(50);",
    "ALTER TABLE core_company ADD COLUMN IF NOT EXISTS address varchar(255);",
    "ALTER TABLE core_company ADD COLUMN IF NOT EXISTS document_footer text;"
]

# Виконуємо їх напряму в PostgreSQL
print("Починаємо оновлення бази даних...")
with connection.cursor() as cursor:
    for q in queries:
        try:
            cursor.execute(q)
            print(f"Успішно виконано: {q}")
        except Exception as e:
            print(f"Пропущено: {e}")
            
print("База даних готова до роботи!")
