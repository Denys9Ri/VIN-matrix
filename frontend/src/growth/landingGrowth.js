import { API_ORIGIN } from '../api/axios';

const SESSION_KEY = 'vin_growth_session_id';
const ASSIGNMENT_KEY = 'vin_growth_assignment';
let memorySessionId = '';
let memoryAssignment = null;

const randomId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const getGrowthSessionId = () => {
  if (memorySessionId) return memorySessionId;
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 16) {
      memorySessionId = existing;
      return existing;
    }
    memorySessionId = randomId();
    localStorage.setItem(SESSION_KEY, memorySessionId);
    return memorySessionId;
  } catch {
    memorySessionId = memorySessionId || randomId();
    return memorySessionId;
  }
};

export const setGrowthAssignment = (assignment) => {
  memoryAssignment = assignment || null;
  try {
    if (!assignment) sessionStorage.removeItem(ASSIGNMENT_KEY);
    else sessionStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignment));
  } catch {
    // In-memory attribution remains stable when browser storage is unavailable.
  }
};

export const getGrowthAttribution = () => {
  try {
    const raw = sessionStorage.getItem(ASSIGNMENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') memoryAssignment = parsed;
    return memoryAssignment;
  } catch {
    return memoryAssignment;
  }
};

export const deepMerge = (base, override) => {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const result = { ...(base || {}) };
  Object.entries(override).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(result[key] || {}, value)
      : value;
  });
  return result;
};

export const setConfigPath = (config, path, value) => {
  const clone = deepMerge({}, config || {});
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return clone;
  let current = clone;
  parts.slice(0, -1).forEach((part) => {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};
    current = current[part];
  });
  current[parts.at(-1)] = value;
  return clone;
};

export const stableExperimentVariant = (sessionId, experiment) => {
  const input = `${experiment?.id || ''}:${sessionId}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const bucket = (hash >>> 0) % 100;
  return bucket < Number(experiment?.allocation_percentage || 50) ? 'variant' : 'control';
};

const queryMetadata = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const metadata = {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      device: window.innerWidth < 768 ? 'mobile' : 'desktop',
    };
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value));
  } catch {
    return {};
  }
};

export const trackLandingEvent = async (eventName, options = {}) => {
  const attribution = options.attribution === undefined ? getGrowthAttribution() : options.attribution;
  const sessionId = options.sessionId || getGrowthSessionId();
  const eventId = randomId();
  const payload = {
    event_id: eventId,
    session_id: sessionId,
    event_name: eventName,
    page_path: options.pagePath || window.location.pathname,
    block_key: options.blockKey || attribution?.block_key || '',
    experiment_id: attribution?.experiment_id || '',
    referrer: document.referrer || '',
    metadata: { ...queryMetadata(), ...(options.metadata || {}) },
  };

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, {
      growth_experiment_id: attribution?.experiment_id || 'none',
      growth_variant: attribution?.variant || 'none',
      growth_block: payload.block_key || 'none',
      ...payload.metadata,
    });
  }

  if (options.internal === false) return { ok: true, skipped: true };
  try {
    const response = await fetch(`${API_ORIGIN}/api/landing-growth/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
    });
    return response.ok ? response.json() : { ok: false, status: response.status };
  } catch {
    return { ok: false, offline: true };
  }
};
