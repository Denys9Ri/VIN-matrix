import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const generatedPath = join(frontendRoot, 'src', 'growth', 'generatedLandingConfig.json');
const buildConfigPath = join(here, 'landing-growth-build-config.json');
const explicitUrl = String(process.env.LANDING_GROWTH_BUILD_CONFIG_URL || '').trim();
const rawOrigin = String(process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'https://vin-matrix.com').replace(/\/+$/, '');
const normalizedOrigin = rawOrigin.toLowerCase().endsWith('/api') ? rawOrigin.slice(0, -4) : rawOrigin;
const configUrl = explicitUrl || `${normalizedOrigin}/api/landing-growth/config/`;

const readFallback = () => {
  if (!existsSync(generatedPath)) return { version: 1, config: {}, experiments: [] };
  return JSON.parse(readFileSync(generatedPath, 'utf8'));
};

const verifySignature = (payload) => {
  const key = String(process.env.LANDING_GROWTH_SIGNING_KEY || '').trim();
  if (!key || !payload.signature) return true;
  // The server signs a canonical JSON object. Rebuild it with recursively sorted keys.
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((keyName) => [keyName, canonical(value[keyName])]));
  };
  const unsigned = { ...payload };
  delete unsigned.signature;
  const raw = JSON.stringify(canonical(unsigned));
  const expected = createHmac('sha256', key).update(raw).digest('hex');
  return expected === payload.signature;
};

let result = readFallback();
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(configUrl, {
    headers: { Accept: 'application/json' },
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.config || typeof payload.config !== 'object') throw new Error('config is missing');
  if (!verifySignature(payload)) throw new Error('signature verification failed');
  result = {
    version: Number(payload.version || 1),
    config: payload.config,
    experiments: Array.isArray(payload.experiments) ? payload.experiments : [],
    generated_at: payload.generated_at || new Date().toISOString(),
  };
  console.log(`Landing Growth config synchronized from ${configUrl} (v${result.version}).`);
} catch (error) {
  console.warn(`Landing Growth config sync skipped: ${error.message}. Using checked-in fallback.`);
}

writeFileSync(generatedPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
writeFileSync(buildConfigPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
