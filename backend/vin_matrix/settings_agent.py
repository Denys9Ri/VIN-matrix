"""Agent-enabled settings layer.

Keeps the existing production settings intact and only registers the isolated
VIN-matrix Agent application. Deployment can still override DJANGO_SETTINGS_MODULE.
"""

from .settings import *  # noqa: F401,F403

if 'apps.agent.apps.AgentConfig' not in INSTALLED_APPS:
    INSTALLED_APPS.append('apps.agent.apps.AgentConfig')
