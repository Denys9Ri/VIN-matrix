import axios from 'axios';

const LEGACY_API_ORIGINS = [
  'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'https://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
  'http://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
  'https://ydy3swnvdledj1sdinrvvleo.95.217.211.207.sslip.io',
];

const NEW_STORE_ORDER_PREFIX = 'NEW_STORE_ORDER::';
const FALLBACK_PHONE = '0000000000';
const CONFIGURED_API_ORIGIN = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

const getApiOrigin = () => {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : LEGACY_API_ORIGINS[0];
  const candidate = CONFIGURED_API_ORIGIN || browserOrigin;

  try {
    const url = new URL(candidate, browserOrigin);
    // A page served over HTTPS must never send credentials or API requests to HTTP.
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:';
      console.warn('VIN-matrix: insecure API URL was upgraded to HTTPS. Configure VITE_API_URL with an HTTPS API domain.');
    }
    return url.origin;
  } catch {
    return browserOrigin;
  }
};

const DEFAULT_API_ORIGIN = getApiOrigin();

const normalizeBaseUrl = (rawUrl) => {
  let url = String(rawUrl || DEFAULT_API_ORIGIN).trim();
  while (url.endsWith('/')) url = url.slice(0, -1);
  if (url.toLowerCase().endsWith('/api')) url = url.slice(0, -4);
  return url;
};

export const API_ORIGIN = normalizeBaseUrl(DEFAULT_API_ORIGIN);

const normalizeRequestUrl = (url = '') => {
  if (!url) return url;
  const original = String(url);
  const legacyOrigin = LEGACY_API_ORIGINS.find((origin) => original.startsWith(origin));
  return legacyOrigin ? `${API_ORIGIN}${original.slice(legacyOrigin.length)}` : original;
};

const isVisitSearchUrl = (url = '') => /\/api\/visits\/?\?search=/.test(String(url));
const getVisitSearchQuery = (url = '') => {
  try { return (new URL(String(url), API_ORIGIN).searchParams.get('search') || '').trim(); }
  catch { const match = String(url).match(/[?&]search=([^&]+)/); return match ? decodeURIComponent(match[1]).trim() : ''; }
};
const isPhoneLikeQuery = (value = '') => /^[+\d\s()-]{6,20}$/.test(String(value).trim()) && String(value).replace(/\D/g, '').length >= 9;
const isShortOrderIdQuery = (value = '') => /^\d{1,8}$/.test(String(value).trim());
const canOfferCreateOrder = (value = '') => { const query = String(value || '').trim(); return Boolean(query) && (!/^\d+$/.test(query) || isPhoneLikeQuery(query)); };
const normalizePhone = (value) => String(value || '').trim().slice(0, 20) || FALLBACK_PHONE;

const rewriteNumericVisitSearch = (config) => {
  if ((config.method || 'get').toLowerCase() !== 'get' || !isVisitSearchUrl(config.url) || !isShortOrderIdQuery(getVisitSearchQuery(config.url))) return config;
  const query = getVisitSearchQuery(config.url);
  const base = String(config.url || '').split('?')[0].replace(/\/$/, '');
  config.url = `${base}/${query}/`;
  config.__singleVisitSearch = true;
  return config;
};

const createStoreOrderFromSearch = async (config) => {
  if (config.__skipStoreOrderCreate || (config.method || 'get').toLowerCase() !== 'post' || !String(config.url || '').includes('/api/order-parts/')) return config;
  const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
  const visit = String(data.visit || '');
  if (!visit.startsWith(NEW_STORE_ORDER_PREFIX)) return config;

  const encoded = visit.slice(NEW_STORE_ORDER_PREFIX.length);
  const rawQuery = decodeURIComponent(encoded.split('::')[0] || '').trim();
  const encodedClient = encoded.includes('::') ? encoded.split('::').slice(1).join('::') : '';
  const hintedClient = encodedClient ? decodeURIComponent(encodedClient).trim() : '';
  const looksPhone = isPhoneLikeQuery(rawQuery);
  const clientName = (hintedClient || (looksPhone ? 'Новий покупець' : (rawQuery || 'Новий покупець'))).slice(0, 100);
  const today = new Date();
  const orderResponse = await axios.request({
    method: 'post', url: '/api/visits/', baseURL: API_ORIGIN, headers: config.headers, __skipStoreOrderCreate: true,
    data: {
      client: clientName, phone: normalizePhone(looksPhone ? rawQuery : ''), plate: `ORD-${Date.now()}`.slice(0, 20), vin_code: null,
      status: 'SELECTION', delivery_type: 'pickup', payment_status: 'unpaid', prepayment_amount: 0,
      delivery_data: JSON.stringify({ source: 'Пошук запчастин', mode: 'store', delivery_status: 'draft', created_from_search: true }),
      comment: `Створено з пошуку запчастин: ${rawQuery || 'без запиту'}`, scheduled_datetime: today.toISOString(),
    },
  });
  data.visit = orderResponse.data.id;
  data.quantity = data.quantity || 1;
  data.supplier = String(data.supplier || 'Пошук запчастин').slice(0, 100);
  config.data = data;
  config.__createdStoreOrderId = orderResponse.data.id;
  return config;
};

