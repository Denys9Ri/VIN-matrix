import React, { useState, useEffect } from 'react';
import { LogOut, User, Settings as SettingsIcon, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    user: { first_name: '', email: '', username: '' },
    company: { name: '' }
  });
  const [loading, setLoading] = useState(true);

  // 1. ЗАВАНТАЖЕННЯ ДАНИХ ПРИ ВХОДІ НА СТОРІНКУ
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('access');
        const response = await axios.get('http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io/api/settings/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Помилка завантаження налаштувань:", error);
        if (error.response?.status === 401) navigate('/login');
      }
    };
    fetchSettings();
  }, [navigate]);

  // 2. ЛОГІКА ВИХОДУ
  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh');
      const accessToken = localStorage.getItem('access');
      
      // Повідомляємо бекенд про вихід
      await axios.post('http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io/api/logout/', 
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (e) {
      console.log("Вихід на сервері не вдався, очищуємо локально...");
    } finally {
      // У будь-якому випадку очищуємо пам'ять і йдемо на вхід
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      navigate('/login');
    }
  };

  if (loading) return <div className="p-8 text-center font-bold">Завантаження...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-black uppercase mb-8 italic">Налаштування</h1>
      
      <div className="space-y-4">
        {/* КАРТКА ПРОФІЛЮ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><User size={24}/></div>
            <div>
              <p className="font-black text-slate-900">
                {profile.user.first_name || profile.user.username}
              </p>
              <p className="text-slate-400 text-sm">{profile.user.email || 'Email не вказано'}</p>
            </div>
          </div>
          <button className="text-blue-600 font-bold text-sm hover:underline">Редагувати</button>
        </div>

        {/* КАРТКА СТО / МАГАЗИНА */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-xl text-green-600"><Store size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Мій Бізнес</p>
              <p className="text-slate-400 text-sm">{profile.company.name}</p>
            </div>
          </div>
          <button className="text-green-600 font-bold text-sm hover:underline">Змінити назву</button>
        </div>

        {/* КНОПКА ВИХОДУ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl text-red-600"><LogOut size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Вихід із системи</p>
              <p className="text-slate-400 text-sm">Завершити поточну сесію</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-6 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors"
          >
            Вийти
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
