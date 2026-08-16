import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { searchServiceCatalog } from '../src/utils/serviceCatalogSearch.js';

const services = [
  { id: 1, name: 'Шиномонтаж' },
  { id: 2, name: 'Заміна мастила' },
  { id: 3, name: 'Заміна гальмівних колодок' },
  { id: 4, name: 'ТО' },
  { id: 5, name: 'Компʼютерна діагностика' },
];

test('service search finds exact names, words and partial words', () => {
  assert.equal(searchServiceCatalog(services, 'ТО')[0].name, 'ТО');
  assert.deepEqual(searchServiceCatalog(services, 'мастило').map((service) => service.id), [2]);
  assert.deepEqual(searchServiceCatalog(services, 'колодки').map((service) => service.id), [3]);
});

test('service search supports initials and ignores letter case', () => {
  assert.deepEqual(searchServiceCatalog(services, 'ЗМ').map((service) => service.id), [2]);
  assert.deepEqual(searchServiceCatalog(services, 'ДІАГ').map((service) => service.id), [5]);
});

test('empty service search keeps the complete catalog', () => {
  assert.deepEqual(searchServiceCatalog(services, ''), services);
});

test('visits service form renders one searchable catalog combobox', async () => {
  const source = await readFile(new URL('../src/pages/Visits.jsx', import.meta.url), 'utf8');

  assert.match(source, /Знайти або вибрати роботу/);
  assert.match(source, /searchServiceCatalog\(catalogServices, serviceSearch\)/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-expanded=\{isServiceCatalogOpen\}/);
  assert.match(source, /aria-label="Відкрити список робіт"/);
  assert.match(source, /Ввести вручну/);
  assert.doesNotMatch(source, /id="service-catalog-select"/);
  assert.doesNotMatch(source, /Усі роботи з довідника/);
});
