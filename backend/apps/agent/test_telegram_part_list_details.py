from types import SimpleNamespace

from django.test import SimpleTestCase

from .telegram_part_list_details import enrich_part_offer_list, format_offer_list_details


class TelegramPartListDetailsTests(SimpleTestCase):
    def setUp(self):
        self.offer = {
            'brand': 'BOSCH',
            'article': '0986494036',
            'buy_price': '1000',
            'source': 'Автодеталь',
            'quantity': '4',
            'warehouses': [
                {'name': 'Київ, склад 1'},
                {'warehouse': 'Львів, склад 2'},
            ],
        }

    def test_format_lists_supplier_warehouse_and_stock(self):
        text = format_offer_list_details([self.offer])

        self.assertIn('1. BOSCH 0986494036 — 1000.00 грн', text)
        self.assertIn('Постачальник: Автодеталь', text)
        self.assertIn('Склад: Київ, склад 1, Львів, склад 2', text)
        self.assertIn('Наявність: 4', text)

    def test_enriches_original_offer_reply_only_while_list_is_open(self):
        conversation = SimpleNamespace(context={
            'flow': 'part_original_results',
            'part': {'original_offers': [self.offer]},
        })
        result = {'text': 'Знайдено 1 пропозицій. Оберіть потрібну:'}

        enriched = enrich_part_offer_list(result, conversation)

        self.assertIn('Постачальник: Автодеталь', enriched['text'])
        self.assertIn('Склад: Київ, склад 1', enriched['text'])

    def test_does_not_change_non_list_reply(self):
        conversation = SimpleNamespace(context={
            'flow': 'part_selected_offer',
            'part': {'selected_offer': self.offer},
        })
        result = {'text': 'Обрана пропозиція'}

        self.assertEqual(enrich_part_offer_list(result, conversation), result)
