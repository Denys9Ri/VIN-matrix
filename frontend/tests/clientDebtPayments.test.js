import assert from 'node:assert/strict';
import test from 'node:test';

import { closeClientDebt, debtOrdersOf } from '../src/utils/clientDebtPayments.js';

test('compact client is expanded before its debt is closed through mark-paid', async () => {
  const calls = [];
  const api = {
    get: async (url) => {
      calls.push(['get', url]);
      return {
        data: {
          key: '380501112233',
          orders: [
            { id: 41, debt_amount: 750, paid_amount: 250, payment_status: 'prepaid' },
          ],
        },
      };
    },
    post: async (url, payload) => {
      calls.push(['post', url, payload]);
      return { data: { finance: { debt_amount: 0 } } };
    },
  };

  const result = await closeClientDebt(api, { key: '380501112233', debt_amount: 750 });

  assert.equal(result.closed, 1);
  assert.equal(result.clientKey, '380501112233');
  assert.deepEqual(calls, [
    ['get', '/api/store-clients/detail/?key=380501112233'],
    ['post', '/api/visits/41/mark-paid/', {
      payment_type: 'cash',
      comment: 'Закриття боргу з картки клієнта',
    }],
  ]);
});

test('detailed client closes every debt without reloading its detail first', async () => {
  const posts = [];
  const api = {
    get: async () => { throw new Error('detail request is not expected'); },
    post: async (url, payload) => {
      posts.push([url, payload]);
      return { data: {} };
    },
  };
  const client = {
    key: 'client-2',
    orders: [
      { id: 51, debt_amount: 400, payment_status: 'debt' },
      { id: 52, debt_amount: 200, payment_status: 'unpaid' },
      { id: 53, debt_amount: 0, payment_status: 'paid' },
    ],
  };

  const result = await closeClientDebt(api, client);

  assert.equal(result.closed, 2);
  assert.deepEqual(posts.map(([url]) => url).sort(), [
    '/api/visits/51/mark-paid/',
    '/api/visits/52/mark-paid/',
  ]);
  assert.equal(debtOrdersOf(client).length, 2);
});

test('single debt row uses selected client key for the refresh', async () => {
  const api = {
    post: async () => ({ data: {} }),
  };

  const result = await closeClientDebt(
    api,
    { orders: [{ id: 61, debt_amount: 100, payment_status: 'prepaid' }] },
    { fallbackClientKey: 'selected-client' },
  );

  assert.equal(result.closed, 1);
  assert.equal(result.clientKey, 'selected-client');
});
