import os
from pathlib import Path
from dotenv import load_dotenv

# Завантажуємо змінні з .env файлу
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = os.getenv('DEBUG') == 'True'

ALLOWED_HOSTS = ['*'] # Для Coolify потім налаштуємо конкретні домени

# Реєструємо сторонні бібліотеки та наші модулі
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Сторонні
    'rest_framework',
    'corsheaders',
    
    # Наші модулі (розкоментовано, оскільки ми їх вже використовуємо)
    'apps.core',
    'apps.integrations',
    'apps.crm',
    # 'apps.analytics', # Залишив закоментованим, поки не створимо цей додаток
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware', # Важливо для роботи з React (має бути тут)
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Дозволяємо React-фронтенду робити запити до нашого API
CORS_ALLOW_ALL_ORIGINS = True 

# Налаштування Бази Даних (SQLite для локального тесту, Postgres для Coolify)
if os.getenv('USE_POSTGRES') == 'True':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST'),
            'PORT': os.getenv('DB_PORT'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
