import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Clock3, CreditCard, ExternalLink, PackageMinus, RefreshCcw, RotateCcw, Truck, X } from 'lucide-react';
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
  critical: {
    badge: 'bg-rose-600 text-white',
    icon: 'bg-rose-50 text-rose-700 border-rose-100',
    card: 'hover:bg-rose-50',
  },
  warning: {
    badge: 'bg-amber-500 text-white',
    icon: 'bg-amber-50 text-amber-700 border-amber-100',
    card: 'hover:bg-amber-50',
  },
  info: {
    badge: 'bg-blue-600 text-white',
    icon: 'bg-blue-50 text-blue-700 border-blue-100',
    card: 'hover:bg-blue-50',
  },
};

function SectionIcon({ section }) {
  const Icon = iconMap[section.key] || Bell;
  const tone = toneMap[section.severity] || toneMap.info;
  return <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${tone.icon}`}><Icon size={18} /></div>;
}

function formatAmount(value) {
  const number = Number(value || 0);
  if (!number) return '';
  return `${number.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeSections = useMemo(() => {
    const sections = summary?.active_sections || summary?.sections || [];
    return sections.filter((s) => Number(s.count || 0) > 0);
  }, [summary]);

  const total = Number(summary?.total || 0);
  const hasCritical = Number(summary?.critical || 0) > 0;

  const loadSummary = async () => {
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

  useEffect(() => {
    loadSummary();
    const timer = setInterval(loadSummary, 120000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (url) => {
    setOpen(false);
    if (url) navigate(url);
  };

  const itemClick = (event, item) => {
    event.stopPropagation();
    goTo(item?.url);
  };

  return <div className="relative">
    <button
      onClick={() => setOpen(true)}
      className="relative w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-100 hover:bg-blue-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-700 transition-all"
      title="Центр повідомлень"
    >
      <Bell size={18} />
      {total > 0 && <span className={`absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow-sm ${hasCritical ? toneMap.critical.badge : toneMap.warning.badge}`}>{total > 99 ? '99+' : total}</span>}
    </button>

    {open && <div className="fixed inset-0 z-[90] md:absolute md:inset-auto md:right-0 md:top-12 md:w-[420px] bg-slate-950/50 md:bg-transparent backdrop-blur-sm md:backdrop-blur-0">
      <div className="bg-white w-full h-full md:h-auto md:max-h-[80vh] md:rounded-3xl md:border md:border-slate-200 md:shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-white to-blue-50">
          <div>
            <p className="font-black text-slate-900 uppercase">Центр повідомлень</p>
            <p className="text-xs font-bold text-slate-500">Що потребує уваги зараз</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadSummary} className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-700 flex items-center justify-center" title="Оновити">
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center"><X size={18} /></button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-100">
          <MiniStat label="Усього" value={total} tone="text-slate-900" />
          <MiniStat label="Критично" value={summary?.critical || 0} tone="text-rose-600" />
          <MiniStat label="Увага" value={summary?.warning || 0} tone="text-amber-600" />
        </div>

        <div className="p-3 overflow-y-auto flex-1 md:max-h-[520px] space-y-2">
          {loading && !summary && <Empty text="Завантаження..." />}
          {!loading && activeSections.length === 0 && <Empty text="Все спокійно. Критичних задач немає." />}
          {activeSections.map((section) => {
            const tone = toneMap[section.severity] || toneMap.info;
            return <button key={section.key} onClick={() => goTo(section.url)} className={`w-full text-left rounded-2xl border border-slate-100 bg-white p-3 transition ${tone.card}`}>
              <div className="flex gap-3">
                <SectionIcon section={section} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-black text-slate-900 leading-tight">{section.title}</p>
                    <span className="bg-slate-100 text-slate-700 rounded-xl px-2 py-1 text-xs font-black shrink-0">{section.count}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mt-1">{formatAmount(section.amount) || section.subtitle || 'Потребує уваги'}</p>
                  {section.items?.length > 0 && <div className="mt-3 space-y-1.5">
                    {section.items.slice(0, 3).map((item) => <button type="button" onClick={(e) => itemClick(e, item)} key={`${section.key}-${item.id}-${item.title}`} className="w-full text-left bg-slate-50 hover:bg-white hover:ring-2 hover:ring-blue-100 rounded-xl p-2 transition group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{item.title}</p>
                          <p className="text-[11px] font-bold text-slate-500 truncate">{item.subtitle}</p>
                        </div>
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-600 shrink-0 mt-0.5" />
                      </div>
                    </button>)}
                    {section.items.length > 3 && <p className="text-[10px] font-black uppercase text-slate-400 px-1">+ ще {section.items.length - 3}</p>}
                  </div>}
                </div>
              </div>
            </button>;
          })}
        </div>
      </div>
    </div>}
  </div>;
}

function MiniStat({ label, value, tone }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
    <p className="text-[9px] uppercase font-black text-slate-400">{label}</p>
    <p className={`text-lg font-black ${tone}`}>{value}</p>
  </div>;
}

function Empty({ text }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center text-sm font-bold text-slate-500">{text}</div>;
}
