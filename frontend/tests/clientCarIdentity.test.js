import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { carDisplayName, primaryClientCar } from '../src/utils/clientCarIdentity.js';

test('client card vehicle identity contains plate, make, model and year', () => {
  const car = primaryClientCar({
    cars: [{ plate: 'aa1234bb', brand: 'Skoda', model: 'Octavia', year: 2018 }],
  });

  assert.equal(car.plate, 'AA1234BB');
  assert.equal(car.title, 'Skoda Octavia · 2018');
  assert.equal(car.hasIdentity, true);
  assert.equal(carDisplayName({ brand: 'Toyota', model: 'Camry' }), 'Toyota Camry');
});

test('active clients route renders the vehicle identity in each client card', async () => {
  const source = await readFile(new URL('../src/pages/ClientsCRMStage5.jsx', import.meta.url), 'utf8');

  assert.match(source, /primaryClientCar\(client\)/);
  assert.match(source, /Марка\/модель не вказані/);
});
