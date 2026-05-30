import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Bell, CalendarClock, CheckCircle2, ClipboardList, Plus, Search, Users, X } from 'lucide-react';
import api from '../api/axios';
import Clients from './Clients';

const tabs = [
  { key: 'clients', label: 'Клієнти', icon: Users, path: '/crm/clients' },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList, path: '/crm/recommendations' },
  { key: 'tasks', label: 'Задачі', icon: CheckCircle2, path: '/crm/tasks', disabled: true },
  { key: 'follow-ups', label: 'Повторні візити', icon: CalendarClock, path: '/crm/follow-ups', disabled: true },
];

const badge = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  soon: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};
const emptyForm = { client: '', phone: '', plate: '', car: '', title: '', description: '', due_date: '', due_mileage: '', status: 'active' };
const fmtDate = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Без дати';

export default function CRM() {
  const { tab = 'clients' } = useParams();
  const navigate = useNavigate();
  const activeTab = ['clients', 'recommendations'].includes(tab) ? tab : 'clients';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (tab === 'tasks' || tab === 'follow-ups') navigate('/crm/clients', { replace: true });
  }, [tab, navigate]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/recommendations/');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMessage('Не вдалося завантажити рекомендації.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadRecommendations(); }, []);

  const stats = useMemo(() => ({
    active: items.filter(i => i.state === 'active').length,
    soon: items.filter(i => i.state === 'soon').length,
    overdue: items.filter(i => i.state === 'overdue').length,
    done: items.filter(i => i.state === 'done').length,
  }), [items]);

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(i => {
      const okFilter = filter === 'all' || i.state === filter || i.status === filter;
      const text = [i.client, i.phone, i.plate, i.car, i.title, i.description].filter(Boolean).join(' ').toLowerCase();
      return okFilter && (!q || text.includes(q));
    });
  }, [items, search, filter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...emptyForm, ...item, due_mileage: item.due_mileage || '' }); setModal(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setMessage('Вкажіть назву рекомендації.');
    const payload = { ...form, due_date: form.due_date || null, due_mileage: form.due_mileage ? Number(form.due_mileage) : null };
    try {
      if (editing?.id) await api.patch(`/api/recommendations/${editing.id}/`, payload);
      else await api.post('/api/recommendations/', payload);
      setModal(false); setMessage(editing ? 'Рекомендацію оновлено.' : 'Рекомендацію створено.'); loadRecommendations();
    } catch { setMessage('Не вдалося зберегти рекомендацію.'); }
  };
  const done = async (item) => { try { await api.post(`/api/recommendations/${item.id}/mark-done/`); loadRecommendations(); } catch { setMessage('Не вдалося змінити статус.'); } };
  const remove = async (item) => { if (!window.confirm(`Видалити рекомендацію “${item.title}”?`)) return; try { await api.delete(`/api/recommendations/${item.id}/`); loadRecommendations(); } catch { setMessage('Не вдалося видалити.'); } };

  return <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen">
    <div className="mb-5 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
      <div><h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><Users className="text-blue-600" size={30}/> CRM</h1><p className="text-slate-500 font-semibold mt-1">Клієнти, рекомендації та повторні звернення в одному місці.</p></div>
      {activeTab === 'recommendations' && <button onClick={openCreate} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"><Plus size={16}/> Додати рекомендацію</button>}
    </div>
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-2 mb-5 overflow-x-auto"><div className="flex gap-2 min-w-max">
      {tabs.map(t => { const Icon = t.icon; const active = activeTab === t.key; return t.disabled ? <span key={t.key} className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black text-slate-300"><Icon size={16}/>{t.label}<span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full uppercase">скоро</span></span> : <NavLink key={t.key} to={t.path} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black transition-all ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={16}/>{t.label}</NavLink>; })}
    </div></div>
    {message && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between"><span>{message}</span><button onClick={() => setMessage('')}><X size={16}/></button></div>}
    {activeTab === 'clients' && <Clients embedded />}
    {activeTab === 'recommendations' && <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[[ 'active','Активні',stats.active,'text-blue-600'],['soon','Скоро',stats.soon,'text-amber-600'],['overdue','Прострочені',stats.overdue,'text-rose-600'],['done','Виконані',stats.done,'text-emerald-600']].map(s => <button key={s[0]} onClick={() => setFilter(s[0])} className="bg-white rounded-3xl border border-slate-200 p-4 text-left shadow-sm hover:border-blue-300"><p className="text-[10px] font-black uppercase text-slate-400">{s[1]}</p><p className={`text-2xl font-black ${s[3]}`}>{s[2]}</p></button>)}
      </div>
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4"><div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук по клієнту, авто, номеру, телефону або рекомендації..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium"/></div><button onClick={()=>setFilter('all')} className="bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-black uppercase">Показати всі</button></div></div>
      {loading ? <div className="bg-white rounded-3xl p-10 text-center text-slate-400 font-black border border-slate-200">Завантаження...</div> : list.length === 0 ? <div className="bg-white rounded-3xl p-10 text-center border border-slate-200"><Bell className="mx-auto text-slate-300 mb-3" size={42}/><p className="font-black text-slate-700">Рекомендацій поки немає</p></div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{list.map(item => <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:shadow-md"><div className="flex items-start justify-between gap-3 mb-4"><div><p className="text-xs font-black uppercase text-blue-600 mb-1">{item.plate || 'Без номера'} · {item.car || 'Авто не вказано'}</p><h2 className="font-black text-lg text-slate-900 leading-tight">{item.title}</h2><p className="text-sm text-slate-500 font-semibold mt-1">{item.client || 'Клієнт не вказаний'} {item.phone ? `· ${item.phone}` : ''}</p></div><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${badge[item.state] || badge.active}`}>{item.state_label}</span></div>{item.description && <p className="text-sm text-slate-600 font-medium mb-4 bg-slate-50 rounded-2xl p-3 border border-slate-100">{item.description}</p>}<div className="grid grid-cols-2 gap-2 mb-4"><div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><p className="text-[10px] font-black uppercase text-slate-400">Дата</p><p className="font-black text-slate-800 text-sm">{fmtDate(item.due_date)}</p></div><div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><p className="text-[10px] font-black uppercase text-slate-400">Пробіг</p><p className="font-black text-slate-800 text-sm">{item.due_mileage ? `${item.due_mileage} км` : '—'}</p></div></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{item.status !== 'done' && <button onClick={()=>done(item)} className="bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-emerald-100">Виконано</button>}<button onClick={()=>openEdit(item)} className="bg-blue-50 text-blue-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-blue-100">Редагувати</button><button onClick={()=>remove(item)} className="bg-rose-50 text-rose-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-rose-100">Видалити</button></div></div>)}</div>}
    </div>}
    {modal && <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={save} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50"><div><h2 className="text-xl font-black text-slate-900">{editing ? 'Редагувати рекомендацію' : 'Нова рекомендація'}</h2><p className="text-sm text-slate-500 font-semibold">Що потрібно зробити клієнту пізніше.</p></div><button type="button" onClick={()=>setModal(false)} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-500"><X size={18}/></button></div><div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Назва рекомендації" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/><textarea value={form.description || ''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Опис / коментар" rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500"/><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[['client','ПІБ клієнта'],['phone','Телефон'],['plate','Держ номер'],['car','Авто']].map(f=><input key={f[0]} value={form[f[0]] || ''} onChange={e=>setForm({...form,[f[0]]:e.target.value})} placeholder={f[1]} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/>)}<input type="date" value={form.due_date || ''} onChange={e=>setForm({...form,due_date:e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/><input type="number" value={form.due_mileage || ''} onChange={e=>setForm({...form,due_mileage:e.target.value})} placeholder="Пробіг" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/></div><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"><option value="active">Активна</option><option value="done">Виконана</option><option value="cancelled">Скасована</option></select></div><div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2"><button type="button" onClick={()=>setModal(false)} className="px-5 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600">Скасувати</button><button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 font-black text-xs uppercase text-white">Зберегти</button></div></form></div>}
  </div>;
}
