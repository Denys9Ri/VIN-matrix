import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save, Key, Plus, Trash2, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ user: { first_name: '', email: '', username: '' }, company: { name: '' } });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Стани для модалок
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Стани для форм
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [formData, setFormData] = useState({ first_name: '', email: '', company_name: '' });
  const [saveLoading, setSaveLoading] = useState(false);
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      if (!token) {
        navigate('/login');
        return;
      }
      const [profileRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/services/`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProfile(profileRes.data);
      setServices(servicesRes.data);
      
      // Заповнюємо форму редагування поточними даними
      setFormData({
        first_name: profileRes.data.user.first_name || '',
        email: profileRes.data.user.email || '',
        company_name: profileRes.data.company.name || ''
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

  // --- ЛОГІКА ПОСЛУГ ---
  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/services/`, newService, { headers: { Authorization: `Bearer ${token}` } });
      setNewService({ name: '', price: '' });
      fetchData();
    } catch (e) { alert("Помилка додавання послуги"); }
  };

  const handleDeleteService = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (e) { alert("Помилка видалення"); }
  };

  // --- ЗМІНА ПАРОЛЯ ---
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) return alert("Паролі не збігаються");
    try {
      await axios.post(`${API_BASE}/api/change-password/`, 
        { old_password: passData.old, new_password: passData.new },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Пароль успішно змінено!");
      setIsChangingPassword(false);
      setPassData({ old: '', new: '', confirm: '' });
    } catch (e) { alert(e.response?.data?.error || "Помилка зміни пароля"); }
  };

  // --- РЕДАГУВАННЯ ПРОФІЛЮ ТА СТО ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await axios.patch(`${API_BASE}/api/settings/`, {
        user: { first_name: formData.first_name, email: formData.email },
        company: { name: formData.company_name }
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await fetchData();
      setIsEditingProfile(false);
    } catch (error) {
      alert("Не вдалося зберегти дані. Перевірте з'єднання.");
    } finally {
      setSaveLoading(false);
    }
  };

  // --- ВИХІД ---
  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      await axios.post(`${API_BASE}/api/logout/`, { refresh: refreshToken }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      console.log("Очищення сесії...");
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 relative">
      <h1 className="text-2xl font-black uppercase italic">Налаштування</h1>
      
      {/* ПРОФІЛЬ ТА БЕЗПЕКА */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative">
            <div className="bg-blue-100 w-12 h-12 rounded-xl text-blue-600 flex items-center justify-center mb-4"><User size={24}/></div>
            <p className="font-black text-slate-900 text-lg">{profile.company.name}</p>
            <p className="font-bold text-slate-700">{profile.user.first_name || profile.user.username}</p>
            <p className="text-slate-400 text-sm mb-4">{profile.user.email || 'Email не вказано'}</p>
            <button onClick={() => setIsEditingProfile(true)} className="text-blue-600 font-bold text-sm hover:underline">Редагувати профіль</button>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="bg-purple-100 w-12 h-12 rounded-xl text-purple-600 flex items-center justify-center mb-4"><Key size={24}/></div>
              <p className="font-black text-slate-900">Безпека</p>
              <p className="text-slate-400 text-sm mb-4">Керування паролем та доступом</p>
            </div>
            <div className="flex justify-between items-center">
              <button onClick={() => setIsChangingPassword(true)} className="text-purple-600 font-bold text-sm hover:underline">Змінити пароль</button>
              <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Вийти з акаунта"><LogOut size={20}/></button>
            </div>
        </div>
      </div>

      {/* ПРАЙС-ЛИСТ ПОСЛУГ */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-black uppercase text-sm tracking-wider flex items-center gap-2">
            <DollarSign size={18} className="text-green-600"/> Прайс-лист послуг
          </h2>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleAddService} className="flex gap-2 mb-6">
            <input 
              required type="text" placeholder="Назва послуги" 
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-medium"
              value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})}
            />
            <input 
              required type="number" placeholder="Ціна (грн)" 
              className="w-32 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-medium"
              value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})}
            />
            <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200">
              <Plus size={20}/>
            </button>
          </form>

          <div className="space-y-2">
            {services.map(service => (
              <div key={service.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all">
                <span className="font-bold text-slate-700">{service.name}</span>
                <div className="flex items-center gap-4">
                  <span className="font-black text-slate-900">{service.price} ₴</span>
                  <button onClick={() => handleDeleteService(service.id)} className="text-slate-300 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-lg">
                    <Trash2 size={18}/>
                  </button>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="text-center text-slate-400 py-8 italic font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">Прайс-лист поки порожній. Додайте першу послугу!</p>}
          </div>
        </div>
      </div>

      {/* МОДАЛКА РЕДАГУВАННЯ ПРОФІЛЮ */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsEditingProfile(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6">Редагування даних</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Ваше ім'я</label>
                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} placeholder="Введіть ваше ім'я" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email для зв'язку</label>
                <input type="email" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="name@example.com" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Назва СТО / Магазину</label>
                <input type="text" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 transition-all font-medium" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
              </div>
              <button type="submit" disabled={saveLoading} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-6 transition-all disabled:opacity-70 shadow-lg shadow-blue-200">
                {saveLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saveLoading ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ЗМІНИ ПАРОЛЯ */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsChangingPassword(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Key className="text-purple-600"/> Зміна пароля</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input required type="password" placeholder="Старий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500 font-medium" value={passData.old} onChange={e => setPassData({...passData, old: e.target.value})}/>
              <input required type="password" placeholder="Новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500 font-medium" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})}/>
              <input required type="password" placeholder="Підтвердіть новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500 font-medium" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})}/>
              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-6 transition-all shadow-lg shadow-purple-200">Оновити пароль</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
