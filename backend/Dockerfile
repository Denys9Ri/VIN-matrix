# Використовуємо офіційний легкий образ Python
FROM python:3.12-slim

# Встановлюємо системні залежності, необхідні для роботи з базою даних (Postgres)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Робоча папка на сервері
WORKDIR /app

# Копіюємо список залежностей і встановлюємо їх
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо весь інший код
COPY . .

# Відкриваємо порт 8000
EXPOSE 8000

# Команда для старту
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
