import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Clock3, CreditCard, PackageMinus, RefreshCcw, RotateCcw, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const iconMap = {
  low_stock: PackageMinus,
  debts: CreditCard,
  payment_due: CreditCard,
  overdue_orders: Clock3,
  np_returns: RotateCcw,
  parts_in_transit: Truck,
  crm_tasks: AlertTriangle,
  service_reminders: Clock3,
  recommendations: AlertTriangle,
};

const toneMap = {
  critical: 'border-rose-100 bg-rose-50 text-rose-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
};

const cardToneMap = {
  critical: 'hover:border-rose-200 hover:bg-rose-50/60',
  warning: 'hover:border-amber-200 hover:bg-amber-50/60',
  info: 'hover:border-blue-200 hover:bg-blue-50/60',
};

function money(value) {
  const number = Number(value || 0);
  if (!number) return '';
  return `${number.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
}

export default function AttentionCenter({ compact = false }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notifications/summary/');
      setSummary(res.data || null);
    } catch (error) {
      setSummary({ total: 0, sections: [], active_sections: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sections = useMemo(() => {
    const active = summary?.active_sections || [];
    const all = summary?.sections || [];
    return active.length ? active : all.filter((s) => Number(s.count || 0) > 0);
  }, [summary]);

  const goTo = (url) => {
    if (url) navigate(url);
  };

  if (loading) {
    return <section className="col-span-1 md:col-span-2 lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-3 text-slate-500 font-black uppercase text-xs"><RefreshCcw className="animate-spin" size={16}/> Завантаження центру повідомлень...</div>
    </section>;
  }

  return <section className="col-span-1 md:col-span-2 lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-r from-white via-blue-50/50 to-emerald-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-100 shrink-0"><Bell size={22}/></div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase italic">Що потребує уваги</h2>
          <p className="text-sm font-bold text-slate-500 mt-1">Борги, оплати, склад, затримки та повернення в одному місці.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Stat label="Усього" value={summary?.total || 0} />
        <Stat label="Критично" value={summary?.critical || 0} danger />
        <button onClick={load} className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-blue-700 flex items-center justify-center shrink-0" title="Оновити"><RefreshCcw size={17}/></button>
      </div>
    </div>

    <div className="p-4 md:p-5">
      {sections.length === 0 ? <div className="rounded-3xl bg-emerald-50 border border-emerald-100 p-6 md:p-8 text-center">
        <p className="font-black text-emerald-700 text-lg">Все спокійно</p>
        <p className="text-sm font-bold text-emerald-600/80 mt-1">Критичних боргів, затримок або проблем зі складом зараз немає.</p>
      </div> : <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-3 md:gap-4`}>
        {sections.map((section) => <AttentionCard key={section.key} section={section} onClick={() => goTo(section.url)} />)}
      </div>}
    </div>
  </section>;
}

function AttentionCard({ section, onClick }) {
  const Icon = iconMap[section.key] || AlertTriangle;
  const iconTone = toneMap[section.severity] || toneMap.info;
  const cardTone = cardToneMap[section.severity] || cardToneMap.info;
  const amount = money(section.amount);
  return <button onClick={onClick} className={`text-left rounded-3xl border border-slate-200 bg-white p-4 transition shadow-sm ${cardTone}`}>
    <div className="flex items-start gap-3">
      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${iconTone}`}><Icon size={20}/></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-slate-900 leading-tight">{section.title}</p>
          <span className="bg-slate-100 text-slate-800 rounded-xl px-2.5 py-1 text-xs font-black shrink-0">{section.count}</span>
        </div>
        <p className="text-xs font-bold text-slate-500 mt-1">{amount || section.subtitle || 'Потрібно перевірити'}</p>
      </div>
    </div>
    {section.items?.length > 0 && <div className="mt-3 space-y-2">
      {section.items.slice(0, 2).map((item) => <div key={`${section.key}-${item.id}-${item.title}`} className="bg-slate-50 rounded-2xl p-3">
        <p className="text-sm font-black text-slate-800 truncate">{item.title}</p>
        <p className="text-xs font-bold text-slate-500 truncate mt-0.5">{item.subtitle}</p>
      </div>)}
      {section.items.length > 2 && <p className="text-[10px] font-black uppercase text-slate-400 px-1">+ ще {section.items.length - 2}</p>}
    </div>}
  </button>;
}

function Stat({ label, value, danger }) {
  return <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 min-w-[82px]">
    <p className="text-[9px] uppercase font-black text-slate-400">{label}</p>
    <p className={`text-lg font-black ${danger && Number(value) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
  </div>;
}
