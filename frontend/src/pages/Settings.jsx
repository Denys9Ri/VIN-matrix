import React, { useState, useEffect } from 'react';
import { LogOut, User, Loader2, X, Save, Key, Plus, Trash2, DollarSign, Pencil, Image as ImageIcon, MapPin, Phone, Users, ShieldAlert, FileText, FileSpreadsheet, Wrench, ArrowRight, Building2, BadgeCheck, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getMechanicUser = (mech = {}) => mech.user || mech.employee_user || mech.profile || {};
const getMechanicName = (mech = {}) => {
  const user = getMechanicUser(mech);
  return user.first_name || user.username || mech.first_name || mech.username || mech.name || `Працівник #${mech.id || ''}`;
};

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
      const nextProfile = profileRes.data || {};
      setProfile({
        user: nextProfile.user || {},
        company: nextProfile.company || {},
        role: nextProfile.role || 'owner',
        ...nextProfile,
      });
      if (nextProfile.role === 'owner') {
        const mechanicsRes = await axios.get(`${API_BASE}/api/mechanics/`, { headers: { Authorization: `Bearer ${token}` } });
        setMechanics(Array.isArray(mechanicsRes.data) ? mechanicsRes.data : []);
        setFormData({
          first_name: nextProfile.user?.first_name || '',
          email: nextProfile.user?.email || '',
          company_name: nextProfile.company?.name || '',
          phone: nextProfile.company?.phone || '',
          address: nextProfile.company?.address || '',
          document_footer: nextProfile.company?.document_footer || '',
          global_margin_percent: nextProfile.company?.global_margin_percent || 20,
          business_type: nextProfile.company?.business_type || 'sto',
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
          <h1 className="text-2xl font-black text-slate-900">{profile.user?.first_name || profile.user?.username || 'Працівник'}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">{profile.company?.name || 'Компанія'} • Працівник</p>
          <button onClick={() => {localStorage.clear(); navigate('/login');}} className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-500 py-4 rounded-xl font-black uppercase tracking-widest mt-10 hover:bg-red-100 transition-colors"><LogOut size={20}/> Вийти з акаунта</button>
        </div>
      </div>
    );
  }

  const isSto = profile.company?.business_type === 'sto';
  const sectionCards = [
    ...(isSto ? [{ icon: <Wrench size={22}/>, title: 'Послуги', desc: 'Прайс робіт і стандартних послуг', path: '/settings/services' }] : []),
    { icon: <SlidersHorizontal size={22}/>, title: 'Статуси і довідники', desc: 'Статуси, типи оплат, джерела, причини відмов і категорії', path: '/settings/dictionaries' },
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

      <div className={`grid grid-cols-1 ${sectionCards.length >= 4 ? 'md:grid-cols-4' : sectionCards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {sectionCards.map((card) => <SettingsNavCard key={card.title} {...card} onClick={() => navigate(card.path)} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-blue-700 to-cyan-500 p-5 md:p-6 text-white">
              <div className="flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest"><Building2 size={15}/> Профіль компанії</div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-5">
                <div className="w-24 h-24 bg-white/95 rounded-3xl flex-shrink-0 overflow-hidden border border-white/30 shadow-xl flex items-center justify-center">
                  {profile.company?.logo ? <img src={profile.company.logo} alt="Logo" className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" size={34} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl md:text-3xl font-black truncate">{profile.company?.name || 'Компанія'}</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white">{isSto ? 'СТО' : 'Магазин'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm font-bold text-blue-50">
                    <p className="flex items-center gap-2 min-w-0"><MapPin size={15} className="shrink-0"/><span className="truncate">{profile.company?.address || 'Адреса не вказана'}</span></p>
                    <p className="flex items-center gap-2"><Phone size={15} className="shrink-0"/> {profile.company?.phone || 'Телефон не вказаний'}</p>
                    <p className="flex items-center gap-2"><DollarSign size={15} className="shrink-0"/> Націнка: {profile.company?.global_margin_percent || 20}%</p>
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
                <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-slate-800"><Users className="text-blue-600" size={18}/> Команда</h3>
                <button onClick={() => setIsAddingMechanic(true)} className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors"><Plus size={18}/></button>
              </div>
              <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                {mechanics.map((mech) => {
                  const name = getMechanicName(mech);
                  return (
                    <div key={mech.id || name} className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{name}</p><p className="text-[10px] text-slate-400 font-black uppercase">{mech.can_view_finances ? 'Фінанси' : 'Майстер'}</p></div>
                      <div className="flex gap-1 shrink-0"><button onClick={() => { setIsEditingMechanic(mech.id); setEditMechanicData({ first_name: name, new_password: '', can_create_visits: Boolean(mech.can_create_visits), can_view_finances: Boolean(mech.can_view_finances) }); }} className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100"><Pencil size={15}/></button><button onClick={() => handleDeleteMechanic(mech.id)} className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100"><Trash2 size={15}/></button></div>
                    </div>
                  );
                })}
                {mechanics.length === 0 && <div className="p-6 text-center text-slate-400 font-bold">Працівників ще немає</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditingProfile && <Modal title="Профіль компанії" onClose={() => setIsEditingProfile(false)}><form onSubmit={handleSaveProfile} className="space-y-4"><input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} placeholder="Ваше ім'я" className="input" /><input value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} placeholder="Назва компанії" className="input" /><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Телефон" className="input" /><input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Адреса" className="input" /><textarea value={formData.document_footer} onChange={e => setFormData({...formData, document_footer: e.target.value})} placeholder="Текст внизу документів" className="input h-24" /><div className="bg-slate-50 p-4 rounded-2xl"><label className="block text-xs font-black text-slate-400 uppercase mb-2">Режим бізнесу</label><select value={formData.business_type} onChange={e => setFormData({...formData, business_type: e.target.value})} className="input"><option value="sto">СТО</option><option value="store">Магазин автозапчастин</option></select></div><input type="number" value={formData.global_margin_percent} onChange={e => setFormData({...formData, global_margin_percent: e.target.value})} placeholder="Націнка %" className="input" /><label className="block"><span className="text-xs font-black uppercase text-slate-400 mb-2 block">Логотип</span><input type="file" onChange={e => setFormData({...formData, logo: e.target.files[0]})} className="input" /></label><button type="submit" disabled={saveLoading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase flex items-center justify-center gap-2">{saveLoading ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Зберегти</button></form></Modal>}
      {isChangingPassword && <Modal title="Зміна пароля" onClose={() => setIsChangingPassword(false)}><form onSubmit={handleChangePassword} className="space-y-4"><input type="password" placeholder="Старий пароль" className="input" value={passData.old} onChange={e => setPassData({...passData, old: e.target.value})}/><input type="password" placeholder="Новий пароль" className="input" value={passData.new} onChange={e => setPassData({...passData, new: e.target.value})}/><input type="password" placeholder="Повторіть новий пароль" className="input" value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})}/><button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase flex items-center justify-center gap-2"><Key size={18}/> Оновити пароль</button></form></Modal>}
      {isAddingMechanic && <MechanicModal title="Новий працівник" data={mechanicData} setData={setMechanicData} onSubmit={handleAddMechanic} onClose={() => setIsAddingMechanic(false)} />}
      {isEditingMechanic && <MechanicModal title="Редагувати працівника" data={editMechanicData} setData={setEditMechanicData} onSubmit={handleUpdateMechanic} onClose={() => setIsEditingMechanic(null)} isEdit />}
    </div>
  );
};

const SettingsNavCard = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="group bg-white border border-slate-100 rounded-[28px] p-5 text-left shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-100 transition-all flex items-center justify-between gap-4">
    <div className="flex items-center gap-4 min-w-0"><div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">{icon}</div><div className="min-w-0"><h3 className="font-black uppercase text-sm text-slate-900 truncate">{title}</h3><p className="text-xs font-semibold text-slate-500 mt-1 line-clamp-2">{desc}</p></div></div><ArrowRight className="text-slate-300 group-hover:text-blue-600 shrink-0" size={18}/>
  </button>
);

const Modal = ({ title, children, onClose }) => <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black uppercase italic text-slate-900">{title}</h2><button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button></div>{children}</div></div>;

const MechanicModal = ({ title, data, setData, onSubmit, onClose, isEdit }) => <Modal title={title} onClose={onClose}><form onSubmit={onSubmit} className="space-y-4"><input placeholder="Ім'я" className="input" value={data.first_name || ''} onChange={e => setData({...data, first_name: e.target.value})}/>{!isEdit && <input placeholder="Логін" className="input" value={data.username || ''} onChange={e => setData({...data, username: e.target.value})}/>}<input type="password" placeholder={isEdit ? "Новий пароль (необов'язково)" : "Пароль"} className="input" value={isEdit ? (data.new_password || '') : (data.password || '')} onChange={e => setData({...data, [isEdit ? 'new_password' : 'password']: e.target.value})}/><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl font-bold text-sm"><input type="checkbox" checked={Boolean(data.can_create_visits)} onChange={e => setData({...data, can_create_visits: e.target.checked})}/> Створювати візити</label><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl font-bold text-sm"><input type="checkbox" checked={Boolean(data.can_view_finances)} onChange={e => setData({...data, can_view_finances: e.target.checked})}/> Бачити фінанси</label><button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase">Зберегти</button></form></Modal>;

export default Settings;