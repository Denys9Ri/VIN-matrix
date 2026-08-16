import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  documentPhoneNumbers,
  documentPhoneText,
  normalizeCompanyPhones,
  primaryCompanyPhone,
} from '../src/utils/companyPhones.js';

test('legacy company phone remains visible in documents', () => {
  const company = { phone: '+380501111111', phones: [] };

  assert.deepEqual(normalizeCompanyPhones(company), [{
    number: '+380501111111',
    show_in_documents: true,
  }]);
  assert.equal(primaryCompanyPhone(company), '+380501111111');
});

test('document phones contain only numbers enabled by the user', () => {
  const company = {
    phone: '+380501111111',
    phones: [
      { number: '+380501111111', show_in_documents: false },
      { number: '+380672222222', show_in_documents: true },
      { number: '+380933333333', show_in_documents: true },
    ],
  };

  assert.deepEqual(documentPhoneNumbers(company), ['+380672222222', '+380933333333']);
  assert.equal(documentPhoneText(company), '+380672222222 · +380933333333');
});

test('active settings and document renderer use the multi-phone controls', async () => {
  const [settings, documentSettings, phoneFields, documentDock] = await Promise.all([
    readFile(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/DocumentSettings.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/settings/CompanyPhoneFields.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/documents/DocumentDock.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(settings, /CompanyPhoneFields/);
  assert.match(documentSettings, /company\[phones\]/);
  assert.match(phoneFields, /У документах/);
  assert.match(phoneFields, /Не показувати/);
  assert.match(documentDock, /documentPhoneText\(company\)/);
});
