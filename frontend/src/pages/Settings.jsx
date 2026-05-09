import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    user: { first_name: '', email: '', username: '' },
    company: { name: '' }
  });
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState(null); // Новий стан для помилки

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // ТУТ ВАЖЛИВО: перевір, як називається твій ключ у localStorage (може бути token, а не access)
        const token = localStorage.getItem('access') || localStorage.getItem('token') || localStorage.getItem('accessToken');
        
        if (!token) {
          setDebugError("Токен не знайдено в пам'яті браузера. Ти точно залогінений?");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_BASE}/api/settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setProfile(response.data);
      } catch (error) {
        console.error("Повна помилка:", error);
        
        // Збираємо інформацію про помилку, щоб вивести на екран
        let errorDetails = `Код: ${error.response?.status}. `;
        if (error.response?.data) {
          errorDetails += `Деталі: ${JSON.stringify(error.response.data)}`;
        } else {
          errorDetails += `Повідомлення: ${error.message}`;
        }
        
        setDebugError(errorDetails);
        
        // ТИМЧАСОВО ВІДКЛЮЧИЛИ ВИХІД НА ЛОГІН, ЩОБ ПОБАЧИТИ ПОМИЛКУ
        // if (error.response?.status === 401) { ... }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [navigate]);

  // (Функцію handleLogout я тут скоротив для економії місця, вона поки не потрібна)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="font-bold text-slate-600">Завантаження...</p>
      </div>
    );
  }

  // ЯКЩО Є ПОМИЛКА - ПОКАЗУЄМО ЇЇ ВЕЛИКИМ ЧЕРВОНИМ ТЕКСТОМ
  if (debugError) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-red-50 border border-red-200 rounded-2xl">
        <div className="flex items-center gap-4 text-red-600 mb-4">
          <AlertTriangle size={32} />
          <h2 className="text-xl font-black">Спіймали помилку!</h2>
        </div>
        <p className="text-slate-800 font-mono bg-white p-4 rounded border border-red-100">
          {debugError}
        </p>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 bg-slate-900 text-white px-4 py-2 rounded font-bold"
        >
          Повернутися на головну
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-black uppercase mb-8 italic">Налаштування працюють!</h1>
      <p>Твої дані: {profile.user.username} | {profile.company.name}</p>
    </div>
  );
};

export default Settings;
