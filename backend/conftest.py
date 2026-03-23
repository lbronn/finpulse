import django
from django.conf import settings


def pytest_configure():
    settings.configure(
        DATABASES={
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': ':memory:',
            }
        },
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
        ],
        AI_MONTHLY_ANALYSIS_LIMIT=10,
        AI_MONTHLY_RECOMMENDATION_LIMIT=10,
        AI_MONTHLY_CHAT_LIMIT=50,
        AI_MONTHLY_DIGEST_LIMIT=4,
    )
