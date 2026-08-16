export function normalizeOrderPartQuantity(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

export function adjustOrderPartQuantity(value, delta) {
  const parsedDelta = Number(delta);
  if (!Number.isFinite(parsedDelta)) return normalizeOrderPartQuantity(value);
  return Math.max(1, normalizeOrderPartQuantity(value) + Math.trunc(parsedDelta));
}

export function supplierPartDefaultQuantity(part) {
  return normalizeOrderPartQuantity(part?.min_qty, 1);
}

export function orderPartLineTotal(unitPrice, quantity) {
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) return 0;
  return Math.round(price * normalizeOrderPartQuantity(quantity) * 100) / 100;
}
