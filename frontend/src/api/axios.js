import axios from 'axios';

const LEGACY_API_ORIGINS = [
  'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'https://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'http://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
  'https://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
];

const NEW_STORE_ORDER_PREFIX = 'NEW_STORE_ORDER::';

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

const isVisitSearchUrl = (url = '') => /\/api\/visits\/?\?search=/.test(String(url));
const getVisitSearchQuery = (url = '') => {
  try {
    const parsed = new URL(String(url), API_ORIGIN);
    return (parsed.searchParams.get('search') || '').trim();
  } catch {
    const match = String(url).match(/[?&]search=([^&]+)/);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }
};

const isNumericVisitSearch = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get') return false;
  const query = getVisitSearchQuery(config.url);
  return isVisitSearchUrl(config.url) && /^\d+$/.test(query);
};

const rewriteNumericVisitSearch = (config) => {
  if (!isNumericVisitSearch(config)) return config;
  const query = getVisitSearchQuery(config.url);
  const url = String(config.url || '');
  const base = url.split('?')[0].replace(/\/$/, '');
  config.url = `${base}/${query}/`;
  config.__singleVisitSearch = true;
  return config;
};

const createStoreOrderFromSearch = async (config) => {
  if (config.__skipStoreOrderCreate) return config;
  if ((config.method || 'get').toLowerCase() !== 'post') return config;
  if (!String(config.url || '').includes('/api/order-parts/')) return config;

  const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
  const visit = String(data.visit || '');
  if (!visit.startsWith(NEW_STORE_ORDER_PREFIX)) return config;

  const rawQuery = decodeURIComponent(visit.slice(NEW_STORE_ORDER_PREFIX.length)).trim();
  const looksPhone = /^[+\d\s()-]{6,}$/.test(rawQuery);
  const clientName = looksPhone ? 'Новий покупець' : (rawQuery || 'Новий покупець');
  const phone = looksPhone ? rawQuery : '';
  const today = new Date();

  const delivery = {
    source: 'Пошук запчастин',
    mode: 'store',
    delivery_status: 'draft',
    created_from_search: true,
  };

  const orderPayload = {
    client: clientName,
    phone,
    plate: `ORDER-${Date.now()}`,
    vin_code: null,
    status: 'SELECTION',
    delivery_type: 'pickup',
    delivery_data: JSON.stringify(delivery),
    payment_status: 'unpaid',
    prepayment_amount: 0,
    comment: `Створено з пошуку запчастин: ${rawQuery || 'без запиту'}`,
    scheduled_datetime: today.toISOString(),
  };

  const orderResponse = await axios.request({
    method: 'post',
    url: '/api/visits/',
    baseURL: API_ORIGIN,
    data: orderPayload,
    headers: config.headers,
    __skipStoreOrderCreate: true,
  });

  data.visit = orderResponse.data.id;
  config.data = data;
  config.__createdStoreOrderId = orderResponse.data.id;
  return config;
};

const attachAuthAndNormalize = async (config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.url = normalizeRequestUrl(config.url);
  const rewritten = rewriteNumericVisitSearch(config);
  return createStoreOrderFromSearch(rewritten);
};

const normalizeVisitSearchResponse = (response) => {
  if (response.config?.__singleVisitSearch && response.data && !Array.isArray(response.data)) {
    response.data = [response.data];
  }

  if (isVisitSearchUrl(response.config?.url) && Array.isArray(response.data)) {
    const query = getVisitSearchQuery(response.config.url);
    if (query && !/^\d+$/.test(query)) {
      const alreadyExists = response.data.some((item) => String(item.id || '').startsWith(NEW_STORE_ORDER_PREFIX));
      if (!alreadyExists) {
        response.data = [
          ...response.data,
          {
            id: `${NEW_STORE_ORDER_PREFIX}${encodeURIComponent(query)}`,
            plate: '+ Створити нове замовлення',
            client: query,
            phone: '',
            vin_code: 'Нове замовлення з цією запчастиною',
            status: 'SELECTION',
            __create_store_order: true,
          },
        ];
      }
    }
  }

  if (response.config?.__createdStoreOrderId) {
    try {
      sessionStorage.setItem('openStoreOrderId', String(response.config.__createdStoreOrderId));
      setTimeout(() => {
        window.location.href = `/visits?open_store_order_id=${response.config.__createdStoreOrderId}`;
      }, 350);
    } catch {
      // ignore browser navigation/storage errors
    }
  }

  return response;
};

// Global fallback for legacy pages that still import axios directly.
axios.defaults.baseURL = API_ORIGIN;
axios.interceptors.request.use(attachAuthAndNormalize);
axios.interceptors.response.use(normalizeVisitSearchResponse);

const api = axios.create({
  baseURL: API_ORIGIN,
});

api.interceptors.request.use(attachAuthAndNormalize);
api.interceptors.response.use(normalizeVisitSearchResponse);

export default api;
