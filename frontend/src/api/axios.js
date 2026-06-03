import axios from 'axios';

const LEGACY_API_ORIGINS = [
  'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'https://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'http://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
  'https://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
];

const DEFAULT_API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : LEGACY_API_ORIGINS[0]);

const normalizeBaseUrl = (rawUrl) => {
  let url = String(rawUrl || DEFAULT_API_ORIGIN).trim();
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (url.toLowerCase().endsWith('/api')) {
    url = url.slice(0, -4);
  }
  return url;
};

export const API_ORIGIN = normalizeBaseUrl(DEFAULT_API_ORIGIN);

const normalizeRequestUrl = (url = '') => {
  if (!url) return url;
  const original = String(url);
  const legacyOrigin = LEGACY_API_ORIGINS.find((origin) => original.startsWith(origin));
  if (legacyOrigin) {
    return `${API_ORIGIN}${original.slice(legacyOrigin.length)}`;
  }
  return original;
};

const rewriteNumericVisitSearch = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return config;
  const url = String(config.url || '');
  const match = url.match(/^(.*\/api\/visits\/?)\?search=(\d+)$/);
  if (!match) return config;
  config.url = `${match[1].replace(/\/$/, '')}/${match[2]}/`;
  config.__singleVisitSearch = true;
  return config;
};

const attachAuthAndNormalize = (config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.url = normalizeRequestUrl(config.url);
  return rewriteNumericVisitSearch(config);
};

const normalizeSingleVisitSearchResponse = (response) => {
  if (response.config?.__singleVisitSearch && response.data && !Array.isArray(response.data)) {
    response.data = [response.data];
  }
  return response;
};

// Global fallback for legacy pages that still import axios directly.
axios.defaults.baseURL = API_ORIGIN;
axios.interceptors.request.use(attachAuthAndNormalize);
axios.interceptors.response.use(normalizeSingleVisitSearchResponse);

const api = axios.create({
  baseURL: API_ORIGIN,
});

api.interceptors.request.use(attachAuthAndNormalize);
api.interceptors.response.use(normalizeSingleVisitSearchResponse);

export default api;