const attachAuthAndNormalize = async (config) => {
  const token = localStorage.getItem('access_token');
  if (token) { config.headers = config.headers || {}; config.headers.Authorization = `Bearer ${token}`; }
  config.url = normalizeRequestUrl(config.url);
  return createStoreOrderFromSearch(rewriteNumericVisitSearch(config));
};

const decoratePart = (part) => {
  if (!part || typeof part !== 'object') return part;
  if (part.source_label) return { ...part, supplier: part.source_label };
  if (part.stock_status === 'sold') return { ...part, supplier: 'Мій склад — списано' };
  if (part.stock_status === 'reserved') return { ...part, supplier: 'Мій склад — резерв' };
  if (part.stock_status === 'released') return { ...part, supplier: 'Мій склад — резерв знято' };
  if (part.inventory_item) return { ...part, supplier: 'Мій склад' };
  return part;
};
const decorateVisitParts = (data) => {
  if (Array.isArray(data)) return data.map((visit) => visit?.parts ? { ...visit, parts: visit.parts.map(decoratePart) } : visit);
  if (data?.parts) return { ...data, parts: data.parts.map(decoratePart) };
  return data?.brand && data?.article ? decoratePart(data) : data;
};

const normalizeVisitSearchResponse = (response) => {
  response.data = decorateVisitParts(response.data);
  if (response.config?.__singleVisitSearch && response.data && !Array.isArray(response.data)) response.data = [response.data];
  if (isVisitSearchUrl(response.config?.url) && Array.isArray(response.data)) {
    const query = getVisitSearchQuery(response.config.url);
    if (canOfferCreateOrder(query) && !response.data.some((item) => String(item.id || '').startsWith(NEW_STORE_ORDER_PREFIX))) {
      const phone = isPhoneLikeQuery(query) ? normalizePhone(query) : FALLBACK_PHONE;
      const existingClient = response.data.find((item) => item?.phone === phone || String(item?.phone || '').replace(/\D/g, '') === String(phone).replace(/\D/g, ''));
      const clientName = existingClient?.client || (isPhoneLikeQuery(query) ? 'Новий покупець' : query);
      response.data = [...response.data, { id: `${NEW_STORE_ORDER_PREFIX}${encodeURIComponent(query)}${clientName ? `::${encodeURIComponent(clientName)}` : ''}`, plate: '+ Створити нове замовлення', client: clientName, phone, vin_code: isPhoneLikeQuery(query) ? `Телефон: ${phone}` : 'Нове замовлення з цією запчастиною', status: 'SELECTION', __create_store_order: true }];
    }
  }
  if (response.config?.__createdStoreOrderId) {
    try { sessionStorage.setItem('openStoreOrderId', String(response.config.__createdStoreOrderId)); setTimeout(() => { window.location.href = `/visits?open_store_order_id=${response.config.__createdStoreOrderId}`; }, 350); } catch { /* ignore */ }
  }
  return response;
};

const handleApiError = (error) => {
  if (error?.response?.status === 402 && error.response?.data?.billing_required) {
    try { sessionStorage.setItem('billing_required_message', error.response.data.error || 'Потрібна оплата тарифу.'); if (window.location.pathname !== '/billing') window.location.href = '/billing'; } catch { /* ignore */ }
  }
  return Promise.reject(error);
};

axios.defaults.baseURL = API_ORIGIN;
axios.interceptors.request.use(attachAuthAndNormalize);
axios.interceptors.response.use(normalizeVisitSearchResponse, handleApiError);
const api = axios.create({ baseURL: API_ORIGIN });
api.interceptors.request.use(attachAuthAndNormalize);
api.interceptors.response.use(normalizeVisitSearchResponse, handleApiError);
export default api;
