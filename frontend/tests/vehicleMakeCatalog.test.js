import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { searchVehicleMakes, VEHICLE_MAKES } from '../src/utils/vehicleMakeCatalog.js';

test('vehicle make catalog contains a broad unique global list', () => {
  assert.ok(VEHICLE_MAKES.length >= 180);
  assert.equal(new Set(VEHICLE_MAKES).size, VEHICLE_MAKES.length);
  for (const make of ['Audi', 'BMW', 'Mercedes-Benz', 'Toyota', 'Volkswagen', 'Škoda', 'ZAZ']) {
    assert.ok(VEHICLE_MAKES.includes(make), `${make} is missing`);
  }
});

test('vehicle make search prioritizes names that start with typed letters', () => {
  assert.equal(searchVehicleMakes(VEHICLE_MAKES, 'Au')[0], 'Audi');
  assert.equal(searchVehicleMakes(VEHICLE_MAKES, 'merc')[0], 'Mercedes-Benz');
  assert.equal(searchVehicleMakes(VEHICLE_MAKES, 'sk')[0], 'Škoda');
});

test('vehicle make combobox supports typing, full list and manual values', async () => {
  const component = await readFile(new URL('../src/components/visits/VehicleMakeCombobox.jsx', import.meta.url), 'utf8');
  const visits = await readFile(new URL('../src/pages/Visits.jsx', import.meta.url), 'utf8');

  assert.match(component, /role="combobox"/);
  assert.match(component, /Написати або вибрати марку/);
  assert.match(component, /Відкрити список марок авто/);
  assert.match(component, /Введене значення можна зберегти вручну/);
  assert.equal((visits.match(/<VehicleMakeCombobox/g) || []).length, 2);
});
