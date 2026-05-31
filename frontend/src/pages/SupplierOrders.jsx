import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AlertTriangle, Boxes, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, Loader2, PackageCheck, Search, Truck, Users, XCircle } from 'lucide-react';
import api from '../api/axios';

const tabs = [
  { key: 'supplier-orders', label: 'Замовлення постачальникам', icon: Truck, path: '/crm/supplier-orders' },
  { key: 'clients', label: 'Клієнти', icon: Users, path: '/crm/clients' },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList, path: '/crm/recommendations' },
  { key: 'tasks', label: 'Задачі', icon: CheckCircle2, path: '/crm/tasks' },
  { key: 'follow-ups', label: 'Повторні візити', icon: CalendarClock, path: '/crm/follow-ups' },
];

const statusMeta = {
  WAITING: { label: 'До замовлення', card: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  IN_TRANSIT: { label: 'В дорозі', card: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  ARRIVED: { label: 'Отримано', card: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  UNAVAILABLE: { label: 'Відмова', card: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
};

const supplierStyles = {
  'supplier-bm': 'bg-slate-900 text-white border-slate-800',
  'supplier-vesna': 'bg-emerald-600 text-white border-emerald-600',
  'supplier-omega': 'bg-blue-600 text-white border-blue-600',
  'supplier-tehnomir': 'bg-rose-600 text-white border-rose-600',
  'supplier-local': 'bg-amber-100 text-amber-800 border-amber-200',
  'supplier-default': 'bg-slate-100 text-slate-700 border-slate-200',
};

const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const qty = (value) => Number(value || 1).toLocaleString('uk-UA', { maximumFractionDigits: 2 }).replace(',00', '');
const totalBuy = (item) => Number(item.buy_price || 0) * Number(item.quantity || 1);
const dateText = (value) => {
  if (!value) return 'Без дати';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Без дати' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getSupplierStyle = (item) => {
  const key = item.supplier_color || '';
  if (supplierStyles[key]) return supplierStyles[key];
  const supplier = String(item.supplier || '').toUpperCase();
  if (supplier.includes('BM')) return supplierStyles['supplier-bm'];
  if (supplier.includes('OMEGA') || supplier.includes('ОМЕГА')) return supplierStyles['supplier-omega'];
  if (supplier.includes('VESNA') || supplier.includes('ВЕСНА')) return supplierStyles['supplier-vesna'];
  if (supplier.includes('ТЕХНО') || supplier.includes('TEHNO')) return supplierStyles['supplier-tehnomir'];
  return supplierStyles['supplier-default'];
};

function parseCar(visit) {
  if (!visit?.delivery_data || typeof visit.delivery_data !== 'string' || !visit.delivery_data.trim().startsWith('{')) return '';
  try {
    const data = JSON.parse(visit.delivery_data);
    return [data.brand, data.model, data.year].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}

export default function SupplierOrders() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/visits/?history=true');
      const visits = Array.isArray(res.data) ? res.data : [];
      const flattened = visits.flatMap((visit) => (Array.isArray(visit.parts) ? visit.parts : []).map((part) => ({
        ...part,
        visit_id: visit.id,
        visit_date: visit.scheduled_datetime || visit.created_at,
        plate: visit.plate,
        client: visit.client,
        phone: visit.phone,
        car: parseCar(visit),
      })));
      setItems(flattened);
    } catch (error) {
      setMessage('Не вдалося завантажити замовлення постачальникам.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const status = item.status || 'WAITING';
      const okStatus = filter === 'all' || (filter === 'active' ? ['WAITING', 'IN_TRANSIT'].includes(status) : status === filter);
      const text = [item.supplier, item.brand, item.article, item.name, item.plate, item.client, item.phone, item.car].filter(Boolean).join(' ').toLowerCase();
      return okStatus && (!q || text.includes(q));
    });
  }, [items, search, filter]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      const supplier = item.supplier || 'Без постачальника';
      if (!map.has(supplier)) map.set(supplier, []);
      map.get(supplier).push(item);
    });
    return Array.from(map.entries()).map(([supplier, parts]) => ({
      supplier,
      parts: parts.sort((a, b) => String(a.status || '').localeCompare(String(b.status || ''))),
      total: parts.reduce((sum, item) => sum + totalBuy(item), 0),
      style: getSupplierStyle(parts[0] || {}),
    })).sort((a, b) => b.parts.length - a.parts.length);
  }, [filtered]);

  const stats = useMemo(() => ({
    active: items.filter(i => ['WAITING', 'IN_TRANSIT'].includes(i.status || 'WAITING')).length,
    WAITING: items.filter(i => (i.status || 'WAITING') === 'WAITING').length,
    IN_TRANSIT: items.filter(i => i.status === 'IN_TRANSIT').length,
    ARRIVED: items.filter(i => i.status === 'ARRIVED').length,
    UNAVAILABLE: items.filter(i => i.status === 'UNAVAILABLE').length,
  }), [items]);

  const changeStatus = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/api/order-parts/${id}/`, { status });
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
    } catch {
      setMessage('Не вдалося змінити статус запчастини.');
    } finally {
      setBusy(false);
    }
  };

  const changeGroupStatus = async (parts, status) => {
    if (!parts.length) return;
    if (!window.confirm(`Змінити статус для ${parts.length} позицій?`)) return;
    setBusy(true);
    try {
      await Promise.all(parts.map((item) => api.patch(`/api/order-parts/${item.id}/`, { status })));
      const ids = new Set(parts.map((item) => item.id));
      setItems((prev) => prev.map((item) => ids.has(item.id) ? { ...item, status } : item));
    } catch {
      setMessage('Не вдалося змінити статуси групи.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen overflow-x-hidden">
    <div className="mb-5 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><Truck className="text-blue-600" size={30}/> CRM</h1>
        <p className="text-slate-500 font-semibold mt-1 text-sm md:text-base">Замовлення постачальникам, клієнти, задачі та продажі в одному місці.</p>
      </div>
      <button onClick={load} disabled={loading || busy} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-60">
        {loading ? <Loader2 className="animate-spin" size={16}/> : <PackageCheck size={16}/>} Оновити
      </button>
    </div>

    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-2 mb-5 overflow-x-auto max-w-full">
      <div className="flex gap-2 min-w-max md:min-w-0">
        {tabs.map((t) => { const Icon = t.icon; const active = t.key === 'supplier-orders'; return <NavLink key={t.key} to={t.path} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={16}/>{t.label}</NavLink>; })}
      </div>
    </div>

    {message && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between gap-3"><span>{message}</span><button onClick={() => setMessage('')}><XCircle size={16}/></button></div>}

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-5">
      <StatButton active={filter === 'active'} label="Активні" value={stats.active} className="text-indigo-600" onClick={() => setFilter('active')} />
      <StatButton active={filter === 'WAITING'} label="До замовлення" value={stats.WAITING} className="text-amber-600" onClick={() => setFilter('WAITING')} />
      <StatButton active={filter === 'IN_TRANSIT'} label="В дорозі" value={stats.IN_TRANSIT} className="text-blue-600" onClick={() => setFilter('IN_TRANSIT')} />
      <StatButton active={filter === 'ARRIVED'} label="Отримано" value={stats.ARRIVED} className="text-emerald-600" onClick={() => setFilter('ARRIVED')} />
      <StatButton active={filter === 'all'} label="Всі" value={items.length} className="text-slate-700" onClick={() => setFilter('all')} />
    </div>

    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 sm:p-4 mb-5">
      <div className="relative min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по постачальнику, артикулу, запчастині, номеру авто або клієнту..." className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium" />
      </div>
    </div>

    {loading ? <Empty text="Завантаження замовлень..." /> : groups.length === 0 ? <Empty text="Позицій для постачальників немає" /> : <div className="space-y-5">
      {groups.map((group) => <SupplierGroup key={group.supplier} group={group} busy={busy} onStatus={changeStatus} onGroupStatus={changeGroupStatus} onOpenVisit={(item) => navigate('/visits', { state: { supplierOrderPart: item.id, search: item.plate } })} />)}
    </div>}
  </div>;
}

function StatButton({ label, value, className, active, onClick }) {
  return <button onClick={onClick} className={`bg-white rounded-3xl border p-4 text-left shadow-sm hover:border-blue-300 ${active ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200'}`}>
    <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
    <p className={`text-2xl font-black ${className}`}>{value}</p>
  </button>;
}

