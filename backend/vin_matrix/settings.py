import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Runtime secrets are loaded only from the deployment environment / secret store.
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


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


# Core security
SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = env_bool('DEBUG', False)
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'dev-only-insecure-secret-key-change-me'
    else:
        raise RuntimeError('SECRET_KEY must be set when DEBUG=False')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1')
APP_VERSION = os.getenv('APP_VERSION', 'unknown')
ENABLE_API_DOCS = env_bool('ENABLE_API_DOCS', DEBUG)
# This list is only a one-time deployment bootstrap. Runtime authorization uses
# is_staff/is_superuser stored in Django's database, never a source-code username.
PLATFORM_ADMIN_BOOTSTRAP_USERNAMES = env_list('PLATFORM_ADMIN_BOOTSTRAP_USERNAMES')

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'apps.core.apps.CoreConfig',
    'apps.integrations.apps.IntegrationsConfig',
    'apps.crm.apps.CrmConfig',
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

# Security-sensitive endpoints are overridden by secure_urls before legacy routes.
ROOT_URLCONF = 'vin_matrix.secure_urls'
WSGI_APPLICATION = 'vin_matrix.wsgi.application'

# CORS / CSRF. Production values must list only real HTTPS origins.
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGIN_REGEXES = env_list('CORS_ALLOWED_ORIGIN_REGEXES')
CORS_ALLOW_HEADERS = [
    'accept', 'authorization', 'content-type', 'user-agent', 'x-csrftoken',
    'x-requested-with', 'x-request-id',
]
CORS_EXPOSE_HEADERS = ['X-Request-ID']
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000')

# Transport and browser hardening. Enable redirect/HSTS only after a real HTTPS domain is live.
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
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
SECURE_HSTS_SECONDS = env_int('SECURE_HSTS_SECONDS', 0) if SECURE_SSL_REDIRECT else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', False)

# Shared Redis cache makes throttling work across all Gunicorn workers and restarts.
REDIS_URL = str(os.getenv('REDIS_URL', '')).strip()
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 300,
            'OPTIONS': {'socket_connect_timeout': 2, 'socket_timeout': 2},
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'vin-matrix-local-cache',
            'TIMEOUT': 300,
        }
    }

# Database
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

# API security and rate limiting.
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'apps.core.security_throttles.ApiAnonThrottle',
        'apps.core.security_throttles.ApiUserThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'api_anon': os.getenv('THROTTLE_API_ANON', '60/min'),
        'api_user': os.getenv('THROTTLE_API_USER', '600/min'),
        'login_ip': os.getenv('THROTTLE_LOGIN_IP', '10/min'),
        'login_username': os.getenv('THROTTLE_LOGIN_USERNAME', '5/min'),
        'token_refresh_ip': os.getenv('THROTTLE_TOKEN_REFRESH_IP', '30/min'),
        'registration_ip': os.getenv('THROTTLE_REGISTRATION_IP', '5/hour'),
    },
    'EXCEPTION_HANDLER': 'apps.core.api_errors.vin_matrix_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_context': {'()': 'apps.core.request_context.RequestContextFilter'},
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
        'vin_matrix': {'handlers': ['console'], 'level': os.getenv('LOG_LEVEL', 'INFO'), 'propagate': False},
        'django.request': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
TIME_ZONE = 'Europe/Kyiv'
USE_TZ = True
LANGUAGE_CODE = 'uk'
USE_I18N = True
LANGUAGES = [('uk', 'Українська')]

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
