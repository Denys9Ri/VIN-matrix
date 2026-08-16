import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { searchVehicleFuels, VEHICLE_FUEL_TYPES } from '../src/utils/vehicleFuelCatalog.js';

test('vehicle fuel catalog contains the supported options in display order', () => {
  assert.deepEqual(VEHICLE_FUEL_TYPES, [
    'Бензин',
    'Газ/Бензин',
    'Дизель',
    'Електро',
    'Гібрид',
  ]);
});

test('vehicle fuel search finds values from the first typed letters or words', () => {
  assert.equal(searchVehicleFuels(VEHICLE_FUEL_TYPES, 'бен')[0], 'Бензин');
  assert.equal(searchVehicleFuels(VEHICLE_FUEL_TYPES, 'газ')[0], 'Газ/Бензин');
  assert.equal(searchVehicleFuels(VEHICLE_FUEL_TYPES, 'елек')[0], 'Електро');
  assert.equal(searchVehicleFuels(VEHICLE_FUEL_TYPES, 'гіб')[0], 'Гібрид');
});

test('vehicle fuel combobox supports typing, full list and manual values', async () => {
  const component = await readFile(new URL('../src/components/visits/VehicleFuelCombobox.jsx', import.meta.url), 'utf8');
  const visits = await readFile(new URL('../src/pages/Visits.jsx', import.meta.url), 'utf8');

  assert.match(component, /role="combobox"/);
  assert.match(component, /Написати або вибрати паливо/);
  assert.match(component, /Відкрити список типів палива/);
  assert.match(component, /Введене значення можна зберегти вручну/);
  assert.equal((visits.match(/<VehicleFuelCombobox/g) || []).length, 2);
  assert.equal((visits.match(/label="Паливо"/g) || []).length, 0);
});
