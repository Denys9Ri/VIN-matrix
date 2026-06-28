import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Завантажуємо змінні з .env файлу
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Безпека
def env_bool(name, default=False):
    return str(os.getenv(name, str(default))).strip().lower() in {'1', 'true', 'yes', 'on'}


def env_list(name, default=''):
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


def env_int(name, default=0):
    try:
        return int(str(os.getenv(name, default)).strip())
    except (TypeError, ValueError):
        return default


SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = env_bool('DEBUG', False)
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'dev-only-insecure-secret-key-change-me'
    else:
        raise RuntimeError('SECRET_KEY must be set when DEBUG=False')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1')
APP_VERSION = os.getenv('APP_VERSION', 'unknown')

# Реєструємо сторонні бібліотеки та наші модулі
INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Сторонні
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    # Наші модулі
    'apps.core.apps.CoreConfig',
    'apps.integrations.apps.IntegrationsConfig',
    'apps.crm.apps.CrmConfig',
    'apps.agent.apps.AgentConfig',
]

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    }
]

MIDDLEWARE = [
    # Request id must be outermost so every API failure can be correlated in logs and support.
    'apps.core.request_context.RequestIdMiddleware',
    'apps.core.request_context.ApiExceptionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.core.billing_access_middleware.BillingAccessMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'vin_matrix.urls_agent'
WSGI_APPLICATION = 'vin_matrix.wsgi.application'

# Налаштування CORS для React
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGIN_REGEXES = env_list('CORS_ALLOWED_ORIGIN_REGEXES')
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-request-id',
]
CORS_EXPOSE_HEADERS = ['X-Request-ID']
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000')

# Transport and browser hardening remain opt-in for the current HTTP deployment.
SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', False)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if env_bool('USE_X_FORWARDED_PROTO', False) else None
SESSION_COOKIE_SECURE = SECURE_SSL_REDIRECT
CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'
SECURE_HSTS_SECONDS = env_int('SECURE_HSTS_SECONDS', 0) if SECURE_SSL_REDIRECT else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', False)

# Налаштування Бази Даних
if env_bool('USE_POSTGRES', False):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME'),
            'USER': os.getenv('DB_USER'),
            'PASSWORD': os.getenv('DB_PASSWORD'),
            'HOST': os.getenv('DB_HOST'),
            'PORT': os.getenv('DB_PORT'),
            'CONN_MAX_AGE': env_int('DB_CONN_MAX_AGE', 60),
        }
    }
else:
    DB_FOLDER = BASE_DIR / 'database_data'
    DB_FOLDER.mkdir(exist_ok=True)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': DB_FOLDER / 'db.sqlite3',
        }
    }

# Налаштування JWT та REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'EXCEPTION_HANDLER': 'apps.core.api_errors.vin_matrix_exception_handler',
}

# Налаштування часу життя токенів
# Важливо: refresh-токени не ротуються і не blacklist-яться після оновлення.
# Це дозволяє одному акаунту стабільно працювати одночасно на телефоні, комп'ютері та ще одному пристрої.
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
}

# Structured server-side logs. API keys, passwords and JWT values are never logged by our handlers.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_context': {
            '()': 'apps.core.request_context.RequestContextFilter',
        },
    },
    'formatters': {
        'vin_matrix': {
            'format': '{asctime} {levelname} request_id={request_id} method={method} path={path} status={status_code} duration_ms={duration_ms} user_id={user_id} logger={name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['request_context'],
            'formatter': 'vin_matrix',
        },
    },
    'loggers': {
        'vin_matrix': {
            'handlers': ['console'],
            'level': os.getenv('LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# Статичні файли (CSS, JS)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Медіа файли (Логотипи)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Сучасний часовий пояс для України
TIME_ZONE = 'Europe/Kyiv'
USE_TZ = True

LANGUAGE_CODE = 'uk'
USE_I18N = True

LANGUAGES = [
    ('uk', 'Українська'),
]

JAZZMIN_SETTINGS = {
    'site_title': 'VIN-Matrix Admin',
    'site_header': 'VIN-Matrix',
    'show_ui_builder': False,
    'hide_models': [
        'auth.Group',
        'token_blacklist.OutstandingToken',
        'token_blacklist.BlacklistedToken',
        'sessions.Session',
    ],
    'order_with_respect_to': ['crm', 'core'],
}
