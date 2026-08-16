export function normalizeServiceSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('uk-UA')
    .replace(/[’'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function serviceWordMatches(word, queryWord) {
  if (word.startsWith(queryWord) || word.includes(queryWord)) return true;
  const shortestLength = Math.min(word.length, queryWord.length);
  if (shortestLength < 5) return false;
  const stemLength = Math.max(4, shortestLength - 2);
  return word.slice(0, stemLength) === queryWord.slice(0, stemLength);
}

function serviceSearchScore(serviceName, rawQuery) {
  const name = normalizeServiceSearch(serviceName);
  const query = normalizeServiceSearch(rawQuery);
  if (!query) return 0;
  if (!name) return Number.POSITIVE_INFINITY;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;

  const words = name.split(' ').filter(Boolean);
  if (words.some((word) => serviceWordMatches(word, query))) return 2;

  const initials = words.map((word) => word[0]).join('');
  if (initials.startsWith(query)) return 3;
  if (name.includes(query)) return 4;

  const queryWords = query.split(' ').filter(Boolean);
  if (queryWords.every((queryWord) => words.some((word) => serviceWordMatches(word, queryWord)))) return 5;
  return Number.POSITIVE_INFINITY;
}

export function searchServiceCatalog(services, query) {
  const safeServices = Array.isArray(services) ? services : [];
  if (!normalizeServiceSearch(query)) return safeServices;

  return safeServices
    .map((service, index) => ({ service, index, score: serviceSearchScore(service?.name, query) }))
    .filter((result) => Number.isFinite(result.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((result) => result.service);
}
