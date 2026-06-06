import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArchiveRestore, Boxes, CheckCircle2, Clock, CreditCard, History, Package, RefreshCcw, ShieldAlert, UserRound } from 'lucide-react';
import api from '../../api/axios';

const arr = (v) => Array.isArray(v) ? v : [];
const time = (v) => v ? new Date(v).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';
const dayKey = (v) => v ? new Date(v).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Без дати';
const todayKey = () => new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });

const statusMap = {
  ORDERED: 'Очікує товар',
  ARRIVED: 'Приїхало',
  RECEIVED: 'Отримано',
  AVAILABLE: 'Доступно',
  UNAVAILABLE: 'Недоступно',
  RESERVED: 'У резерві',
  SOLD: 'Продано',
  RETURNED: 'Повернено',
  DEFECTIVE: 'Брак',
  CANCELLED: 'Скасовано',
  CANCELED: 'Скасовано',
  COMPLETED: 'Виконано',
  DONE: 'Готове',
  READY: 'Готове',
  IN_PROGRESS: 'В роботі',
  WAITING: 'Очікує',
  SHIPPED: 'Відправлено',
  PAID: 'Оплачено',
  UNPAID: 'Не оплачено',
  PREPAID: 'Передплата',
  PARTIAL: 'Часткова оплата',
  NEW: 'Новий',
};

const fieldMap = {
  quantity: 'Кількість',
  buy_price: 'Закупка',
  sell_price: 'Продаж',
  status: 'Статус',
  client: 'Клієнт',
  phone: 'Телефон',
  delivery: 'Доставка',
  ttn: 'ТТН',
  payment_status: 'Оплата',
  prepaid_amount: 'Передплата',
  amount: 'Сума',
};

const moneyFields = new Set(['buy_price', 'sell_price', 'amount', 'prepaid_amount', 'paid', 'debt']);
const qtyFields = new Set(['quantity', 'qty']);

const actionConfig = (type = '') => {
  if (type.startsWith('payment')) return { icon: CreditCard, dot: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-100', iconBox: 'bg-emerald-100 text-emerald-700' };
  if (type.startsWith('stock')) return { icon: Boxes, dot: 'bg-blue-500', card: 'bg-blue-50 border-blue-100', iconBox: 'bg-blue-100 text-blue-700' };
  if (type.includes('return')) return { icon: ArchiveRestore, dot: 'bg-amber-500', card: 'bg-amber-50 border-amber-100', iconBox: 'bg-amber-100 text-amber-700' };
  if (type.includes('cancel') || type.includes('defective') || type.includes('deleted')) return { icon: ShieldAlert, dot: 'bg-rose-500', card: 'bg-rose-50 border-rose-100', iconBox: 'bg-rose-100 text-rose-700' };
  if (type.includes('client')) return { icon: UserRound, dot: 'bg-violet-500', card: 'bg-violet-50 border-violet-100', iconBox: 'bg-violet-100 text-violet-700' };
  if (type.includes('status') || type.includes('created') || type.includes('completed')) return { icon: CheckCircle2, dot: 'bg-indigo-500', card: 'bg-indigo-50 border-indigo-100', iconBox: 'bg-indigo-100 text-indigo-700' };
  return { icon: Package, dot: 'bg-slate-400', card: 'bg-white border-slate-200', iconBox: 'bg-slate-100 text-slate-600' };
};

const tryJson = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
};

const normalizeKey = (key) => String(key || '').toLowerCase();
const cleanNumber = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return String(value ?? '—');
  return num.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
};
const humanValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  const k = normalizeKey(key);
  const raw = String(value);
  const upper = raw.toUpperCase();
  if (statusMap[upper]) return statusMap[upper];
  if (moneyFields.has(k)) return `${cleanNumber(value)} ₴`;
  if (qtyFields.has(k)) return `${cleanNumber(value)} шт`;
  return raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
};

const humanField = (key) => fieldMap[normalizeKey(key)] || String(key || '').replaceAll('_', ' ');

const diffFromValues = (oldValue, newValue) => {
  const oldJson = tryJson(oldValue);
  const newJson = tryJson(newValue);
  if (oldJson && newJson && typeof oldJson === 'object' && typeof newJson === 'object' && !Array.isArray(oldJson) && !Array.isArray(newJson)) {
    const keys = Array.from(new Set([...Object.keys(oldJson), ...Object.keys(newJson)]));
    return keys
      .filter((key) => String(oldJson[key] ?? '') !== String(newJson[key] ?? ''))
      .slice(0, 4)
      .map((key) => ({ label: humanField(key), oldText: humanValue(key, oldJson[key]), newText: humanValue(key, newJson[key]) }));
  }
  if (oldValue || newValue) {
    return [{ label: 'Зміна', oldText: humanValue('', oldValue), newText: humanValue('', newValue) }];
  }
  return [];
};

const humanDescription = (text = '') => {
  let result = String(text || '');
  Object.entries(statusMap).forEach(([key, label]) => {
    result = result.replaceAll(key, label);
  });
  return result;
};

export default function ActivityTimeline({ visitId, phone, mode, type, query = {}, limit = 80, compact = false, title = 'Історія дій' }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, value); });
      if (visitId) params.set('visit', visitId);
      if (phone) params.set('phone', phone);
      if (mode) params.set('mode', mode);
      if (type) params.set('type', type);
      params.set('limit', query?.limit || limit);
      const res = await api.get(`/api/activity/?${params.toString()}`);
      setItems(arr(res.data?.results));
      setSummary(res.data?.summary || null);
    } catch (e) {
      setError('Не вдалося завантажити історію дій.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visitId, phone, mode, type, limit, JSON.stringify(query || {})]);

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

    {!compact && summary && <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
      <MiniStat label="Усього" value={summary.total} />
      <MiniStat label="Оплати" value={summary.payments} tone="emerald" />
      <MiniStat label="Склад" value={summary.stock} tone="blue" />
      <MiniStat label="Повернення" value={summary.returns} tone="amber" />
      <MiniStat label="Скасування" value={summary.cancels} tone="rose" />
    </div>}

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

function MiniStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-900 border-slate-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
    <p className="text-[10px] font-black uppercase opacity-60">{label}</p>
    <p className="text-xl font-black">{value ?? 0}</p>
  </div>;
}

function ActivityItem({ item }) {
  const cfg = actionConfig(item.action_type);
  const Icon = cfg.icon;
  const diffs = diffFromValues(item.old_value, item.new_value);
  return <div className="relative">
    <span className={`absolute -left-[20px] top-5 w-3.5 h-3.5 rounded-full ring-4 ring-white ${cfg.dot}`} />
    <div className={`rounded-2xl border p-3 md:p-4 ${cfg.card}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 shrink-0 rounded-2xl flex items-center justify-center ${cfg.iconBox}`}><Icon size={17}/></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <p className="font-black text-slate-900 leading-tight">{humanDescription(item.title || 'Дія')}</p>
            <span className="text-[11px] font-black text-slate-400">{time(item.created_at)} · {item.actor || 'Система'}</span>
          </div>
          {item.description && <p className="text-sm font-bold text-slate-600 mt-1 break-words">{humanDescription(item.description)}</p>}
          {diffs.length > 0 && <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {diffs.map((diff, idx) => <div key={`${diff.label}-${idx}`} className="bg-white/75 border border-white rounded-xl px-3 py-2">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{diff.label}</p>
              <p className="text-xs font-black text-slate-500">Було: <span className="text-slate-700">{diff.oldText}</span></p>
              <p className="text-xs font-black text-slate-500">Стало: <span className="text-slate-900">{diff.newText}</span></p>
            </div>)}
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
