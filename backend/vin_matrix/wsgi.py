import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings')

# Це стандартний запуск сервера
application = get_wsgi_application()

# --- НАШ ХАКЕРСЬКИЙ БЛОК АВТОМІГРАЦІЙ ---
from django.core.management import call_command
try:
    print("Починаємо магію: автоматичне оновлення бази...")
    call_command('makemigrations')
    call_command('migrate')
    print("База даних успішно оновлена!")
except Exception as e:
    print(f"Помилка при оновленні бази: {e}")
# ----------------------------------------
