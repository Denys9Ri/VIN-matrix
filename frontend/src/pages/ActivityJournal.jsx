import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, Filter, History, RefreshCcw, Search, ShieldAlert } from 'lucide-react';
import ActivityTimeline from '../components/activity/ActivityTimeline';
import api from '../api/axios';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyFilters = { q: '', mode: '', category: '', type: '', user: '', date_from: '', date_to: '', visit: '', phone: '' };
const modes = [['', 'Усі режими'], ['store', 'Магазин'], ['sto', 'СТО'], ['system', 'Система']];
const categories = [['', 'Усі дії'], ['finance', 'Фінанси'], ['stock', 'Склад'], ['cancel', 'Скасування'], ['return', 'Повернення']];
const actionTypes = [
  ['', 'Усі типи'],
  ['order_created', 'Створено замовлення'],
  ['visit_created', 'Створено візит'],
  ['order_status_changed', 'Статус замовлення'],
  ['visit_status_changed', 'Статус візиту'],
  ['part_added', 'Додано товар/запчастину'],
  ['part_updated', 'Оновлено товар/запчастину'],
  ['part_deleted', 'Видалено товар/запчастину'],
  ['part_returned', 'Повернення товару'],
  ['stock_reserved', 'Резерв складу'],
  ['stock_released', 'Зняття резерву'],
  ['stock_sold', 'Списання складу'],
  ['stock_returned', 'Повернення на склад'],
  ['stock_defective', 'Брак'],
  ['payment_added', 'Додано оплату'],
  ['payment_closed', 'Борг закрито'],
  ['payment_reminder_created', 'Нагадування по боргу'],
  ['delivery_updated', 'Доставка'],
  ['ttn_added', 'ТТН'],
];

const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => String(v || '').trim() !== ''));

export default function ActivityJournal() {
  const location = useLocation();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState({ limit: 120 });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const next = { ...emptyFilters };
    ['q', 'search', 'mode', 'category', 'type', 'action_type', 'user', 'user_id', 'date_from', 'date_to', 'visit', 'visit_id', 'phone', 'client_phone'].forEach((key) => {
      const val = params.get(key);
      if (!val) return;
      if (key === 'search') next.q = val;
      else if (key === 'action_type') next.type = val;
      else if (key === 'user_id') next.user = val;
      else if (key === 'visit_id') next.visit = val;
      else if (key === 'client_phone') next.phone = val;
      else next[key] = val;
    });
    const prepared = clean(next);
    if (Object.keys(prepared).length) {
      setFilters((p) => ({ ...p, ...next }));
      setApplied({ ...prepared, limit: 160 });
    }
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await api.get('/api/activity/?limit=1');
        if (!cancelled) setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
      } catch {}
      finally { if (!cancelled) setLoadingUsers(false); }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, []);

  const query = useMemo(() => ({ ...applied, limit: 160 }), [applied]);
  const apply = (e) => {
    e?.preventDefault?.();
    setApplied(clean(filters));
  };
  const reset = () => {
    setFilters(emptyFilters);
    setApplied({ limit: 120 });
  };
  const setToday = () => {
    const d = today();
    setFilters((p) => ({ ...p, date_from: d, date_to: d }));
  };

  return <div className="w-full max-w-[1500px] mx-auto p-4 md:p-8 md:pl-72 min-h-screen bg-slate-50/40">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><History className="text-blue-600"/> Журнал дій</h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">Повна історія: замовлення, візити, склад, оплати, повернення та скасування.</p>
      </div>
      <button onClick={reset} className="bg-white border border-blue-100 text-blue-700 rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm"><RefreshCcw size={16}/> Скинути</button>
    </div>

    <form onSubmit={apply} className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm mb-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="relative md:col-span-2 xl:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={filters.q} onChange={(e)=>setFilters({...filters, q:e.target.value})} placeholder="Пошук: клієнт, телефон, артикул, товар, опис..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"/>
        </div>
        <Select value={filters.mode} onChange={(v)=>setFilters({...filters, mode:v})} options={modes}/>
        <Select value={filters.category} onChange={(v)=>setFilters({...filters, category:v})} options={categories}/>
        <Select value={filters.type} onChange={(v)=>setFilters({...filters, type:v})} options={actionTypes}/>
        <Select value={filters.user} onChange={(v)=>setFilters({...filters, user:v})} options={[['', loadingUsers ? 'Користувачі...' : 'Усі користувачі'], ...users.map((u)=>[String(u.id), u.name])]}/>
        <Input type="date" value={filters.date_from} onChange={(v)=>setFilters({...filters, date_from:v})} icon={<CalendarDays size={15}/>}/>
        <Input type="date" value={filters.date_to} onChange={(v)=>setFilters({...filters, date_to:v})} icon={<CalendarDays size={15}/>}/>
        <Input value={filters.visit} onChange={(v)=>setFilters({...filters, visit:v})} placeholder="№ замовлення / візиту" />
        <Input value={filters.phone} onChange={(v)=>setFilters({...filters, phone:v})} placeholder="Телефон клієнта" />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button className="bg-blue-600 text-white rounded-xl px-6 py-3 text-xs font-black uppercase shadow-md shadow-blue-100 flex items-center justify-center gap-2"><Filter size={15}/> Застосувати фільтри</button>
        <button type="button" onClick={setToday} className="bg-slate-50 text-slate-700 border border-slate-200 rounded-xl px-6 py-3 text-xs font-black uppercase">Сьогодні</button>
        <button type="button" onClick={() => setFilters({...filters, category:'finance'})} className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl px-6 py-3 text-xs font-black uppercase">Тільки фінанси</button>
        <button type="button" onClick={() => setFilters({...filters, category:'stock'})} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl px-6 py-3 text-xs font-black uppercase">Тільки склад</button>
      </div>
    </form>

    <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 flex items-start gap-2">
      <ShieldAlert size={17} className="mt-0.5 shrink-0"/> Тут видно, хто створив, змінив, списав, повернув, скасував або прийняв оплату. Це журнал довіри для власника бізнесу.
    </div>

    <ActivityTimeline query={query} title="Усі дії" />
  </div>;
}

function Select({ value, onChange, options }) {
  return <select value={value || ''} onChange={(e)=>onChange(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500">
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
  </select>;
}

function Input({ value, onChange, placeholder, type = 'text', icon }) {
  return <div className="relative">
    {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
    <input type={type} value={value || ''} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className={`w-full bg-slate-50 border-2 border-slate-200 rounded-xl ${icon ? 'pl-10' : 'px-4'} pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500`}/>
  </div>;
}
