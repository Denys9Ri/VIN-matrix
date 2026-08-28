import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowSource = fs.readFileSync(path.join(here, '../src/components/crm/VisitWorkflowPanel.jsx'), 'utf8');
const photosSource = fs.readFileSync(path.join(here, '../src/components/crm/AcceptancePhotos.jsx'), 'utf8');
const clientSource = fs.readFileSync(path.join(here, '../src/components/crm/ClientCommunicationPanel.jsx'), 'utf8');
const clientsPageSource = fs.readFileSync(path.join(here, '../src/pages/Clients.jsx'), 'utf8');

test('acceptance act exposes photo capture for evidence categories', () => {
  assert.match(workflowSource, /category="damages"/);
  assert.match(workflowSource, /category="interior"/);
  assert.match(workflowSource, /category="exterior"/);
  assert.match(photosSource, /capture="environment"/);
  assert.match(photosSource, /Галерея/);
});

test('acceptance photos use authenticated API and client vehicle history', () => {
  assert.match(photosSource, /api\.get\(photo\.file_endpoint, \{ responseType: 'blob' \}\)/);
  assert.match(photosSource, /vehicle-history/);
  assert.match(photosSource, /params\.set\('vin_code'/);
  assert.match(photosSource, /data instanceof Blob/);
  assert.match(photosSource, /await data\.text\(\)/);
  assert.match(clientSource, /ClientAcceptancePhotoHistory/);
  assert.match(clientsPageSource, /VehicleConditionHistory/);
  assert.match(clientsPageSource, /detailTab === 'auto'/);
  assert.doesNotMatch(photosSource, /\/media\/acceptance_photos/);
});

test('full screen evidence viewer is portaled outside clipped mobile panels', () => {
  assert.match(photosSource, /createPortal/);
  assert.match(photosSource, /document\.body/);
  assert.match(photosSource, /z-\[10000\]/);
  assert.match(photosSource, /Відкрити фото повністю/);
});

test('completed acceptance act has explicit audited correction flow', () => {
  assert.match(workflowSource, /Зафіксувати акт/);
  assert.match(workflowSource, /visit-acceptance-act\/reopen\//);
  assert.match(workflowSource, /Внести коригування/);
  assert.match(workflowSource, /причину коригування/i);
  assert.match(workflowSource, /disabled=\{acceptanceLocked\}/);
});

test('Safari upload lets browser own multipart boundary', () => {
  assert.match(photosSource, /new FormData\(\)/);
  assert.match(photosSource, /api\.post\('\/api\/visit-acceptance-photos\/', form\)/);
  assert.doesNotMatch(photosSource, /headers:\s*\{\s*'Content-Type':\s*'multipart\/form-data'/);
});
