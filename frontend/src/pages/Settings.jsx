import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save, Key, Plus, Trash2, DollarSign, Pencil, Search, ChevronDown, ChevronUp, Image as ImageIcon, MapPin, Phone, Users, ShieldAlert, Wrench, CheckSquare, FileText, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ 
    user: { first_name: '', email: '', username: '' }, 
    company: { name: '', logo: null, phone: '', address: '', document_footer: '', global_margin_percent: 20, business_type: 'sto' }, 
    role: 'owner' 
  });
  const [services, setServices] = useState([]);
  const [mechanics, setMechanics] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingMechanic, setIsAddingMechanic] = useState(false);
  const [isEditingMechanic, setIsEditingMechanic] = useState(null); 
  const [saveLoading, setSaveLoading] = useState(false);

  const [newService, setNewService] = useState({ name: '', price: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({ name: '', price: '' });
  const [showAllServices, setShowAllServices] = useState(false);

  const [formData, setFormData] = useState({ first_name: '', email: '', company_name: '', phone: '', address: '', document_footer: '', global_margin_percent: 20, logo: null, business_type: 'sto' });
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  
  const [mechanicData, setMechanicData] = useState({ username: '', password: '', first_name: '', can_create_visits: false, can_view_finances: false });
  const [editMechanicData, setEditMechanicData] = useState({ first_name: '', new_password: '', can_create_visits: false, can_view_finances: false });

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
        const mechanicsRes = await axios.get(`${API_BASE}/api/mechanics/`, { headers: { Authorization: `Bearer ${token}` } });
        setMechanics(mechanicsRes.data);
        
        setFormData({
          first_name: profileRes.data.user.first_name || '',
          email: profileRes.data.user.email || '',
          company_name: profileRes.data.company.name || '',
          phone: profileRes.data.company.phone || '',
          address: profileRes.data.company.address || '',
          document_footer: profileRes.data.company.document_footer || '',
          global_margin_percent: profileRes.data.company.global_margin_percent || 20,
          business_type: profileRes.data.company.business_type || 'sto',
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
    data.append('company[name]', formData.company_name);
    data.append('company[phone]', formData.phone);
    data.append('company[address]', formData.address);
    data.append('company[document_footer]', formData.document_footer);
    data.append('company[global_margin_percent]', formData.global_margin_percent);
    data.append('company[business_type]', formData.business_type); 
    if (formData.logo) data.append('company[logo]', formData.logo);
    try {
      await axios.patch(`${API_BASE}/api/settings/`, data, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      alert("Налаштування збережено!");
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
      await axios.post(`${API_BASE}/api/change-password/`, { old_password: passData.old, new_password: passData.new }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Пароль змінено!");
      setIsChangingPassword(false);
      setPassData({ old: '', new: '', confirm: '' });
    } catch (e) { alert(e.response?.data?.error || "Помилка зміни пароля"); }
  };

  const handleAddMechanic = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/mechanics/`, mechanicData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Працівника додано!");
      setIsAddingMechanic(false);
      setMechanicData({ username: '', password: '', first_name: '', can_create_visits: false, can_view_finances: false });
      fetchData();
    } catch (error) { alert(error.response?.data?.error || "Помилка. Логін може бути зайнятий."); }
  };

  const handleDeleteMechanic = async (id) => {
    if (window.confirm("Видалити цього працівника назавжди?")) {
      try {
        await axios.delete(`${API_BASE}/api/mechanics/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        fetchData();
      } catch (e) { alert("Помилка видалення"); }
    }
  };

  const handleUpdateMechanic = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/api/mechanics/${isEditingMechanic}/`, editMechanicData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Дані працівника оновлено!");
      setIsEditingMechanic(null);
      fetchData();
    } catch (e) { alert("Помилка оновлення"); }
  };


  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">VIN-MATRIX ЗАВАНТАЖЕННЯ...</div>;

  if (profile.role === 'mechanic') {
    return (
      <div className="max-w-md mx-auto pt-20 text-center space-y-8 p-4 w-full">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="bg-blue-100 w-20 h-20 rounded-3xl text-blue-600 flex items-center justify-center mx-auto mb-6">
            <User size={40}/>
          </div>
          <h1 className="text-2xl font-black text-slate-900">{profile.user.first_name || profile.user.username}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{profile.company.name} • Працівник</p>
          <button onClick={() => {localStorage.clear(); navigate('/login');}} className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-4 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-red-100 transition-colors">
            <LogOut size={20}/> Вийти з акаунта
          </button>
        </div>
      </div>
    );
  }

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayedServices = (showAllServices || searchQuery) ? filteredServices : filteredServices.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 p-3 md:p-4 w-full overflow-x-hidden">
      <div className="flex justify-between items-center mt-4 md:mt-0">
        <h1 className="text-xl md:text-2xl font-black uppercase italic truncate pr-2">Налаштування</h1>
        <button onClick={() => {localStorage.clear(); navigate('/login');}} className="flex items-center gap-2 text-red-500 font-bold hover:bg-red-50 p-2 md:px-4 md:py-2 rounded-xl transition-all shrink-0">
          <LogOut size={18}/> <span className="hidden sm:inline">Вийти</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SettingsNavCard icon={<DollarSign size={20}/>} title="Послуги" desc="Прайс робіт і стандартних послуг" onClick={() => document.getElementById('services-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <SettingsNavCard icon={<FileText size={20}/>} title="Документи" desc="Реквізити, гарантія і підписи" onClick={() => navigate('/settings/documents')} />
        <SettingsNavCard icon={<FileSpreadsheet size={20}/>} title="Дані" desc="Імпорт, експорт і резервна копія" onClick={() => navigate('/data')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start text-center sm:text-left">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-2xl flex-shrink-0 overflow-hidden border-2 border-slate-100 flex items-center justify-center">
                {profile.company.logo ? (
                  <img src={profile.company.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : <ImageIcon className="text-slate-300" size={32} />}
              </div>
              <div className="flex-1 w-full">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">{profile.company.name}</h2>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${profile.company.business_type === 'store' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {profile.company.business_type === 'store' ? 'Магазин' : 'СТО'}
                  </span>
                </div>
                
                <div className="space-y-1 mt-2">
                  <p className="text-slate-500 text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 truncate"><MapPin size={14} className="shrink-0"/> <span className="truncate">{profile.company.address || 'Адреса не вказана'}</span></p>
                  <p className="text-slate-500 text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2"><Phone size={14} className="shrink-0"/> {profile.company.phone || 'Телефон не вказаний'}</p>
                  <p className="text-blue-600 text-xs sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-2"><DollarSign size={14} className="shrink-0"/> Націнка: {profile.company.global_margin_percent}%</p>
                </div>
                <button onClick={() => setIsEditingProfile(true)} className="mt-4 w-full sm:w-auto bg-slate-100 sm:bg-transparent px-4 py-2 sm:p-0 rounded-lg text-blue-600 font-bold text-sm sm:hover:underline transition-colors">Змінити реквізити та лого</button>
              </div>
          </div>

          {profile.company.business_type === 'sto' && (
            <div id="services-settings" className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden scroll-mt-24">
              <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                <h2 className="font-black uppercase text-sm tracking-wider flex items-center gap-2"><DollarSign size={18} className="text-green-600"/> Прайс послуг</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Пошук послуги..." className="w-full border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="p-4 md:p-6">
                <form onSubmit={handleAddService} className="flex flex-col sm:flex-row gap-2 mb-6">
                  <input required type="text" placeholder="Назва послуги" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-medium" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                  <div className="flex gap-2">
                    <input required type="number" placeholder="Ціна" className="flex-1 sm:w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500 font-black" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                    <button type="submit" className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center shrink-0"><Plus size={20}/></button>
                  </div>
                </form>

                <div className="space-y-2">
                  {displayedServices.map(s => (
                    <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all gap-2">
                      {editingServiceId === s.id ? (
                        <div className="w-full flex flex-col sm:flex-row gap-2 items-center">
                          <input type="text" className="w-full sm:flex-1 bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2 outline-none text-sm font-medium" value={editServiceData.name} onChange={e => setEditServiceData({...editServiceData, name: e.target.value})} />
                          <div className="w-full sm:w-auto flex gap-2">
                            <input type="number" className="flex-1 sm:w-24 bg-slate-50 border-2 border-blue-200 rounded-lg px-3 py-2 outline-none text-sm font-black" value={editServiceData.price} onChange={e => setEditServiceData({...editServiceData, price: e.target.value})} />
                            <button onClick={() => handleUpdateService(s.id)} className="bg-green-100 text-green-600 px-3 rounded-lg"><Save size={18}/></button>
                            <button onClick={() => setEditingServiceId(null)} className="bg-slate-100 text-slate-600 px-3 rounded-lg"><X size={18}/></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="font-bold text-slate-700 text-sm sm:text-base leading-tight pr-2">{s.name}</span>
                          <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-50">
                            <span className="font-black text-slate-900 text-sm sm:text-base mr-2">{s.price} ₴</span>
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingServiceId(s.id); setEditServiceData({ name: s.name, price: s.price }); }} className="text-slate-400 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-lg transition-colors"><Pencil size={16}/></button>
                              <button onClick={() => handleDeleteService(s.id)} className="text-slate-400 bg-slate-50 hover:bg-red-50 hover:text-red-500 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {filteredServices.length > 5 && (
                    <button onClick={() => setShowAllServices(!showAllServices)} className="w-full py-4 text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50/50 rounded-2xl mt-4 flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                      {showAllServices ? <><ChevronUp size={16}/> Сховати список</> : <><ChevronDown size={16}/> Показати всі ({filteredServices.length})</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 text-slate-700">
                <ShieldAlert className="text-purple-600" size={18}/> Безпека
              </h3>
              <button onClick={() => setIsChangingPassword(true)} className="w-full bg-slate-50 text-slate-700 font-bold text-sm hover:bg-slate-100 p-3 rounded-xl transition-all">
                Змінити мій пароль
              </button>
          </div>

          {profile.company.business_type === 'sto' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-50 flex justify-between items-center gap-2">
                  <h3 className="font-black uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 text-slate-700 truncate">
                    <Users className="text-green-600 shrink-0" size={18}/> Команда СТО
                  </h3>
                  <button onClick={() => setIsAddingMechanic(true)} className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200 transition-all shrink-0"><Plus size={16}/></button>
                </div>
                <div className="p-3 md:p-4 space-y-2">
                  {mechanics.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">Немає працівників</p>
                  ) : (
                    mechanics.map(m => (
                      <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center gap-2 group">
                        <div className="overflow-hidden pr-2">
                          <p className="font-bold text-sm text-slate-800 truncate">{m.first_name}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 truncate">Логін: {m.username}</p>
                        </div>
                        <div className="flex gap-1 lg:opacity-100 xl:opacity-0 group-hover:opacity-100 transition-all shrink-0 self-end xl:self-center">
                          <button onClick={() => {
                            setIsEditingMechanic(m.id); 
                            setEditMechanicData({
                              first_name: m.first_name, 
                              new_password: '',
                              can_create_visits: m.can_create_visits || false,
                              can_view_finances: m.can_view_finances || false
                            });
                          }} className="bg-white text-slate-400 hover:text-blue-600 p-1.5 rounded shadow-sm"><Pencil size={14}/></button>
                          <button onClick={() => handleDeleteMechanic(m.id)} className="bg-white text-slate-400 hover:text-red-500 p-1.5 rounded shadow-sm"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
            </div>
          )}
        </div>
      </div>

      {isAddingMechanic && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsAddingMechanic(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Users className="text-green-600"/> Новий працівник</h2>
            <form onSubmit={handleAddMechanic} className="space-y-4">
              <input required type="text" placeholder="Ім'я" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.first_name} onChange={e => setMechanicData({...mechanicData, first_name: e.target.value})}/>
              <input required type="text" placeholder="Логін для входу" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.username} onChange={e => setMechanicData({...mechanicData, username: e.target.value})}/>
              <input required type="password" placeholder="Пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.password} onChange={e => setMechanicData({...mechanicData, password: e.target.value})}/>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Права доступу</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={mechanicData.can_create_visits} onChange={e => setMechanicData({...mechanicData, can_create_visits: e.target.checked})} />
                  <span className="text-sm font-bold text-slate-700">Може створювати записи/авто</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={mechanicData.can_view_finances} onChange={e => setMechanicData({...mechanicData, can_view_finances: e.target.checked})} />
                  <span className="text-sm font-bold text-slate-700">Бачить фінанси (ціни, загальну касу)</span>
                </label>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-black hover:bg-green-700">Створити</button>
            </form>
          </div>
        </div>
      )}

      {isEditingMechanic && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsEditingMechanic(null)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Pencil className="text-blue-600"/> Редагування працівника</h2>
            <form onSubmit={handleUpdateMechanic} className="space-y-4">
              <input required type="text" placeholder="Ім'я" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={editMechanicData.first_name} onChange={e => setEditMechanicData({...editMechanicData, first_name: e.target.value})}/>
              <input type="password" placeholder="Новий пароль (залишити пустим, якщо не міняти)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={editMechanicData.new_password} onChange={e => setEditMechanicData({...editMechanicData, new_password: e.target.value})}/>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Права доступу</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={editMechanicData.can_create_visits} onChange={e => setEditMechanicData({...editMechanicData, can_create_visits: e.target.checked})} />
                  <span className="text-sm font-bold text-slate-700">Може створювати записи/авто</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={editMechanicData.can_view_finances} onChange={e => setEditMechanicData({...editMechanicData, can_view_finances: e.target.checked})} />
                  <span className="text-sm font-bold text-slate-700">Бачить фінанси</span>
                </label>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700">Зберегти зміни</button>
            </form>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsEditingProfile(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Store className="text-blue-600"/> Реквізити</h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold" placeholder="Назва бізнесу" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})}/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Телефон" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/>
                      <input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Націнка %" value={formData.global_margin_percent} onChange={e => setFormData({...formData, global_margin_percent: e.target.value})}/>
                    </div>
                    <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Адреса" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}/>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Режим роботи</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setFormData({...formData, business_type: 'sto'})} className={`py-3 rounded-xl font-black text-xs uppercase ${formData.business_type === 'sto' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>СТО</button>
                        <button type="button" onClick={() => setFormData({...formData, business_type: 'store'})} className={`py-3 rounded-xl font-black text-xs uppercase ${formData.business_type === 'store' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Магазин</button>
                      </div>
                    </div>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Текст у чеку" value={formData.document_footer} onChange={e => setFormData({...formData, document_footer: e.target.value})}/>
                    <label className="block bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                      <ImageIcon className="mx-auto mb-2 text-slate-400" size={24}/>
                      <span className="text-sm font-bold text-slate-500">Завантажити логотип</span>
                      <input type="file" className="hidden" accept="image/*" onChange={e => setFormData({...formData, logo: e.target.files[0]})}/>
                    </label>
                    <button disabled={saveLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                      {saveLoading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Зберегти
                    </button>
                </form>
            </div>
        </div>
      )}

      {isChangingPassword && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsChangingPassword(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Key className="text-blue-600"/> Новий пароль</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input required type="password" placeholder="Старий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.old} onChange={e => setPassData({...passData, old: e.target.value})}/>
              <input required type="password" placeholder="Новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})}/>
              <input required type="password" placeholder="Повторіть новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})}/>
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700">Змінити пароль</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function SettingsNavCard({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-100 rounded-3xl p-4 text-left shadow-sm hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-start gap-3">
      <span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">{icon}</span>
      <span>
        <span className="block font-black uppercase text-slate-900 text-sm">{title}</span>
        <span className="block text-xs font-bold text-slate-500 mt-1 leading-snug">{desc}</span>
      </span>
    </button>
  );
}

export default Settings;