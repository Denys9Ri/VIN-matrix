import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowSource = fs.readFileSync(path.join(here, '../src/components/crm/VisitWorkflowPanel.jsx'), 'utf8');
const photosSource = fs.readFileSync(path.join(here, '../src/components/crm/AcceptancePhotos.jsx'), 'utf8');
const clientSource = fs.readFileSync(path.join(here, '../src/components/crm/ClientCommunicationPanel.jsx'), 'utf8');

test('acceptance act exposes photo capture for evidence categories', () => {
  assert.match(workflowSource, /category="damages"/);
  assert.match(workflowSource, /category="interior"/);
  assert.match(workflowSource, /category="exterior"/);
  assert.match(photosSource, /capture="environment"/);
  assert.match(photosSource, /Галерея/);
});

test('acceptance photos use authenticated API and client history', () => {
  assert.match(photosSource, /api\.get\(photo\.file_endpoint, \{ responseType: 'blob' \}\)/);
  assert.match(photosSource, /\/api\/visit-acceptance-photos\//);
  assert.match(clientSource, /ClientAcceptancePhotoHistory/);
  assert.doesNotMatch(photosSource, /\/media\/acceptance_photos/);
});
