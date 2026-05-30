import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ListChecks, MessageSquareText, PhoneCall, Plus, UserRound } from 'lucide-react';
import CopyButton from '../common/CopyButton';
import NextServicePanel from './NextServicePanel';
import api from '../../api/axios';

const statuses = [
  ['called', 'Дзвонили клієнту'],
  ['no_answer', 'Клієнт не відповів'],
  ['call_back', 'Домовились передзвонити'],
  ['refused', 'Клієнт відмовився'],
  ['thinking', 'Клієнт думає'],
  ['agreed', 'Клієнт погодився'],
];

const clientStatuses = [
  ['new', 'Новий'],
  ['active', 'Активний'],
  ['regular', 'Постійний'],
  ['sleeping', 'Сплячий'],
  ['problem', 'Проблемний'],
  ['vip', 'VIP'],
];

const statusClass = {
  called: 'bg-blue-50 text-blue-700 border-blue-100',
  no_answer: 'bg-slate-100 text-slate-600 border-slate-200',
  call_back: 'bg-amber-50 text-amber-700 border-amber-100',
  refused: 'bg-rose-50 text-rose-700 border-rose-100',
  thinking: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  agreed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const clientStatusClass = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  regular: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  sleeping: 'bg-slate-100 text-slate-600 border-slate-200',
  problem: 'bg-rose-50 text-rose-700 border-rose-100',
  vip: 'bg-amber-50 text-amber-700 border-amber-100',
};

const statusLabel = (value) => statuses.find((item) => item[0] === value)?.[1] || 'Контакт';
const clientStatusLabel = (value) => clientStatuses.find((item) => item[0] === value)?.[1] || 'Новий';
const today = () => new Date().toISOString().slice(0, 10);

const parseMileageFromVisit = (visit) => {
  if (!visit) return null;
  if (visit.mileage || visit.odometer || visit.run || visit.car_mileage) return visit.mileage || visit.odometer || visit.run || visit.car_mileage;
  if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(visit.delivery_data);
      return parsed.mileage || parsed.probig || null;
    } catch {
      return null;
    }
  }
  return null;
};

