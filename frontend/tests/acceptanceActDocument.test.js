import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../src/components/crm/AcceptanceActDocumentPanel.jsx'), 'utf8');

test('acceptance act keeps preview and print separate from real PDF delivery', () => {
  assert.match(source, /Переглянути/);
  assert.match(source, />Друк</);
  assert.match(source, /Завантажити PDF/);
  assert.match(source, /Поділитися PDF/);
  assert.match(source, /downloadBlob\(blob, pdfFilename\)/);
});

test('acceptance act PDF is built from authenticated backend document', () => {
  assert.match(source, /api\.get\(`\/api\/visit-acceptance-act\/document\/\$\{visitId\}\/`/);
  assert.match(source, /responseType: 'text'/);
  assert.match(source, /window\.html2pdf\(\)/);
  assert.match(source, /outputPdf\('blob'\)/);
  assert.match(source, /\.toolbar'\)\?\.remove\(\)/);
});

test('mobile sharing sends a PDF file through the native share sheet', () => {
  assert.match(source, /new File\(\[blob\], pdfFilename, \{ type: 'application\/pdf' \}\)/);
  assert.match(source, /navigator\.canShare/);
  assert.match(source, /navigator\.share/);
  assert.match(source, /files: \[file\]/);
});

test('PDF generation preserves pending owner terms before export', () => {
  assert.match(source, /dirty && canEdit && !effectiveLocked/);
  assert.match(source, /await saveTerms\(\{ silent: true \}\)/);
});
