"""
ASGI config for vin_matrix project.

It exposes the ASGI callable as a module-level variable named ``application``.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings_growth')

application = get_asgi_application()
