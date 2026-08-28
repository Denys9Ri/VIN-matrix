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
  assert.match(photosSource, /h-\[100dvh\]/);
  assert.match(photosSource, /relative min-h-0 flex-1 overflow-hidden/);
  assert.match(photosSource, /absolute inset-0 flex touch-none items-center justify-center/);
  assert.match(photosSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(photosSource, /safe-area-inset-top/);
  assert.match(photosSource, /safe-area-inset-bottom/);
  assert.match(photosSource, /event\.key === 'Escape'/);
});

test('full screen evidence viewer supports bounded zoom and touch gestures', () => {
  assert.match(photosSource, /aria-label="Збільшити фото"/);
  assert.match(photosSource, /aria-label="Зменшити фото"/);
  assert.match(photosSource, /Скинути масштаб до 100 відсотків/);
  assert.match(photosSource, /Math\.min\(5, Math\.max\(1,/);
  assert.match(photosSource, /onWheel=\{handleWheel\}/);
  assert.match(photosSource, /onPointerMove=\{handlePointerMove\}/);
  assert.match(photosSource, /touch-none/);
  assert.match(photosSource, /translate3d\(/);
  assert.match(photosSource, /event\.key === '0'/);
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
