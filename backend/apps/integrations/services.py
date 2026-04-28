import pandas as pd
import math

def parse_supplier_excel(file_path, column_mapping, exchange_rate=1.0):
    """
    Універсальний парсер прайс-листів.
    file_path: шлях до файлу Excel.
    column_mapping: словник, наприклад {"part_number": "Код товару", "price": "Ціна", "brand": "Бренд", "name": "Назва"}
    exchange_rate: курс валют (за замовчуванням 1.0, якщо прайс у гривні)
    """
    try:
        # Читаємо Excel файл
        df = pd.read_excel(file_path, engine='openpyxl')
        
        # Перевертаємо словник для pandas: {"Код товару": "part_number", "Ціна": "price"}
        rename_dict = {excel_col: db_col for db_col, excel_col in column_mapping.items() if excel_col in df.columns}
        
        # Перейменовуємо стовпці у наш стандартний вигляд
        df = df.rename(columns=rename_dict)
        
        # Залишаємо тільки ті стовпці, які нам потрібні (щоб не тримати сміття в пам'яті)
        standard_columns = list(rename_dict.values())
        df = df[standard_columns]
        
        # Очищення даних: видаляємо рядки, де немає ціни або артикулу
        if 'part_number' in df.columns and 'price' in df.columns:
            df = df.dropna(subset=['part_number', 'price'])
        
        # Перетворюємо всі артикули в текст (щоб уникнути помилок типу 1234.0)
        if 'part_number' in df.columns:
            df['part_number'] = df['part_number'].astype(str).str.strip()
            
        # Приводимо ціну до числа і множимо на курс валют
        if 'price' in df.columns:
            df['price'] = pd.to_numeric(df['price'], errors='coerce') * float(exchange_rate)
            # Округляємо до 2 знаків після коми
            df['price'] = df['price'].round(2)
            
        # Конвертуємо таблицю у список словників для зручної роботи в Python
        # [{ "part_number": "05P634", "price": 1250.50, ... }, { ... }]
        records = df.to_dict(orient='records')
        
        return {
            "status": "success",
            "total_items": len(records),
            "data": records
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
