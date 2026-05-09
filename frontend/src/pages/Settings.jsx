import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save, Key, Plus, Trash2, DollarSign, Pencil, Search, ChevronDown, ChevronUp, Image as ImageIcon, MapPin, Phone, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ user: { first_name: '', email: '', username: '' }, company: { name: '', logo: null, phone: '', address: '', document_footer: '', global_margin_percent: 20 } });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Стан для форми профілю (додано нові поля)
  const [formData, setFormData] = useState({
    first_name: '',
    email: '',
    company_name: '',
    phone: '',
    address: '',
    document_footer: '',
    global_margin_percent: 20,
    logo: null
  });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => { fetchData(); }, [navigate]);

  const fetchData = async () => {
    try {
      const [profileRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/services/`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setProfile(profileRes.data);
      setServices(servicesRes.data.sort((a, b) => b.id - a.id));
      
      setFormData({
        first_name: profileRes.data.user.first_name || '',
        email: profileRes.data.user.email || '',
        company_name: profileRes.data.company.name || '',
        phone: profileRes.data.company.phone || '',
        address: profileRes.data.company.address || '',
        document_footer: profileRes.data.company.document_footer || '',
        global_margin_percent: profileRes.data.company.global_margin_percent || 20,
        logo: null
      });
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
    } finally { setLoading(false); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    
    // Використовуємо FormData, бо завантажуємо картинку (логотип)
    const data = new FormData();
    data.append('user[first_name]', formData.first_name);
    data.append('user[email]', formData.email);
    data.append('company[name]', formData.company_name);
    data.append('company[phone]', formData.phone);
    data.append('company[address]', formData.address);
    data.append('company[document_footer]', formData.document_footer);
    data.append('company[global_margin_percent]', formData.global_margin_percent);
    if (formData.logo) {
      data.append('company[logo]', formData.logo);
    }

    try {
      await axios.patch(`${API_BASE}/api/settings/`, data, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      await fetchData();
      setIsEditingProfile(false);
    } catch (error) {
      alert("Помилка збереження. Переконайтеся, що на сервері виконані міграції.");
    } finally { setSaveLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 p-4">
      <h1 className="text-2xl font-black uppercase italic">Налаштування R16</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* КАРТКА СТО ТА ЛОГО */}
        <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-2xl flex-shrink-0 overflow-hidden border-2 border-slate-50 flex items-center justify-center">
              {profile.company.logo ? (
                <img src={profile.company.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="text-slate-300" size={32} />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-900">{profile.company.name}</h2>
              <div className="space-y-1 mt-2">
                <p className="text-slate-500 text-sm flex items-center gap-2"><MapPin size={14}/> {profile.company.address || 'Адреса не вказана'}</p>
                <p className="text-slate-500 text-sm flex items-center gap-2"><Phone size={14}/> {profile.company.phone || 'Телефон не вказаний'}</p>
                <p className="text-blue-600 text-sm font-bold flex items-center gap-2"><DollarSign size={14}/> Націнка: {profile.company.global_margin_percent}%</p>
              </div>
              <button onClick={() => setIsEditingProfile(true)} className="mt-4 text-blue-600 font-bold text-sm hover:underline">Змінити реквізити та лого</button>
            </div>
        </div>

        {/* ШВИДКА БЕЗПЕКА */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="bg-purple-100 w-10 h-10 rounded-xl text-purple-600 flex items-center justify-center"><Key size={20}/></div>
            <button onClick={() => setIsChangingPassword(true)} className="text-purple-600 font-bold text-sm hover:underline mt-4">Змінити пароль</button>
            <button onClick={() => navigate('/login')} className="text-red-400 font-bold text-sm hover:underline mt-2">Вийти</button>
        </div>
      </div>

      {/* МОДАЛКА РЕДАГУВАННЯ (З новими полями) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Налаштування СТО</h2>
              <button onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">Логотип СТО (для Акта)</label>
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => setFormData({...formData, logo: e.target.files[0]})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Назва СТО</label>
                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Націнка на запчастини (%)</label>
                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black text-blue-600" value={formData.global_margin_percent} onChange={(e) => setFormData({...formData, global_margin_percent: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Телефон</label>
                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Адреса</label>
                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1">Опис / Гарантія (внизу чека)</label>
                <textarea rows="3" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={formData.document_footer} onChange={(e) => setFormData({...formData, document_footer: e.target.value})} placeholder="Напр.: Гарантія на запчастини 14 днів..."></textarea>
              </div>

              <button type="submit" disabled={saveLoading} className="md:col-span-2 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-black uppercase mt-4 transition-all shadow-lg shadow-blue-200">
                {saveLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />} Зберегти всі налаштування
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Тут нижче залишається твій код Прайс-листа послуг */}
    </div>
  );
};

export default Settings;
