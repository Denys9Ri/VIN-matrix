import axios from 'react';

const api = axios.create({
  // Ось тут ми підключили твій живий бекенд!
  baseURL: 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io',
});

// Цей блок автоматично додає "перепустку" (токен) до кожного запиту
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
