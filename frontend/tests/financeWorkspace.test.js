import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebarSource = await readFile(new URL('../src/components/layout/Sidebar.jsx', import.meta.url), 'utf8');
const analyticsWorkspaceSource = await readFile(new URL('../src/pages/AnalyticsWorkspace.jsx', import.meta.url), 'utf8');
const financeSource = await readFile(new URL('../src/pages/Finance.jsx', import.meta.url), 'utf8');

test('finance is a separate protected workspace next to analytics', () => {
  assert.match(appSource, /import\('\.\/pages\/Finance'\)/);
  assert.match(appSource, /path="finance" element={<Finance \/>}/);
  assert.match(sidebarSource, /name: 'Фінанси'.*path: '\/finance'/s);
  assert.match(analyticsWorkspaceSource, /<FinanceWorkspaceNav showExpenses \/>/);
});

test('analytics keeps its page while expenses are promoted to the second quick section', () => {
  assert.match(analyticsWorkspaceSource, /import Analytics from '\.\/Analytics'/);
  assert.match(analyticsWorkspaceSource, /insertBefore\(expenses, overview\.nextElementSibling\)/);
});

test('finance supports multi-entity allocations, corrections and accountant exports', () => {
  assert.match(financeSource, /\/api\/finance\/legal-entities\//);
  assert.match(financeSource, /parts_legal_entity_id/);
  assert.match(financeSource, /services_legal_entity_id/);
  assert.match(financeSource, /\/api\/finance\/source-allocation\//);
  assert.match(financeSource, /Причина коригування/);
  assert.match(financeSource, /\/api\/finance\/export\//);
  assert.match(financeSource, /виплата зарплати/i);
  assert.match(financeSource, /постачальник|supplier/i);
});