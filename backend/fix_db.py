import sqlite3
import os

# Шлях до файлу бази даних
db_path = 'db.sqlite3'

print("Починаємо перевірку та оновлення бази даних...")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # SQL-запити для примусового додавання нових колонок
    queries = [
        "ALTER TABLE core_visit ADD COLUMN updated_at datetime NULL;",
        "ALTER TABLE core_visit ADD COLUMN scheduled_datetime datetime NULL;",
        "ALTER TABLE core_orderpart ADD COLUMN status varchar(20) NOT NULL DEFAULT 'WAITING';",
        "ALTER TABLE core_orderservice ADD COLUMN status varchar(20) NOT NULL DEFAULT 'PENDING';"
    ]
    
    for q in queries:
        try:
            cursor.execute(q)
            print(f"Виконано: {q}")
        except Exception as e:
            # Якщо колонка вже існує, база видасть помилку, ми її просто ігноруємо
            pass
            
    conn.commit()
    conn.close()
    print("Оновлення бази даних успішно завершено!")
else:
    print("Файл db.sqlite3 не знайдено. Перевірте шлях.")
