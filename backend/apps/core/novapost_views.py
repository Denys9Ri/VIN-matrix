import json
import urllib.request

from django.db import connection, transaction
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .db_repair_novapost import repair_novapost_schema
from .partner_views import get_user_company, repair_legacy_account

NOVA_POST_API_URL = 'https://api.novaposhta.ua/v2.0/json/'


def mask_key(value):
    value = str(value or '').strip()
    if not value:
        return ''
    if len(value) <= 8:
        return '••••'
    return f'{value[:4]}••••{value[-4:]}'


def profile_payload(row, include_secret=False):
    data = {
        'id': row