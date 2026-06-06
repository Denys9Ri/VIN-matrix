import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArchiveRestore, Boxes, CheckCircle2, Clock, CreditCard, History, Package, RefreshCcw, ShieldAlert, UserRound } from 'lucide-react';
import api from '../../api/axios';

const arr = (v) => Array.isArray(v) ? v : [];
const time = (v) => v ? new Date(v).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';
const dayKey = (v) => v ? new Date(v).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Без дати';
const todayKey = () => new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });

const actionConfig = (type = '') => {
  if (type.startsWith('payment')) return { icon: CreditCard, dot: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-100', iconBox: 'bg-emerald-100 text-emerald-700' };
  if (type.startsWith('stock')) return { icon: Boxes, dot: 'bg-blue-500', card: 'bg-blue-50 border-blue-100', iconBox: 'bg-blue-100 text-blue-700' };
  if (type.includes('return')) return { icon: ArchiveRestore, dot: 'bg-amber-500', card: 'bg-amber-50 border-amber-100', iconBox: 'bg-amber-100 text-amber-700' };
  if (type.includes('cancel') || type.includes('defective') || type.includes('deleted')) return { icon: ShieldAlert, dot: 'bg-rose-500', card: 'bg-rose-50 border-rose-100', iconBox: 'bg-rose-100 text-rose-700' };
  if (type.includes('client')) return { icon: UserRound, dot: 'bg-violet-500', card: 'bg-violet-50 border-violet-100', iconBox: 'bg-violet-100 text-violet-700' };
  if (type.includes('status') || type.includes('created') || type.includes('completed')) return { icon: CheckCircle2, dot: 'bg-indigo-500', card: 'bg-indigo-50 border-indigo-100', iconBox: 'bg-indigo-100 text-indigo-700' };
  return { icon: Package, dot: 'bg-slate-400', card: 'bg-white border-slate-200', iconBox: 'bg-slate-100 text-slate-600' };
};

export default function ActivityTimeline({ visitId, phone, mode, type, limit = 80, compact = false, title = 'Історія дій' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (visitId) params.set('visit', visitId);
      if (phone) params.set('phone', phone);
      if (mode) params.set('mode', mode);
      if (type) params.set('type', type);
      params.set('limit', limit);
      const res = await api.get(`/api/activity/?${params.toString()}`);
      setItems(arr(res.data?.results));
    } catch (e) {
      setError('Не вдалося завантажити історію дій.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visitId, phone, mode, type, limit]);

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = dayKey(item.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  return <section className={`bg-white border border-slate-200 rounded-3xl shadow-sm ${compact ? 'p-3' : 'p-4 md:p-5'}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100"><History size={18}/></span>
        <div>
          <h3 className="font-black uppercase text-slate-900">{title}</h3>
          <p className="text-xs font-bold text-slate-400">Хто, коли і що змінив у системі</p>
        </div>
      </div>
      <button onClick={load} className="bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-500 hover:text-blue-700 rounded-xl p-2 transition" title="Оновити">
        <RefreshCcw size={15}/>
      </button>
    </div>

    {loading && <Empty text="Завантаження історії..." />}
    {!loading && error && <Empty icon={AlertTriangle} text={error} danger />}
    {!loading && !error && !items.length && <Empty text="Історії поки немає" />}

    {!loading && !error && grouped.map(([day, rows]) => <div key={day} className="mb-5 last:mb-0">
      <div className="sticky top-0 z-[1] bg-white/90 backdrop-blur py-2 mb-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{day === todayKey() ? 'Сьогодні' : day}</p>
      </div>
      <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
        {rows.map((item) => <ActivityItem key={item.id} item={item} />)}
      </div>
    </div>)}
  </section>;
}

function ActivityItem({ item }) {
  const cfg = actionConfig(item.action_type);
  const Icon = cfg.icon;
  return <div className="relative">
    <span className={`absolute -left-[20px] top-5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${cfg.dot}`} />
    <div className={`rounded-2xl border p-3 md:p-4 ${cfg.card}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center ${cfg.iconBox}`}><Icon size={17}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <p className="font-black text-slate-900 leading-tight">{item.title || 'Дія'}</p>
            <span className="text-[11px] font-black text-slate-400">{time(item.created_at)} · {item.actor || 'Система'}</span>
          </div>
          {item.description && <p className="text-sm font-bold text-slate-600 mt-1 break-words">{item.description}</p>}
          {(item.old_value || item.new_value) && <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase">
            {item.old_value && <span className="bg-white/70 border border-white rounded-lg px-2 py-1 text-slate-500">Було: {String(item.old_value).slice(0, 80)}</span>}
            {item.new_value && <span className="bg-white/70 border border-white rounded-lg px-2 py-1 text-slate-700">Стало: {String(item.new_value).slice(0, 80)}</span>}
          </div>}
        </div>
      </div>
    </div>
  </div>;
}

function Empty({ text, danger, icon: Icon = Clock }) {
  return <div className={`rounded-2xl p-8 text-center border ${danger ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
    <Icon className="mx-auto mb-2" size={28}/>
    <p className="text-xs font-black uppercase">{text}</p>
  </div>;
}
