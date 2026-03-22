import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (two levels up from core/)
load_dotenv(Path(__file__).resolve().parent.parent.parent / '.env')

BASE_DIR = Path(__file__).resolve().parent.parent

_secret_key = os.environ.get('DJANGO_SECRET_KEY', '')
if not _secret_key:
    if os.environ.get('DJANGO_DEBUG', 'False') != 'True':
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured('DJANGO_SECRET_KEY environment variable must be set in production.')
    _secret_key = 'insecure-dev-only-key-do-not-use-in-production'
SECRET_KEY = _secret_key

DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = False  # Railway handles HTTPS at load balancer
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = (
    [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()]
    if _allowed_hosts_env
    else ['localhost', '127.0.0.1', '0.0.0.0']
)

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'corsheaders',
    'apps.users',
    'apps.expenses',
    'apps.journal',
    'apps.budgets',
    'apps.analysis',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'apps.users.middleware.SupabaseAuthMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': ['django.template.context_processors.request']},
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database — Supabase Postgres
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'OPTIONS': {'options': '-c search_path=public', 'sslmode': 'require'},
    }
}

# Parse DATABASE_URL
_db_url = os.environ.get('DATABASE_URL', '')
if _db_url:
    import urllib.parse
    _parsed = urllib.parse.urlparse(_db_url)
    DATABASES['default'].update({
        'NAME': _parsed.path.lstrip('/'),
        'USER': _parsed.username,
        'PASSWORD': _parsed.password,
        'HOST': _parsed.hostname,
        'PORT': _parsed.port or 5432,
    })

# Supabase Auth
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
CORS_ALLOW_CREDENTIALS = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
    'UNAUTHENTICATED_USER': None,
}

# Cache — used for rate limiting LLM endpoints.
# WARNING: LocMemCache is per-process. Rate limiting only works correctly with
# --workers 1 (use --threads N for concurrency instead). For multi-worker or
# multi-dyno deployments, switch to a Redis cache backend.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'finpulse-ratelimit',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Anthropic LLM
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')

# Logging — WARNING level in production, DEBUG level in development
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING' if not DEBUG else 'INFO',
            'propagate': False,
        },
    },
}
