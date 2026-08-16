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
