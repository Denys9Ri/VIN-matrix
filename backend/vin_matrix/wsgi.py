import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings')

application = get_wsgi_application()

# --- НАШ ХАКЕРСЬКИЙ БЛОК АВТОМІГРАЦІЙ ТА АДМІНКИ ---
from django.core.management import call_command
from django.contrib.auth.models import User

try:
    print("Починаємо магію: автоматичне оновлення бази...")
    
    # ПРИМУСОВО кажемо шукати таблиці в додатку core!
    call_command('makemigrations', 'core') 
    call_command('migrate')
    
    print("База даних успішно оновлена! Перевіряємо права адміна...")

    # РОБИМО ТЕБЕ АДМІНОМ
    # ЗАМІНИ 'твій_логін' на свій справжній логін (наприклад 'Denys' чи 'admin')
    user_login = 'Denys9Ri' 
    
    try:
        u = User.objects.get(username=user_login)
        if not u.is_superuser:
            u.is_superuser = True
            u.is_staff = True
            u.save()
            print(f"Успіх: Користувач {user_login} тепер адмін!")
        else:
            print(f"Користувач {user_login} вже має права адміна.")
    except User.DoesNotExist:
        print(f"Попередження: Користувача '{user_login}' не знайдено в базі. Спочатку зареєструйся на сайті!")

except Exception as e:
    print(f"Помилка в хакерському блоці: {e}")
# --------------------------------------------------
