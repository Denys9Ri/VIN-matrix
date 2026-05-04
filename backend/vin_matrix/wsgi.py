"""
WSGI config for vin_matrix project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vin_matrix.settings')

application = get_wsgi_application()
