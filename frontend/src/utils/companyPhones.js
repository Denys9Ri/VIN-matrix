const phoneKey = (number) => {
  const digits = String(number || '').replace(/\D/g, '');
  return digits || String(number || '').trim().toLocaleLowerCase('uk-UA');
};

export function normalizeCompanyPhones(companyOrPhones, fallbackPhone = '') {
  const isList = Array.isArray(companyOrPhones);
  const source = isList ? companyOrPhones : companyOrPhones?.phones;
  const fallback = isList ? fallbackPhone : companyOrPhones?.phone;
  const phones = [];
  const seen = new Set();

  (Array.isArray(source) ? source : []).forEach((item) => {
    const number = String(typeof item === 'string' ? item : item?.number || item?.phone || '').trim();
    if (!number) return;
    const key = phoneKey(number);
    if (seen.has(key)) return;
    seen.add(key);
    phones.push({
      number,
      show_in_documents: typeof item === 'object' && item !== null
        ? item.show_in_documents !== false && item.showInDocuments !== false
        : true,
    });
  });

  if (!phones.length && String(fallback || '').trim()) {
    phones.push({ number: String(fallback).trim(), show_in_documents: true });
  }

  return phones.slice(0, 10);
}

export function documentPhoneNumbers(company) {
  return normalizeCompanyPhones(company)
    .filter((phone) => phone.show_in_documents)
    .map((phone) => phone.number);
}

export function documentPhoneText(company, separator = ' · ') {
  return documentPhoneNumbers(company).join(separator);
}

export function primaryCompanyPhone(company) {
  return normalizeCompanyPhones(company)[0]?.number || '';
}
