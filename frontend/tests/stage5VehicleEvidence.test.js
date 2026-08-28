import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../src/pages/ClientsCRMStage5.jsx'), 'utf8');

test('current Stage 5 CRM exposes vehicle evidence history from the Auto tab', () => {
  assert.match(source, /import \{ VehicleConditionHistory \} from '\.\.\/components\/crm\/AcceptancePhotos';/);
  assert.match(source, /tab === 'cars' && <VehicleEvidenceTab client=\{client\} cars=\{cars\}/);
  assert.match(source, /function VehicleEvidenceTab\(/);
  assert.match(source, /<VehicleConditionHistory/);
  assert.match(source, /selectedGroup=\{target\}/);
});

test('vehicle evidence stays separated by identifiable car before falling back to client phone', () => {
  assert.match(source, /const identifiableCars = safe\.filter/);
  assert.match(source, /const key = plate \|\| vin/);
  assert.match(source, /plate: String\(car\.plate/);
  assert.match(source, /vin: String\(car\.vin_code/);
  assert.match(source, /: \[\{ phone: client\?\.phone \|\| '' \}\]/);
});
