import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeOrderPartQuantity,
  orderPartLineTotal,
  supplierPartDefaultQuantity,
} from '../src/utils/orderPartQuantity.js';

test('supplier minimum quantity becomes the default order quantity', () => {
  assert.equal(supplierPartDefaultQuantity({ min_qty: 2 }), 2);
  assert.equal(supplierPartDefaultQuantity({ min_qty: '4' }), 4);
  assert.equal(supplierPartDefaultQuantity({}), 1);
});

test('part line total multiplies the unit price by quantity', () => {
  assert.equal(orderPartLineTotal(150, 2), 300);
  assert.equal(orderPartLineTotal('125.50', '4'), 502);
  assert.equal(normalizeOrderPartQuantity(0), 1);
});

test('supplier search sends the selected quantity to the visit', async () => {
  const source = await readFile(new URL('../src/pages/UniversalSearch.jsx', import.meta.url), 'utf8');

  assert.match(source, /quantity: orderQuantity/);
  assert.match(source, /Кількість/);
  assert.match(source, /Загальна сума продажу/);
});
