import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRecommendationVisitPayload,
  recommendationScheduleDefaults,
} from '../src/utils/recommendationVisit.js';

test('recommendation schedule defaults prefer a future due date and mileage', () => {
  const now = new Date('2026-08-22T10:00:00');
  const result = recommendationScheduleDefaults({ due_date: '2026-09-10', due_mileage: 102000 }, now);

  assert.equal(result.date, '2026-09-10');
  assert.equal(result.time, '09:00');
  assert.equal(result.mileage, 102000);
});

test('recommendation schedule defaults use tomorrow when due date is already past', () => {
  const now = new Date('2026-08-22T10:00:00');
  const result = recommendationScheduleDefaults({ due_date: '2026-08-10' }, now);

  assert.equal(result.date, '2026-08-23');
});

test('follow-up visit payload keeps vehicle data and recommendation linkage', () => {
  const payload = buildRecommendationVisitPayload({
    recommendation: {
      id: 42,
      title: 'Заміна передніх колодок',
      client: 'Олександр',
      phone: '+380501112233',
      plate: 'aa1234bb',
      due_mileage: 102000,
    },
    sourceVisit: { vin_code: 'WVWZZZ1JZXW000001' },
    carData: { brand: 'Skoda', model: 'Octavia', mileage: 100000 },
    schedule: { date: '2026-09-10', time: '10:30', mileage: 102000, comment: 'Передзвонити за день' },
  });

  assert.equal(payload.plate, 'AA1234BB');
  assert.equal(payload.vin_code, 'WVWZZZ1JZXW000001');
  assert.match(payload.comment, /\[З рекомендації\] Заміна передніх колодок/);
  assert.match(payload.comment, /Передзвонити за день/);

  const delivery = JSON.parse(payload.delivery_data);
  assert.equal(delivery.brand, 'Skoda');
  assert.equal(delivery.model, 'Octavia');
  assert.equal(delivery.mileage, 102000);
  assert.equal(delivery.source, 'recommendation');
  assert.equal(delivery.recommendation_id, 42);
});
