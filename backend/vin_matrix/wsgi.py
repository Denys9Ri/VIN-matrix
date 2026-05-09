import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings')

application = get_wsgi_application()

from django.core.management import call_command
from django.contrib.auth.models import User

try:
    print("--- ПЕРЕВІРКА АДМІНІСТРАТОРА ---")
    call_command('makemigrations', 'core') 
    call_command('migrate')
    
    # ПРЯМО ТУТ: Заміни 'твій_логін' на справжній
    user_login = 'Denys9Ri' # АБО ЯКИЙ У ТЕБЕ ТАМ
    
    u = User.objects.filter(username=user_login).first()
    if u:
        u.is_superuser = True
        u.is_staff = True
        u.save()
        print(f"СТАТУС: {user_login} підтверджений як Адмін!")
    else:
        print(f"СТАТУС: Користувача {user_login} не знайдено!")
except Exception as e:
    print(f"ПОМИЛКА В WSGI: {e}")
