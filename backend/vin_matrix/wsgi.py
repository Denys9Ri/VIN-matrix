import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings')

application = get_wsgi_application()

# --- НАШ ХАКЕРСЬКИЙ БЛОК АВТОМІГРАЦІЙ ---
from django.core.management import call_command
try:
    print("Починаємо магію: автоматичне оновлення бази...")
    
    # ПРИМУСОВО кажемо шукати таблиці в додатку core!
    call_command('makemigrations', 'core') 
    
    call_command('migrate')
    print("База даних успішно оновлена!")
except Exception as e:
    print(f"Помилка при оновленні бази: {e}")
# ----------------------------------------
