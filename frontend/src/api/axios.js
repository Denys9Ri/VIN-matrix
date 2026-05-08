import axios from 'axios'; 

const api = axios.create({
  baseURL: 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
