import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save, Key, Plus, Trash2, DollarSign, Pencil, Search, ChevronDown, ChevronUp, Image as ImageIcon, MapPin, Phone, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ user: { first_name: '', email: '', username: '' }, company: { name: '', logo: null, phone: '', address: '', document_footer: '', global_margin_percent: 20 }, role: 'owner' });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Стани модалок
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingMechanic, setIsAddingMechanic] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Послуги
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({ name: '', price: '' });
  const [showAllServices, setShowAllServices] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '', email: '', company_name: '', phone: '', address: '', document_footer: '', global_margin_percent: 20, logo: null
  });

  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  const [mechanicData, setMechanicData] = useState({ username: '', password: '', first_name: '' });

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
      
      if (profileRes.data.role === 'owner') {
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
      }
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
    } finally { setLoading(false); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    const data = new FormData();
    data.append('user[first_name]', formData.first_name);
    data.append('user[email]', formData.email);
    data.append('company[name]', formData.company_name);
    data.append('company[phone]', formData.phone);
    data.append('company[address]', formData.address);
    data.append('company[document_footer]', formData.document_footer);
    data.append('company[global_margin_percent]', formData.global_margin_percent);
    if (formData.logo) data.append('company[logo]', formData.logo);

    try {
      await axios.patch(`${API_BASE}/api/settings/`, data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      alert("Налаштування успішно збережено!");
      await fetchData();
      setIsEditingProfile(false);
    } catch (error) { alert("Помилка збереження."); } 
    finally { setSaveLoading(false); }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/services/`, newService, { headers: { Authorization: `Bearer ${token}` } });
      setNewService({ name: '', price: '' });
      fetchData();
    } catch (e) { alert("Помилка додавання"); }
  };

  const handleUpdateService = async (id) => {
    try {
      await axios.patch(`${API_BASE}/api/services/${id}/`, editServiceData, { headers: { Authorization: `Bearer ${token}` } });
      setEditingServiceId(null);
      fetchData();
    } catch (e) { alert("Помилка оновлення"); }
  };

  const handleDeleteService = async (id) => {
    if (window.confirm("Видалити послугу?")) {
      try {
        await axios.delete(`${API_BASE}/api/services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        fetchData();
      } catch (e) { alert("Помилка видалення"); }
    }
  };

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

  const handleAddMechanic = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/mechanics/add/`, mechanicData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Майстра успішно додано!");
      setIsAddingMechanic(false);
      setMechanicData({ username: '', password: '', first_name: '' });
    } catch (error) {
      alert(error.response?.data?.error || "Помилка при додаванні майстра.");
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">R16 ЗАВАНТАЖЕННЯ...</div>;

  // === ІНТЕРФЕЙС МАЙСТРА ===
  if (profile.role === 'mechanic') {
    return (
      <div className="max-w-md mx-auto pt-20 text-center space-y-8 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="bg-blue-100 w-20 h-20 rounded-3xl text-blue-600 flex items-center justify-center mx-auto mb-6">
            <User size={40}/>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{profile.user.first_name || profile.user.username}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{profile.company.name} • Майстер</p>
          
          <button onClick={() => {localStorage.clear(); navigate('/login');}} className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-4 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-red-100 transition-colors">
            <LogOut size={20}/> Вийти з акаунта
          </button>
        </div>
      </div>
    );
  }

  // === ІНТЕРФЕЙС ВЛАСНИКА ===
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayedServices = (showAllServices || searchQuery) ? filteredServices : filteredServices.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 p-4">
      <h1 className="text-2xl font-black uppercase italic">Налаштування R16</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-6">
            <div className="w-24 h-24 bg-slate-50 rounded-2xl flex-shrink-0 overflow-hidden border-2 border-slate-100 flex items-center justify-center">
              {profile.company.logo ? (
                <img src={profile.company.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : <ImageIcon className="text-slate-300" size={32} />}
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

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-100 w-10 h-10 rounded-xl text-purple-600 flex items-center justify-center"><Key size={20}/></div>
                <div className="bg-green-100 w-10 h-10 rounded-xl text-green-600 flex items-center justify-center"><Users size={20}/></div>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={() => setIsAddingMechanic(true)} className="w-full text-green-600 font-bold text-sm hover:bg-green-50 p-2 rounded-lg text-left transition-colors">+ Додати майстра</button>
              <button onClick={() => setIsChangingPassword(true)} className="w-full text-purple-600 font-bold text-sm hover:bg-purple-50 p-2 rounded-lg text-left transition-colors">Змінити мій пароль</button>
              <button onClick={() => {localStorage.clear(); navigate('/login');}} className="w-full text-red-500 font-bold text-sm hover:bg-red-50 p-2 rounded-lg text-left transition-colors">Вийти</button>
            </div>
        </div>
      </div>

      {/* ПРАЙС-ЛИСТ (без змін) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <h2 className="font-black uppercase text-sm tracking-wider flex items-center gap-2"><DollarSign size={18} className="text-green-600"/> Прайс послуг</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Пошук послуги..." className="w-full border rounded-lg py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleAddService} className="flex gap-2 mb-6">
            <input required type="text" placeholder="Назва послуги" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 outline-none focus:border-blue-500" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
            <input required type="number" placeholder="Ціна" className="w-24 bg-slate-50 border rounded-xl px-4 py-2 outline-none focus:border-blue-500" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
            <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all"><Plus size={20}/></button>
          </form>

          <div className="space-y-2">
            {displayedServices.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all">
                {editingServiceId === s.id ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <input type="text" className="flex-1 bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-1 outline-none text-sm font-medium" value={editServiceData.name} onChange={e => setEditServiceData({...editServiceData, name: e.target.value})} />
                    <input type="number" className="w-24 bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-1 outline-none text-sm font-medium" value={editServiceData.price} onChange={e => setEditServiceData({...editServiceData, price: e.target.value})} />
                    <button onClick={() => handleUpdateService(s.id)} className="bg-green-100 text-green-600 p-2 rounded-lg"><Save size={18}/></button>
                    <button onClick={() => setEditingServiceId(null)} className="bg-slate-100 text-slate-600 p-2 rounded-lg"><X size={18}/></button>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-slate-700">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 mr-2">{s.price} ₴</span>
                      <button onClick={() => { setEditingServiceId(s.id); setEditServiceData({ name: s.name, price: s.price }); }} className="text-slate-400 hover:text-blue-600 p-2 rounded-lg"><Pencil size={18}/></button>
                      <button onClick={() => handleDeleteService(s.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-lg"><Trash2 size={18}/></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* МОДАЛКА ДОДАВАННЯ МАЙСТРА */}
      {isAddingMechanic && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsAddingMechanic(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Users className="text-green-600"/> Новий майстер</h2>
            <form onSubmit={handleAddMechanic} className="space-y-4">
              <input required type="text" placeholder="Ім'я майстра (напр. Іван)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium" value={mechanicData.first_name} onChange={e => setMechanicData({...mechanicData, first_name: e.target.value})}/>
              <input required type="text" placeholder="Логін для входу" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium" value={mechanicData.username} onChange={e => setMechanicData({...mechanicData, username: e.target.value})}/>
              <input required type="password" placeholder="Пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium" value={mechanicData.password} onChange={e => setMechanicData({...mechanicData, password: e.target.value})}/>
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-6 transition-all shadow-lg shadow-green-200">Створити акаунт</button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ЗМІНИ ПАРОЛЯ */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsChangingPassword(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Key className="text-purple-600"/> Зміна пароля</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input required type="password" placeholder="Старий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500" value={passData.old} onChange={e => setPassData({...passData, old: e.target.value})}/>
              <input required type="password" placeholder="Новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})}/>
              <input required type="password" placeholder="Підтвердіть новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-purple-500" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})}/>
              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black uppercase">Оновити пароль</button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА РЕДАГУВАННЯ ПРОФІЛЮ */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black italic uppercase">Налаштування СТО</h2>
              <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300">
                <label className="block text-xs font-black uppercase text-slate-500 mb-2">Логотип (PNG/JPG)</label>
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => setFormData({...formData, logo: e.target.files[0]})} />
              </div>
              <div><label className="text-xs font-black uppercase text-slate-500">Назва СТО</label><input type="text" className="w-full bg-slate-50 border rounded-xl py-3 px-4" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} /></div>
              <div><label className="text-xs font-black uppercase text-slate-500">Націнка (%)</label><input type="number" className="w-full bg-slate-50 border rounded-xl py-3 px-4 font-black text-blue-600" value={formData.global_margin_percent} onChange={e => setFormData({...formData, global_margin_percent: e.target.value})} /></div>
              <div><label className="text-xs font-black uppercase text-slate-500">Телефон</label><input type="text" className="w-full bg-slate-50 border rounded-xl py-3 px-4" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><label className="text-xs font-black uppercase text-slate-500">Адреса</label><input type="text" className="w-full bg-slate-50 border rounded-xl py-3 px-4" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div className="md:col-span-2"><label className="text-xs font-black uppercase text-slate-500">Текст у підвалі (Гарантія)</label><textarea rows="3" className="w-full bg-slate-50 border rounded-xl py-3 px-4" value={formData.document_footer} onChange={e => setFormData({...formData, document_footer: e.target.value})}></textarea></div>
              <button type="submit" disabled={saveLoading} className="md:col-span-2 w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-200">
                {saveLoading ? <Loader2 className="animate-spin mx-auto" /> : "ЗБЕРЕГТИ ВСІ НАЛАШТУВАННЯ"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