function SupplierGroup({ group, busy, onStatus, onGroupStatus, onOpenVisit }) {
  const activeParts = group.parts.filter((item) => ['WAITING', 'IN_TRANSIT'].includes(item.status || 'WAITING'));
  return <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${group.style}`}>{group.supplier}</span>
          <span className="text-[10px] font-black uppercase text-slate-400">{group.parts.length} позицій</span>
        </div>
        <h2 className="text-xl font-black text-slate-900">Закупка: {money(group.total)}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
        <button disabled={busy || activeParts.length === 0} onClick={() => onGroupStatus(activeParts, 'IN_TRANSIT')} className="bg-blue-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50">Позначити замовлено</button>
        <button disabled={busy || activeParts.length === 0} onClick={() => onGroupStatus(activeParts, 'ARRIVED')} className="bg-emerald-600 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50">Позначити отримано</button>
      </div>
    </div>
    <div className="divide-y divide-slate-100">
      {group.parts.map((item) => <PartRow key={item.id} item={item} busy={busy} onStatus={onStatus} onOpenVisit={onOpenVisit} />)}
    </div>
  </section>;
}

function PartRow({ item, busy, onStatus, onOpenVisit }) {
  const meta = statusMeta[item.status || 'WAITING'] || statusMeta.WAITING;
  return <div className="p-4 md:p-5 grid grid-cols-1 xl:grid-cols-[1fr_190px_260px] gap-4 items-center">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${meta.card}`}><span className={`w-2 h-2 rounded-full ${meta.dot}`} />{meta.label}</span>
        <span className="text-[10px] font-black uppercase text-blue-600">Візит №{item.visit_id}</span>
        <span className="text-[10px] font-black uppercase text-slate-400">{dateText(item.visit_date)}</span>
      </div>
      <h3 className="font-black text-slate-900 text-base break-words">{item.name}</h3>
      <p className="text-xs font-bold text-slate-500 mt-1 break-words">{item.brand || '—'} · {item.article || '—'} · {item.plate || 'без номера'} · {item.client || 'клієнт не вказаний'}</p>
      {item.car && <p className="text-xs font-semibold text-slate-400 mt-1">{item.car}</p>}
    </div>
    <div className="grid grid-cols-3 gap-2">
      <Small label="К-сть" value={qty(item.quantity)} />
      <Small label="Закупка" value={money(item.buy_price)} />
      <Small label="Сума" value={money(totalBuy(item))} />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2">
      <button disabled={busy} onClick={() => onStatus(item.id, 'IN_TRANSIT')} className="bg-blue-50 text-blue-700 rounded-xl py-2.5 text-[10px] font-black uppercase disabled:opacity-50">В дорозі</button>
      <button disabled={busy} onClick={() => onStatus(item.id, 'ARRIVED')} className="bg-emerald-50 text-emerald-700 rounded-xl py-2.5 text-[10px] font-black uppercase disabled:opacity-50">Отримано</button>
      <button disabled={busy} onClick={() => onStatus(item.id, 'UNAVAILABLE')} className="bg-rose-50 text-rose-700 rounded-xl py-2.5 text-[10px] font-black uppercase disabled:opacity-50">Відмова</button>
      <button onClick={() => onOpenVisit(item)} className="bg-slate-900 text-white rounded-xl py-2.5 text-[10px] font-black uppercase flex items-center justify-center gap-1"><ExternalLink size={13}/> Візит</button>
    </div>
  </div>;
}

function Small({ label, value }) {
  return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-2 min-w-0"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="text-xs font-black text-slate-800 break-words">{value}</p></div>;
}

function Empty({ text }) {
  return <div className="bg-white rounded-3xl p-10 text-center border border-slate-200"><AlertTriangle className="mx-auto text-slate-300 mb-3" size={42}/><p className="font-black text-slate-700">{text}</p></div>;
}
