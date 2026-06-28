from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from apps.core.models import Company

from .parts_agent import search_analogs, search_original, search_selected_analog
from .services import get_company_settings


class AgentPartsFlowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='parts-owner', password='test-pass')
        self.company = Company.objects.create(name='Parts STO', owner=self.owner)
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.save()

    @patch('apps.agent.parts_agent._search')
    def test_original_search_keeps_only_exact_article(self, mocked_search):
        mocked_search.return_value = [
            {'article': '8K0-407-151-C', 'brand': 'VAG', 'source': 'A', 'buy_price': 100},
            {'article': '8K0407151', 'brand': 'VAG', 'source': 'B', 'buy_price': 90},
            {'article': 'OTHER', 'brand': 'VAG', 'source': 'C', 'buy_price': 80},
        ]

        offers = search_original(self.owner, '8K0 407 151 C')

        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0]['article'], '8K0-407-151-C')

    @patch('apps.agent.parts_agent._search')
    def test_analog_flow_excludes_original_and_rechecks_brand(self, mocked_search):
        original = {
            'article': '8K0407151C',
            'brand': 'VAG',
            'supplier_id': 5,
            'sku': 'original-sku',
        }
        mocked_search.return_value = [
            {'article': '8K0407151C', 'brand': 'VAG', 'source': 'A', 'buy_price': 100},
            {'article': 'FEBI123', 'brand': 'FEBI', 'source': 'A', 'buy_price': 70},
            {'article': 'FEBI123', 'brand': 'FEBI', 'source': 'B', 'buy_price': 65},
        ]

        analogs = search_analogs(self.owner, original)

        self.assertEqual(len(analogs), 1)
        self.assertEqual(analogs[0]['brand'], 'FEBI')
        self.assertEqual(analogs[0]['article'], 'FEBI123')

        mocked_search.return_value = [
            {'article': 'FEBI123', 'brand': 'FEBI', 'source': 'A', 'buy_price': 70},
            {'article': 'FEBI123', 'brand': 'OTHER', 'source': 'B', 'buy_price': 50},
            {'article': 'FEBI124', 'brand': 'FEBI', 'source': 'C', 'buy_price': 60},
        ]
        selected = search_selected_analog(self.owner, 'FEBI123', 'FEBI')

        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]['source'], 'A')
