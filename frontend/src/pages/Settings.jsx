import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    user: { first_name: '', email: '', username: '' },
    company: { name: '' }
  });
  const [loading, setLoading] = useState(true);
  
  // Стан для модального вікна редагування
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    email: '',
    company_name: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";

  useEffect(() => {
    fetchSettings();
  }, [navigate]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.get(`${API_BASE}/api/settings/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      // Заповнюємо форму поточними даними
      setFormData({
        first_name: response.data.user.first_name || '',
        email: response.data.user.email || '',
        company_name: response.data.company.name || ''
      });
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const accessToken = localStorage.getItem('access_token');
      await axios.post(`${API_BASE}/api/logout/`, 
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (e) {
      console.log("Очищення сесії...");
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  // ФУНКЦІЯ ЗБЕРЕЖЕННЯ НОВИХ ДАНИХ
  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(`${API_BASE}/api/settings/`, {
        user: { 
          first_name: formData.first_name,
          email: formData.email 
        },
        company: { 
          name: formData.company_name 
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Оновлюємо дані на екрані та закриваємо вікно
      await fetchSettings();
      setIsEditing(false);
    } catch (error) {
      console.error("Помилка збереження", error);
      alert("Не вдалося зберегти дані. Перевірте з'єднання.");
    } finally {
      setSaveLoading(false);
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
    <div className="max-w-4xl mx-auto relative">
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
          <button onClick={() => setIsEditing(true)} className="text-blue-600 font-bold text-sm hover:underline">Редагувати</button>
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
          <button onClick={() => setIsEditing(true)} className="text-orange-600 font-bold text-sm hover:underline">Змінити назву</button>
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
          <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors">
            Вийти
          </button>
        </div>
      </div>

      {/* МОДАЛЬНЕ ВІКНО РЕДАГУВАННЯ */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-black mb-6">Редагування даних</h2>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ваше ім'я</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  placeholder="Введіть ваше ім'я"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email для зв'язку</label>
                <input 
                  type="email" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Назва СТО / Магазину</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={saveLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-6 transition-all disabled:opacity-70"
              >
                {saveLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saveLoading ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
