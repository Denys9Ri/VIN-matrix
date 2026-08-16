export const VEHICLE_FUEL_TYPES = Object.freeze([
  'Бензин',
  'Газ/Бензин',
  'Дизель',
  'Електро',
  'Гібрид',
]);

export function normalizeVehicleFuel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('uk-UA')
    .replace(/[^a-zа-яіїєґ0-9]+/g, ' ')
    .trim();
}

function vehicleFuelScore(fuel, rawQuery) {
  const candidate = normalizeVehicleFuel(fuel);
  const query = normalizeVehicleFuel(rawQuery);
  if (!query) return 0;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.split(' ').some((word) => word.startsWith(query))) return 2;
  if (candidate.includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

export function searchVehicleFuels(fuels, query) {
  const safeFuels = Array.isArray(fuels) ? fuels : [];
  if (!normalizeVehicleFuel(query)) return safeFuels;

  return safeFuels
    .map((fuel, index) => ({ fuel, index, score: vehicleFuelScore(fuel, query) }))
    .filter((result) => Number.isFinite(result.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((result) => result.fuel);
}
