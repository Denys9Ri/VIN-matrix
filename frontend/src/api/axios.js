import axios from 'axios';

const DEFAULT_API_ORIGIN = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';

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

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_URL),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
