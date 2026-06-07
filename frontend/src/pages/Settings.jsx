import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Loader2, X, Save, Key, Plus, Trash2, DollarSign, Pencil, Image as ImageIcon, MapPin, Phone, Users, ShieldAlert, FileText, FileSpreadsheet, Wrench, ArrowRight, Building2, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    user: { first_name: '', email: '', username: '' },
    company: { name: '', logo: null, phone: '', address: '', document_footer: '', global_margin_percent: 20, business_type: 'sto' },
    role: 'owner'
  });
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isAddingMechanic, setIsAddingMechanic] = useState(false);
  const [isEditingMechanic, setIsEditingMechanic] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', email: '', company_name: '', phone: '', address: '', document_footer: '', global_margin_percent: 20, logo: null, business_type: 'sto' });
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  const [mechanicData, setMechanicData] = useState({ username: '', password: '', first_name: '', can_create_visits: false, can_view_finances: false });
  const [editMechanicData, setEditMechanicData] = useState({ first_name: '', new_password: '', can_create_visits: false, can_view_finances: false });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => { fetchData(); }, [navigate]);

  const fetchData = async () => {
    try {
      const profileRes = await axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(profileRes.data);
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
    } catch { alert("Помилка збереження."); }
    finally { setSaveLoading(false); }
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
      } catch { alert("Помилка видалення"); }
    }
  };

  const handleUpdateMechanic = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/api/mechanics/${isEditingMechanic}/`, editMechanicData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Дані працівника оновлено!");
      setIsEditingMechanic(null);
      fetchData();
    } catch { alert("Помилка оновлення"); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">VIN-MATRIX ЗАВАНТАЖЕННЯ...</div>;

  if (profile.role === 'mechanic') {
    return (
      <div className="max-w-md mx-auto pt-20 text-center space-y-8 p-4 w-full">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="bg-blue-100 w-20 h-20 rounded-3xl text-blue-600 flex items-center justify-center mx-auto mb-6"><User size={40}/></div>
          <h1 className="text-2xl font-black text-slate-900">{profile.user.first_name || profile.user.username}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{profile.company.name} • Працівник</p>
          <button onClick={() => {localStorage.clear(); navigate('/login');}} className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-4 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-red-100 transition-colors"><LogOut size={20}/> Вийти з акаунта</button>
        </div>
      </div>
    );
  }

  const isSto = profile.company.business_type === 'sto';
  const sectionCards = [
    ...(isSto ? [{ icon: <Wrench size={22}/>, title: 'Послуги', desc: 'Прайс робіт і стандартних послуг', path: '/settings/services' }] : []),
    { icon: <FileText size={22}/>, title: 'Документи', desc: 'Реквізити, гарантія, підписи та текст бланків', path: '/settings/documents' },
    { icon: <FileSpreadsheet size={22}/>, title: 'Дані', desc: 'Імпорт, експорт і резервна копія бізнесу', path: '/data' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 p-3 md:p-6 w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase italic text-slate-900">Налаштування</h1>
          <p className="text-sm md:text-base text-slate-500 font-semibold mt-2 max-w-2xl">Керуйте компанією, документами, прайсом, командою та даними системи.</p>
        </div>
        <button onClick={() => {localStorage.clear(); navigate('/login');}} className="self-start md:self-auto flex items-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 px-4 py-3 rounded-2xl font-black text-xs uppercase transition-all shrink-0"><LogOut size={17}/> Вийти</button>
      </div>

      <div className={`grid grid-cols-1 ${sectionCards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {sectionCards.map((card) => <SettingsNavCard key={card.title} {...card} onClick={() => navigate(card.path)} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-blue-700 to-cyan-500 p-5 md:p-6 text-white">
              <div className="flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest"><Building2 size={15}/> Профіль компанії</div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-5">
                <div className="w-24 h-24 bg-white/95 rounded-3xl flex-shrink-0 overflow-hidden border border-white/30 shadow-xl flex items-center justify-center">
                  {profile.company.logo ? <img src={profile.company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={34} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl md:text-3xl font-black truncate">{profile.company.name}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white">{isSto ? 'СТО' : 'Магазин'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm font-bold text-blue-50">
                    <p className="flex items-center gap-2 min-w-0"><MapPin size={15} className="shrink-0"/><span className="truncate">{profile.company.address || 'Адреса не вказана'}</span></p>
                    <p className="flex items-center gap-2"><Phone size={15} className="shrink-0"/> {profile.company.phone || 'Телефон не вказаний'}</p>
                    <p className="flex items-center gap-2"><DollarSign size={15} className="shrink-0"/> Націнка: {profile.company.global_margin_percent}%</p>
                    <p className="flex items-center gap-2"><BadgeCheck size={15} className="shrink-0"/> Активний профіль</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 uppercase">Бізнес-ідентичність</h3>
                <p className="text-sm font-semibold text-slate-500 mt-1">Логотип, назва, адреса, телефон, режим роботи та базова націнка.</p>
              </div>
              <button onClick={() => setIsEditingProfile(true)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-100 transition">Змінити реквізити</button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-5 md:p-6 rounded-[28px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-800"><ShieldAlert className="text-purple-600" size={18}/> Безпека</h3>
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-purple-50 text-purple-700">Акаунт</span>
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-4">Зміна пароля для входу в систему.</p>
            <button onClick={() => setIsChangingPassword(true)} className="w-full bg-slate-50 text-slate-800 font-black text-xs uppercase hover:bg-slate-100 p-4 rounded-2xl transition-all">Змінити мій пароль</button>
          </div>

          {isSto && (
            <div className="bg-white rounded-[28px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 md:p-6 bg-slate-50/70 border-b border-slate-100 flex justify-between items-center gap-2">
                <div>
                  <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-800"><Users className="text-green-600 shrink-0" size={18}/> Команда СТО</h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">Працівники та доступи</p>
                </div>
                <button onClick={() => setIsAddingMechanic(true)} className="bg-green-100 text-green-700 p-3 rounded-2xl hover:bg-green-200 transition-all shrink-0"><Plus size={17}/></button>
              </div>
              <div className="p-3 md:p-4 space-y-2">
                {mechanics.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">Немає працівників</p> : mechanics.map(m => (
                  <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center gap-2 group">
                    <div className="overflow-hidden pr-2"><p className="font-black text-sm text-slate-800 truncate">{m.first_name}</p><p className="text-[10px] sm:text-xs text-slate-500 truncate">Логін: {m.username}</p></div>
                    <div className="flex gap-1 transition-all shrink-0">
                      <button onClick={() => { setIsEditingMechanic(m.id); setEditMechanicData({ first_name: m.first_name, new_password: '', can_create_visits: m.can_create_visits || false, can_view_finances: m.can_view_finances || false }); }} className="bg-white text-slate-400 hover:text-blue-600 p-2 rounded-xl shadow-sm"><Pencil size={14}/></button>
                      <button onClick={() => handleDeleteMechanic(m.id)} className="bg-white text-slate-400 hover:text-red-500 p-2 rounded-xl shadow-sm"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddingMechanic && <MechanicCreateModal mechanicData={mechanicData} setMechanicData={setMechanicData} onClose={() => setIsAddingMechanic(false)} onSubmit={handleAddMechanic} />}
      {isEditingMechanic && <MechanicEditModal editMechanicData={editMechanicData} setEditMechanicData={setEditMechanicData} onClose={() => setIsEditingMechanic(null)} onSubmit={handleUpdateMechanic} />}
      {isEditingProfile && <ProfileModal formData={formData} setFormData={setFormData} saveLoading={saveLoading} onClose={() => setIsEditingProfile(false)} onSubmit={handleSaveProfile} />}
      {isChangingPassword && <PasswordModal passData={passData} setPassData={setPassData} onClose={() => setIsChangingPassword(false)} onSubmit={handleChangePassword} />}
    </div>
  );
};

function SettingsNavCard({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="group bg-white border border-slate-100 rounded-[28px] p-5 text-left shadow-sm hover:border-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-4 min-h-[118px]">
      <span className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black uppercase text-slate-900 text-base">{title}</span>
        <span className="block text-xs font-bold text-slate-500 mt-1 leading-snug">{desc}</span>
      </span>
      <span className="w-9 h-9 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition"><ArrowRight size={17}/></span>
    </button>
  );
}

function MechanicCreateModal({ mechanicData, setMechanicData, onClose, onSubmit }) {
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative"><button onClick={onClose} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20}/></button><h2 className="text-xl font-black mb-6 flex items-center gap-2"><Users className="text-green-600"/> Новий працівник</h2><form onSubmit={onSubmit} className="space-y-4"><input required type="text" placeholder="Ім'я" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.first_name} onChange={e => setMechanicData({...mechanicData, first_name: e.target.value})}/><input required type="text" placeholder="Логін для входу" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.username} onChange={e => setMechanicData({...mechanicData, username: e.target.value})}/><input required type="password" placeholder="Пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-green-500 font-medium text-sm" value={mechanicData.password} onChange={e => setMechanicData({...mechanicData, password: e.target.value})}/><Permissions value={mechanicData} setValue={setMechanicData}/><button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-black hover:bg-green-700">Створити</button></form></div></div>;
}

function MechanicEditModal({ editMechanicData, setEditMechanicData, onClose, onSubmit }) {
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative"><button onClick={onClose} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20}/></button><h2 className="text-xl font-black mb-6 flex items-center gap-2"><Pencil className="text-blue-600"/> Редагування працівника</h2><form onSubmit={onSubmit} className="space-y-4"><input required type="text" placeholder="Ім'я" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={editMechanicData.first_name} onChange={e => setEditMechanicData({...editMechanicData, first_name: e.target.value})}/><input type="password" placeholder="Новий пароль (залишити пустим, якщо не міняти)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium text-sm" value={editMechanicData.new_password} onChange={e => setEditMechanicData({...editMechanicData, new_password: e.target.value})}/><Permissions value={editMechanicData} setValue={setEditMechanicData}/><button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700">Зберегти зміни</button></form></div></div>;
}

function Permissions({ value, setValue }) {
  return <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-3"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Права доступу</p><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={value.can_create_visits} onChange={e => setValue({...value, can_create_visits: e.target.checked})}/><span className="text-sm font-bold text-slate-700">Може створювати записи/авто</span></label><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={value.can_view_finances} onChange={e => setValue({...value, can_view_finances: e.target.checked})}/><span className="text-sm font-bold text-slate-700">Бачить фінанси</span></label></div>;
}

function ProfileModal({ formData, setFormData, saveLoading, onClose, onSubmit }) {
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"><button onClick={onClose} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20}/></button><h2 className="text-xl font-black mb-6 flex items-center gap-2"><Store className="text-blue-600"/> Реквізити</h2><form onSubmit={onSubmit} className="space-y-4"><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold" placeholder="Назва бізнесу" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})}/><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Телефон" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/><input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Націнка %" value={formData.global_margin_percent} onChange={e => setFormData({...formData, global_margin_percent: e.target.value})}/></div><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Адреса" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}/><div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Режим роботи</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setFormData({...formData, business_type: 'sto'})} className={`py-3 rounded-xl font-black text-xs uppercase ${formData.business_type === 'sto' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>СТО</button><button type="button" onClick={() => setFormData({...formData, business_type: 'store'})} className={`py-3 rounded-xl font-black text-xs uppercase ${formData.business_type === 'store' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Магазин</button></div></div><textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" placeholder="Текст у чеку" value={formData.document_footer} onChange={e => setFormData({...formData, document_footer: e.target.value})}/><label className="block bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"><ImageIcon className="mx-auto mb-2 text-slate-400" size={24}/><span className="text-sm font-bold text-slate-500">Завантажити логотип</span><input type="file" className="hidden" accept="image/*" onChange={e => setFormData({...formData, logo: e.target.files[0]})}/></label><button disabled={saveLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center justify-center gap-2">{saveLoading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Зберегти</button></form></div></div>;
}

function PasswordModal({ passData, setPassData, onClose, onSubmit }) {
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative"><button onClick={onClose} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20}/></button><h2 className="text-xl font-black mb-6 flex items-center gap-2"><Key className="text-blue-600"/> Новий пароль</h2><form onSubmit={onSubmit} className="space-y-4"><input required type="password" placeholder="Старий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.old} onChange={e => setPassData({...passData, old: e.target.value})}/><input required type="password" placeholder="Новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})}/><input required type="password" placeholder="Повторіть новий пароль" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})}/><button className="w-full bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700">Змінити пароль</button></form></div></div>;
}

export default Settings;
