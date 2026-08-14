import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const activeClientsSource = await readFile(new URL('../src/pages/ClientsCRMStage5.jsx', import.meta.url), 'utf8');

test('the clients route uses the CRM component with the debt payment flow', () => {
  assert.match(appSource, /import\('\.\/pages\/ClientsCRMStage5'\)/);
  assert.match(activeClientsSource, /closeClientDebt\(api, client,/);
  assert.match(activeClientsSource, /<DebtPaymentModal/);
  assert.match(activeClientsSource, /\/api\/settings\/dictionaries\/\?mode=both/);
  assert.doesNotMatch(activeClientsSource, /api\.patch\(`\/api\/visits\//);
});
