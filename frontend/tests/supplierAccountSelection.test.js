import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const searchSource = await readFile(new URL('../src/pages/UniversalSearch.jsx', import.meta.url), 'utf8');
const visitsSource = await readFile(new URL('../src/pages/Visits.jsx', import.meta.url), 'utf8');

test('add-to-visit modal always loads accounts for the selected supplier', () => {
  assert.match(searchSource, /\/api\/supplier-accounts\/\?supplier=/);
  assert.match(searchSource, /Акаунт постачальника/);
  assert.match(searchSource, /accounts\.some\(account => String\(account\.id\) === String\(current\.supplier_account\)\)/);
  assert.match(searchSource, /supplier_account: selectedPart\.is_local \? null/);
});

test('visit parts keep the account selector for later corrections', () => {
  assert.match(visitsSource, /supplier_account_options/);
  assert.match(visitsSource, /onUpdatePartAccount/);
  assert.match(visitsSource, /Акаунт не вказано/);
});

test('client service and visit history show supplier and full account name', async () => {
  const clientsSource = await readFile(new URL('../src/pages/ClientsCRMStage5.jsx', import.meta.url), 'utf8');

  assert.match(clientsSource, /function PartSourceBadges/);
  assert.match(clientsSource, /part\.supplier_account_name/);
  assert.match(clientsSource, /Акаунт: \{part\.supplier_account_name\}/);
  assert.match(clientsSource, /<PartSourceBadges part=\{item\.part\}/);
  assert.match(clientsSource, /<PartSourceBadges part=\{part\}/);
});
