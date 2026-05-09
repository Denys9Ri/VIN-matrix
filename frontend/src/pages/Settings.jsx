import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    user: { first_name: '', email: '', username: '' },
    company: { name: '' }
  });
  const [loading, setLoading] = useState(true);

  // Твоя адреса бекенду
  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('access');
        
        // Якщо токена взагалі немає в пам'яті - тоді на вхід
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get(`${API_BASE}/api/settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setProfile(response.data);
      } catch (error) {
        console.error("Помилка завантаження:", error);
        // Якщо токен прострочений (401), тільки тоді виходимо
        if (error.response?.status === 401) {
          localStorage.removeItem('access');
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh');
      const accessToken = localStorage.getItem('access');
      
      await axios.post(`${API_BASE}/api/logout/`, 
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (e) {
      console.log("Очищення сесії...");
    } finally {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="font-bold text-slate-600">Завантаження профілю...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-black uppercase mb-8 italic">Налаштування</h1>
      
      <div className="space-y-4">
        {/* ПРОФІЛЬ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><User size={24}/></div>
            <div>
              <p className="font-black text-slate-900">
                {profile.user.first_name || profile.user.username} (Власник)
              </p>
              <p className="text-slate-400 text-sm">{profile.user.email || 'Email не вказано'}</p>
            </div>
          </div>
          <button className="text-blue-600 font-bold text-sm hover:underline">Редагувати</button>
        </div>

        {/* СТО */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-xl text-orange-600"><Store size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Мій Бізнес</p>
              <p className="text-slate-400 text-sm">{profile.company.name}</p>
            </div>
          </div>
          <button className="text-orange-600 font-bold text-sm hover:underline">Змінити назву</button>
        </div>

        {/* ВИХІД */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl text-red-600"><LogOut size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Завершити роботу</p>
              <p className="text-slate-400 text-sm">Вихід з акаунта</p>
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
