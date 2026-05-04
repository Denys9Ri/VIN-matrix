import axios from 'axios';

const api = axios.create({
  // Беремо адресу з налаштувань Coolify. Якщо локально - стукаємо на 8000
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
