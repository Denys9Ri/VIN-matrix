from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Company, OrderPart, Visit, WorkPost

from .models import AgentPendingAction, AgentUserChannel
from .services import get_company_settings
from .telegram import BUTTON_FREE_SLOTS
from .telegram_parts_webhook import BUTTON_PARTS, PARTS_MAIN_REPLY_MARKUP, process_agent_update


class TelegramPartsWorkflowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='parts-owner', password='test-pass')
        self.company = Company.objects.create(name='Parts Telegram STO', owner=self.owner)
        settings = get_company_settings(self.company)
        settings.is_enabled = True
        settings.telegram_enabled = True
        settings.save()
        self.visit = Visit.objects.create(
            company=self.company,
            plate='AA1234AA',
            client='Іван Петренко',
            phone='0501234567',
            scheduled_datetime=timezone.now() + timedelta(days=1),
        )
        self.channel = AgentUserChannel.objects.create(
            company=self.company,
            user=self.owner,
            channel_type=AgentUserChannel.CHANNEL_TELEGRAM,
            external_user_id='8001',
            chat_id='9001',
            display_name='Тестовий власник',
        )
        self.offer = {
            'id': 'supplier-offer-1',
            'supplier_id': 1,
            'source': 'Постачальник 1',
            'brand': 'BOSCH',
            'article': '0986494036',
            'name': 'Гальмівні колодки',
            'buy_price': '1000.00',
            'quantity': '4',
            'warehouses': [],
            'sku': 'supplier-sku-1',
            'min_qty': 1,
        }

    def _message(self, message_id, text):
        return process_agent_update({
            'update_id': message_id,
            'message': {
                'message_id': message_id,
                'text': text,
                'from': {'id': 8001, 'first_name': 'Тест'},
                'chat': {'id': 9001},
            },
        })

    def _callback(self, callback_id, data):
        return process_agent_update({
            'update_id': 10000 + callback_id,
            'callback_query': {
                'id': f'parts-callback-{callback_id}',
                'data': data,
                'from': {'id': 8001, 'first_name': 'Тест'},
                'message': {'message_id': 20000 + callback_id, 'chat': {'id': 9001}},
            },
        })

    @staticmethod
    def _callback_data(response):
        rows = response['inline_markup']['inline_keyboard']
        return [button['callback_data'] for row in rows for button in row]

    def test_parts_reply_keyboard_contains_free_slots_button(self):
        flat = [button for row in PARTS_MAIN_REPLY_MARKUP['keyboard'] for button in row]
        self.assertIn(BUTTON_FREE_SLOTS, flat)
        self.assertIn(BUTTON_PARTS, flat)

    def test_regular_command_uses_parts_keyboard_and_free_slots_button_shows_slots(self):
        WorkPost.objects.create(company=self.company, number=1, name='Пост 1', is_active=True)

        help_response = self._message(101, 'допомога')
        flat = [button for row in help_response['reply_markup']['keyboard'] for button in row]
        self.assertIn(BUTTON_FREE_SLOTS, flat)
        self.assertIn(BUTTON_PARTS, flat)

        free_slots = self._message(102, BUTTON_FREE_SLOTS)
        self.assertIn('Оберіть дату', free_slots['text'])
        flat = [button for row in free_slots['reply_markup']['keyboard'] for button in row]
        self.assertIn(BUTTON_FREE_SLOTS, flat)
        self.assertIn(BUTTON_PARTS, flat)

        today_callback = free_slots['inline_markup']['inline_keyboard'][0][0]['callback_data']
        slots = self._callback(101, today_callback)
        self.assertIn('Вільні вікна', slots['text'])
        self.assertIn('inline_keyboard', slots['inline_markup'])

    @patch('apps.agent.telegram_part_actions.search_original')
    def test_search_offer_visit_quantity_creates_part_draft_only(self, search_original):
        search_original.return_value = [self.offer]

        started = self._message(1, BUTTON_PARTS)
        self.assertIn('Введіть точний артикул', started['text'])

        found = self._message(2, '0986494036')
        self.assertIn('Знайдено 1 пропозицій', found['text'])
        self.assertIn('p:original:0', self._callback_data(found))

        selected = self._callback(1, 'p:original:0')
        self.assertIn('BOSCH 0986494036', selected['text'])
        self.assertIn('p:add', self._callback_data(selected))
        self.assertIn('p:back:original', self._callback_data(selected))

        adding = self._callback(2, 'p:add')
        self.assertIn('До якого запису', adding['text'])

        visits = self._message(3, 'AA1234AA')
        self.assertIn(f'p:visit:{self.visit.id}', self._callback_data(visits))

        quantity = self._callback(3, f'p:visit:{self.visit.id}')
        self.assertIn('Оберіть кількість', quantity['text'])
        self.assertIn('p:qty:2', self._callback_data(quantity))

        drafted = self._callback(4, 'p:qty:2')
        self.assertIn('✅ Запчастину додано', drafted['text'])

        action = AgentPendingAction.objects.get(company=self.company, action_type='add_order_part')
        self.assertEqual(action.status, AgentPendingAction.STATUS_EXECUTED)
        self.assertEqual(action.payload['visit_id'], self.visit.id)
        self.assertEqual(action.payload['part']['article'], '0986494036')
        self.assertEqual(action.payload['part']['quantity'], '2.00')
        self.assertEqual(OrderPart.objects.filter(visit=self.visit).count(), 1)

    @patch('apps.agent.telegram_part_actions.search_original')
    def test_back_from_original_offer_restores_saved_list(self, search_original):
        second_offer = {**self.offer, 'id': 'supplier-offer-2', 'source': 'Постачальник 2', 'buy_price': '950.00'}
        search_original.return_value = [self.offer, second_offer]

        self._message(20, BUTTON_PARTS)
        found = self._message(21, '0986494036')
        self.assertIn('p:original:1', self._callback_data(found))

        selected = self._callback(20, 'p:original:1')
        self.assertIn('Постачальник 2', selected['text'])

        restored = self._callback(21, 'p:back:original')
        self.assertIn('Знайдено 2 пропозицій', restored['text'])
        callbacks = self._callback_data(restored)
        self.assertIn('p:original:0', callbacks)
        self.assertIn('p:original:1', callbacks)
        search_original.assert_called_once()

    @patch('apps.agent.telegram_part_actions.search_selected_analog')
    @patch('apps.agent.telegram_part_actions.search_analogs')
    @patch('apps.agent.telegram_part_actions.search_original')
    def test_selected_analog_is_researched_before_offer_selection(
        self,
        search_original,
        search_analogs,
        search_selected_analog,
    ):
        analog = {**self.offer, 'brand': 'TRW', 'article': 'GDB1956', 'sku': 'analog-sku'}
        analog_offer = {**analog, 'source': 'Постачальник 2', 'buy_price': '900.00'}
        search_original.return_value = [self.offer]
        search_analogs.return_value = [analog]
        search_selected_analog.return_value = [analog_offer]

        self._message(10, BUTTON_PARTS)
        self._message(11, '0986494036')
        self._callback(10, 'p:original:0')
        analogs = self._callback(11, 'p:analogs')
        self.assertIn('p:analog:0', self._callback_data(analogs))

        offers = self._callback(12, 'p:analog:0')
        self.assertIn('p:analog_offer:0', self._callback_data(offers))
        self.assertEqual(search_selected_analog.call_args.args[1:], ('GDB1956', 'TRW'))

        selected = self._callback(13, 'p:analog_offer:0')
        callbacks = self._callback_data(selected)
        self.assertIn('p:back:analog_offers', callbacks)
        self.assertIn('p:back:analogs', callbacks)

        restored_offers = self._callback(14, 'p:back:analog_offers')
        self.assertIn('p:analog_offer:0', self._callback_data(restored_offers))

        self._callback(15, 'p:analog_offer:0')
        restored_analogs = self._callback(16, 'p:back:analogs')
        self.assertIn('p:analog:0', self._callback_data(restored_analogs))
