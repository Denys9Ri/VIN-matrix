import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { VEHICLE_MAKES } from '../src/utils/vehicleMakeCatalog.js';
import {
  getVehicleModels,
  searchVehicleModels,
  vehicleModelAfterMakeChange,
  VEHICLE_MODEL_CATALOG_SOURCE,
  VEHICLE_MODELS_BY_MAKE,
} from '../src/utils/vehicleModelCatalog.js';

test('vehicle model catalog covers the make catalog with a broad model list', () => {
  assert.deepEqual(Object.keys(VEHICLE_MODELS_BY_MAKE), [...VEHICLE_MAKES]);
  assert.ok(Object.values(VEHICLE_MODELS_BY_MAKE).filter((models) => models.length).length >= 150);
  assert.ok(Object.values(VEHICLE_MODELS_BY_MAKE).flat().length >= 5_000);
  assert.equal(VEHICLE_MODEL_CATALOG_SOURCE.name, 'VehiclesDB');
  assert.equal(VEHICLE_MODEL_CATALOG_SOURCE.license, 'CC-BY-4.0');
});

test('vehicle model lookup returns models only for the selected make', () => {
  assert.ok(getVehicleModels('Audi').includes('A4'));
  assert.ok(getVehicleModels('Toyota').includes('Corolla'));
  assert.ok(getVehicleModels('Volkswagen').includes('Golf'));
  assert.ok(getVehicleModels('Škoda').includes('Octavia'));
  assert.ok(getVehicleModels('ZAZ').includes('Lanos'));
  assert.ok(!getVehicleModels('Audi').includes('Corolla'));
  assert.deepEqual(getVehicleModels('Невідома марка'), []);
});

test('vehicle model search prioritizes the first typed letters', () => {
  assert.equal(searchVehicleModels(getVehicleModels('Audi'), 'a4')[0], 'A4');
  assert.equal(searchVehicleModels(getVehicleModels('Volkswagen'), 'golf')[0], 'Golf');
  assert.equal(searchVehicleModels(getVehicleModels('Škoda'), 'oct')[0], 'Octavia');
});

test('changing the vehicle make clears an incompatible model', () => {
  assert.equal(vehicleModelAfterMakeChange('Audi', 'BMW', 'A4'), '');
  assert.equal(vehicleModelAfterMakeChange('Audi', 'AUDI', 'A4'), 'A4');
});

test('vehicle model combobox supports typing, dependent list and manual values', async () => {
  const component = await readFile(new URL('../src/components/visits/VehicleModelCombobox.jsx', import.meta.url), 'utf8');
  const visits = await readFile(new URL('../src/pages/Visits.jsx', import.meta.url), 'utf8');

  assert.match(component, /role="combobox"/);
  assert.match(component, /getVehicleModels\(make\)/);
  assert.match(component, /Написати або вибрати модель/);
  assert.match(component, /Спочатку виберіть марку авто/);
  assert.match(component, /Введене значення можна зберегти вручну/);
  assert.match(component, /Vehicle data by VehiclesDB/);
  assert.equal((visits.match(/<VehicleModelCombobox/g) || []).length, 2);
  assert.equal((visits.match(/vehicleModelAfterMakeChange/g) || []).length, 3);
});
