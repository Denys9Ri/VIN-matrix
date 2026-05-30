import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Gauge, Plus, Wrench } from 'lucide-react';
import api from '../../api/axios';

const reminderTypes = [
  ['oil', 'Заміна масла'],
  ['filters', 'Фільтри'],
  ['brakes', 'Гальма'],
  ['tires', 'Сезонна заміна шин'],
  ['maintenance', 'ТО'],
];

const badgeClass = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const formatDate = (value) => {
  if (!value) return 'Без дати';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMileage = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'Без пробігу';
  return `${number.toLocaleString('uk-UA')} км`;
};

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
};
const nextSeasonDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const target = month >= 4 && month <= 9 ? new Date(year, 9, 1) : new Date(month >= 10 ? year + 1 : year, 3, 1);
  return target.toISOString().slice(0, 10);
};

const defaultsByType = (type, currentMileage) => {
  const mileage = Number(currentMileage) || 0;
  const map = {
    oil: { due_date: addMonths(12), due_mileage: mileage ? mileage + 10000 : '' },
    filters: { due_date: addMonths(12), due_mileage: mileage ? mileage + 10000 : '' },
    brakes: { due_date: addMonths(6), due_mileage: '' },
    tires: { due_date: nextSeasonDate(), due_mileage: '' },
    maintenance: { due_date: addMonths(12), due_mileage: mileage ? mileage + 10000 : '' },
  };
  return map[type] || map.maintenance;
};

export default function NextServicePanel({ selectedGroup, lastVisit, lastMileage }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ reminder_type: 'oil', title: 'Заміна масла', due_date: today(), due_mileage: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedGroup?.phone && selectedGroup.phone !== '—') params.set('phone', selectedGroup.phone);
    if (selectedGroup?.plate && selectedGroup.plate !== '—') params.set('plate', selectedGroup.plate);
    if (selectedGroup?.client) params.set('client', selectedGroup.client);
    params.set('status', 'active');
    return params.toString();
  }, [selectedGroup]);

  const loadItems = async () => {
    if (!selectedGroup || !query) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/crm-service-reminders/?${query}`);
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [query]);

  useEffect(() => {
    const typeLabel = reminderTypes.find((item) => item[0] === form.reminder_type)?.[1] || 'ТО';
    const next = defaultsByType(form.reminder_type, lastMileage);
    setForm((prev) => ({ ...prev, title: typeLabel, due_date: next.due_date, due_mileage: next.due_mileage }));
  }, [form.reminder_type, lastMileage]);

  const createReminder = async (event) => {
    event?.preventDefault();
    if (!selectedGroup || saving) return;
    setSaving(true);
    try {
      await api.post('/api/crm-service-reminders/', {
        visit: lastVisit?.id || null,
        client: selectedGroup.client || '',
        phone: selectedGroup.phone || '',
        plate: selectedGroup.plate || '',
        reminder_type: form.reminder_type,
        title: form.title || reminderTypes.find((item) => item[0] === form.reminder_type)?.[1] || 'ТО',
        due_date: form.due_date || null,
        due_mileage: form.due_mileage ? Number(form.due_mileage) : null,
        note: form.note || '',
        status: 'active',
      });
      setForm((prev) => ({ ...prev, note: '' }));
      await loadItems();
    } catch {
      alert('Не вдалося додати нагадування по обслуговуванню.');
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (item) => {
    try {
      await api.patch(`/api/crm-service-reminders/${item.id}/`, { status: 'done' });
      await loadItems();
    } catch {
      alert('Не вдалося закрити нагадування.');
    }
  };

  return (
    <div className="bg-white rounded-3xl sm:rounded-2xl border border-slate-200 p-5 sm:p-4 shadow-sm min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-sm font-black text-slate-800 flex items-center gap-2 min-w-0">
          <Wrench size={18} className="text-amber-600" />
          <span className="break-words">Наступне обслуговування</span>
        </h3>
        <span className="text-[10px] font-black uppercase text-slate-400">Активних: {items.length}</span>
      </div>

      <form onSubmit={createReminder} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_160px_160px] gap-2">
          <select value={form.reminder_type} onChange={(event) => setForm({ ...form, reminder_type: event.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500">
            {reminderTypes.map(([keyValue, label]) => <option key={keyValue} value={keyValue}>{label}</option>)}
          </select>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Назва" className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
          <input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
          <input type="number" value={form.due_mileage} onChange={(event) => setForm({ ...form, due_mileage: event.target.value })} placeholder="Пробіг" className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
        </div>
        <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Коментар, наприклад: масло 5W-30, фільтр салону перевірити" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
        <button disabled={saving} className="w-full bg-amber-600 text-white rounded-xl py-3 text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"><Plus size={15} /> {saving ? 'Додаю...' : 'Додати нагадування'}</button>
      </form>

      {loading ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 sm:p-4 text-base sm:text-sm font-semibold text-slate-400 text-center">Завантаження нагадувань...</div> : items.length === 0 ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 sm:p-4 text-base sm:text-sm font-semibold text-slate-400 text-center">Активних нагадувань по обслуговуванню немає</div> : (
        <div className="space-y-2">
          {items.map((item) => <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div className="min-w-0"><p className="font-black text-slate-800 text-sm break-words">{item.title || item.reminder_type_label}</p><div className="flex flex-wrap gap-2 mt-2 text-[11px] font-bold text-slate-500"><span className="flex items-center gap-1"><CalendarDays size={13} /> {formatDate(item.due_date)}</span><span className="flex items-center gap-1"><Gauge size={13} /> {formatMileage(item.due_mileage)}</span></div>{item.note && <p className="text-sm font-semibold text-slate-600 mt-2 break-words">{item.note}</p>}</div><div className="flex flex-col gap-2 shrink-0"><span className={`self-start rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${badgeClass[item.status] || badgeClass.active}`}>{item.status_label || 'Активне'}</span><button type="button" onClick={() => markDone(item)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Виконано</button></div></div></div>)}
        </div>
      )}
    </div>
  );
}
