"""VIN-matrix settings with the Landing Growth Engine enabled.

The base project settings stay untouched. This module only extends them with the
isolated growth app and its environment-driven integrations.
"""

import os

from .settings import *  # noqa: F401,F403


if 'apps.landing_growth.apps.LandingGrowthConfig' not in INSTALLED_APPS:  # noqa: F405
    INSTALLED_APPS = [*INSTALLED_APPS, 'apps.landing_growth.apps.LandingGrowthConfig']  # noqa: F405

GOOGLE_SEARCH_CONSOLE_SITE_URL = os.getenv('GOOGLE_SEARCH_CONSOLE_SITE_URL', '')
GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '')
GOOGLE_OAUTH_REFRESH_TOKEN = os.getenv('GOOGLE_OAUTH_REFRESH_TOKEN', '')
GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')
GA4_PROPERTY_ID = os.getenv('GA4_PROPERTY_ID', '')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-5-nano')
OPENAI_TIMEOUT_SECONDS = env_int('OPENAI_TIMEOUT_SECONDS', 60)  # noqa: F405
OPENAI_MAX_OUTPUT_TOKENS = env_int('OPENAI_MAX_OUTPUT_TOKENS', 600)  # noqa: F405

LANDING_GROWTH_SIGNING_KEY = os.getenv('LANDING_GROWTH_SIGNING_KEY', SECRET_KEY)  # noqa: F405
LANDING_GROWTH_CANONICAL_URL = os.getenv('LANDING_GROWTH_CANONICAL_URL', 'https://vin-matrix.com/')
DEPLOY_TRIGGER_URL = os.getenv('DEPLOY_TRIGGER_URL', '')
LANDING_GROWTH_DEPLOY_TOKEN = os.getenv('LANDING_GROWTH_DEPLOY_TOKEN', '')
LANDING_GROWTH_DEPLOY_METHOD = os.getenv('LANDING_GROWTH_DEPLOY_METHOD', 'AUTO').upper()
LANDING_GROWTH_LOCK_MINUTES = env_int('LANDING_GROWTH_LOCK_MINUTES', 90)  # noqa: F405