export default function ClientCommunicationPanel({ selectedGroup, lastVisit, onRepeat, onAddRecommendation, onTaskCreated, compact = false }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ status: 'called', comment: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [clientStatus, setClientStatus] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: 'new', note: '' });
  const [savingStatus, setSavingStatus] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedGroup?.phone && selectedGroup.phone !== '—') params.set('phone', selectedGroup.phone);
    if (selectedGroup?.plate && selectedGroup.plate !== '—') params.set('plate', selectedGroup.plate);
    if (selectedGroup?.client) params.set('client', selectedGroup.client);
    return params.toString();
  }, [selectedGroup]);

  const loadItems = async () => {
    if (!selectedGroup || !query) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/crm-communications/?${query}`);
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClientStatus = async () => {
    if (!selectedGroup || !query) return;
    try {
      const response = await api.get(`/api/crm-client-statuses/?${query}`);
      const first = Array.isArray(response.data) && response.data.length ? response.data[0] : null;
      setClientStatus(first);
      setStatusForm({ status: first?.status || 'new', note: first?.note || '' });
    } catch {
      setClientStatus(null);
      setStatusForm({ status: 'new', note: '' });
    }
  };

  useEffect(() => {
    loadItems();
    loadClientStatus();
  }, [query]);

  const addCommunication = async (event) => {
    event?.preventDefault();
    if (!selectedGroup || saving) return;
    setSaving(true);
    try {
      await api.post('/api/crm-communications/', {
        visit: lastVisit?.id || null,
        client: selectedGroup.client || '',
        phone: selectedGroup.phone || '',
        plate: selectedGroup.plate || '',
        status: form.status,
        comment: form.comment.trim(),
      });
      setForm({ status: 'called', comment: '' });
      await loadItems();
    } catch {
      alert('Не вдалося додати запис комунікації.');
    } finally {
      setSaving(false);
    }
  };

  const saveClientStatus = async (event) => {
    event?.preventDefault();
    if (!selectedGroup || savingStatus) return;
    setSavingStatus(true);
    const payload = {
      client: selectedGroup.client || '',
      phone: selectedGroup.phone || '',
      plate: selectedGroup.plate || '',
      status: statusForm.status,
      note: statusForm.note.trim(),
    };
    try {
      if (clientStatus?.id) await api.patch(`/api/crm-client-statuses/${clientStatus.id}/`, payload);
      else await api.post('/api/crm-client-statuses/', payload);
      await loadClientStatus();
    } catch {
      alert('Не вдалося зберегти статус клієнта.');
    } finally {
      setSavingStatus(false);
    }
  };

  const createCallTask = async () => {
    if (!selectedGroup || savingTask) return;
    setSavingTask(true);
    try {
      await api.post('/api/crm-tasks/', {
        client: selectedGroup.client || '',
        phone: selectedGroup.phone || '',
        plate: selectedGroup.plate || '',
        title: `Передзвонити: ${selectedGroup.client || selectedGroup.plate || 'клієнт'}`,
        description: 'Створено зі швидкої дії в картці клієнта',
        due_date: today(),
        status: 'new',
      });
      onTaskCreated?.();
    } catch {
      alert('Не вдалося створити задачу на дзвінок.');
    } finally {
      setSavingTask(false);
    }
  };

  const shownItems = compact ? items.slice(0, 2) : items;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl sm:rounded-2xl border border-slate-200 p-5 sm:p-4 shadow-sm min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base sm:text-sm font-black text-slate-800 flex items-center gap-2 min-w-0">
            <MessageSquareText size={18} className="text-blue-600" />
            <span className="break-words">Комунікація з клієнтом</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${clientStatusClass[statusForm.status] || clientStatusClass.new}`}>Статус: {clientStatus?.status_label || clientStatusLabel(statusForm.status)}</span>
            <span className="text-[10px] font-black uppercase text-slate-400">Записів: {items.length}</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <UserRound size={16} className="text-slate-500" />
            <p className="text-xs font-black uppercase text-slate-500">Ручний статус клієнта</p>
          </div>
          <form onSubmit={saveClientStatus} className="grid grid-cols-1 lg:grid-cols-[180px_1fr_auto] gap-2">
            <select value={statusForm.status} onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500">
              {clientStatuses.map(([keyValue, label]) => <option key={keyValue} value={keyValue}>{label}</option>)}
            </select>
            <input value={statusForm.note} onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })} placeholder="Примітка до статусу, наприклад: VIP, бо обслуговує 3 авто" className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
            <button disabled={savingStatus} className="bg-slate-900 text-white rounded-xl px-4 py-3 text-xs font-black uppercase disabled:opacity-50">{savingStatus ? 'Зберігаю...' : 'Зберегти статус'}</button>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-4">
          <button type="button" onClick={() => window.location.assign(`tel:${selectedGroup?.phone || ''}`)} className="bg-emerald-600 text-white rounded-2xl py-3 px-2 text-xs font-black uppercase flex items-center justify-center gap-2"><PhoneCall size={15} /> Подзвонити</button>
          <button type="button" onClick={() => lastVisit && onRepeat?.(lastVisit)} disabled={!lastVisit} className="bg-slate-900 disabled:opacity-50 text-white rounded-2xl py-3 px-2 text-xs font-black uppercase flex items-center justify-center gap-2"><Plus size={15} /> Створити візит</button>
          <button type="button" onClick={onAddRecommendation} className="bg-blue-50 text-blue-700 rounded-2xl py-3 px-2 text-xs font-black uppercase flex items-center justify-center gap-2"><ClipboardList size={15} /> Рекомендація</button>
          <button type="button" onClick={createCallTask} disabled={savingTask} className="bg-indigo-50 text-indigo-700 rounded-2xl py-3 px-2 text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><ListChecks size={15} /> {savingTask ? 'Створюю' : 'Задача'}</button>
          <CopyButton value={selectedGroup?.phone || ''} label="Телефон" copiedLabel="Скопійовано" />
          <CopyButton value={selectedGroup?.vin || ''} label="VIN" copiedLabel="Скопійовано" />
          <CopyButton value={selectedGroup?.plate || ''} label="Номер" copiedLabel="Скопійовано" />
        </div>

        {!compact && (
          <form onSubmit={addCommunication} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[230px_1fr] gap-2">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500">
                {statuses.map(([keyValue, label]) => <option key={keyValue} value={keyValue}>{label}</option>)}
              </select>
              <input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Коментар менеджера" className="bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500" />
            </div>
            <button disabled={saving} className="w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase disabled:opacity-50">{saving ? 'Зберігаю...' : 'Додати запис комунікації'}</button>
          </form>
        )}

        {loading ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 sm:p-4 text-base sm:text-sm font-semibold text-slate-400 text-center">Завантаження комунікації...</div> : items.length === 0 ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 sm:p-4 text-base sm:text-sm font-semibold text-slate-400 text-center">Історії спілкування ще немає</div> : (
          <div className="space-y-2">
            {shownItems.map((item) => <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><span className={`self-start rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${statusClass[item.status] || statusClass.called}`}>{item.status_label || statusLabel(item.status)}</span><span className="text-[11px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('uk-UA')}</span></div>{item.comment && <p className="text-sm font-semibold text-slate-600 mt-2 break-words">{item.comment}</p>}</div>)}
            {compact && items.length > 2 && <p className="text-xs font-bold text-slate-400 text-center">Ще записів: {items.length - 2}</p>}
          </div>
        )}
      </div>

      {!compact && <NextServicePanel selectedGroup={selectedGroup} lastVisit={lastVisit} lastMileage={parseMileageFromVisit(lastVisit)} />}
    </div>
  );
}
