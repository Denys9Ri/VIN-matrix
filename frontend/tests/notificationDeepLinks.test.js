import assert from 'node:assert/strict';
import test from 'node:test';

import { notificationActionUrl } from '../src/utils/notificationDeepLinks.js';

test('overdue visit opens the exact visit on the board', () => {
  assert.equal(
    notificationActionUrl({ key: 'overdue_orders' }, { id: 32, visit_id: 32 }),
    '/visits?visit_id=32&open=board',
  );
});

test('delivery notifications use visit_id instead of delivery row id', () => {
  assert.equal(
    notificationActionUrl({ key: 'np_returns' }, { id: 901, visit_id: 32 }),
    '/visits?visit_id=32&tab=delivery&open=board',
  );
});

test('parts delay opens the exact visit and parts context', () => {
  assert.equal(
    notificationActionUrl({ key: 'parts_in_transit' }, { id: 41, visit_id: 41 }),
    '/visits?visit_id=41&tab=parts&open=board',
  );
});

test('debt and payment notifications keep the exact visit problem', () => {
  assert.equal(
    notificationActionUrl({ key: 'debts' }, { id: 55, visit_id: 55 }),
    '/attention?visit_id=55&type=debt',
  );
  assert.equal(
    notificationActionUrl({ key: 'payment_due' }, { id: 55, visit_id: 55 }),
    '/attention?visit_id=55&type=payment',
  );
});

test('CRM notifications carry a client search into the CRM page', () => {
  assert.equal(
    notificationActionUrl(
      { key: 'service_reminders', url: '/crm/follow-ups' },
      { id: 7, meta: 'AA1234BB', url: '/crm/follow-ups' },
    ),
    '/crm/follow-ups?search=AA1234BB&autopen=1',
  );
});
