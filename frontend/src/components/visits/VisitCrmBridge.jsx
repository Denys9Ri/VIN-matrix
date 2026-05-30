import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarClock, CheckCircle2, ClipboardList, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios';

const emptyRec = { title: '', description: '', due_date: '', due_mileage: '', status: 'active' };
const emptyTask = { title: '', description: '', due_date: '', status: 'new' };
const colors = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  soon: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
};

const fmtDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Без дати';

function readCar(visit) {
  try {
    const data = JSON.parse(visit?.delivery_data || '{}');
    return [data.brand, data.model, data.year].filter(Boolean).join(' ').trim();
  } catch {
    return '';
  }
}

export default function VisitCrmBridge() {
  const location = useLocation();
  const [anchor, setAnchor] = useState(null);
  const [visit, setVisit] = useState(null);
  const [items, setItems] = useState({ recommendations: [], tasks: [] });
  const [mode, setMode] = useState(null);
  const [rec, setRec] = useState(emptyRec);
  const [task, setTask] = useState(emptyTask);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (location.pathname !== '/visits') return undefined;
    let stopped = false;
    const sync = async () => {
      const title = Array.from(document.querySelectorAll('h3')).find((el) => (el.textContent || '').includes('Внутрішній коментар'));
      const commentBox = title?.closest('div.mt-6') || title?.parentElement;
      const modalCard = title?.closest('[class*="max-w-4xl"]');
      const plate = (modalCard?.querySelector('h2')?.textContent || '').trim();
      if (!commentBox || !modalCard || !plate) {
        setAnchor(null);
        setVisit(null);
        return;
      }
      let node = document.getElementById('visit-crm-bridge-anchor');
      if (!node) {
        node = document.createElement('div');
        node.id = 'visit-crm-bridge-anchor';
        node.className = 'no-print-area';
        commentBox.parentNode.insertBefore(node, commentBox);
      }
      if (!stopped) setAnchor(node);
      if (visit?.plate === plate) return;
      try {
        const response = await api.get(`/api/visits/?search=${encodeURIComponent(plate)}`);
        const list = Array.isArray(response.data) ? response.data : [];
        const found = list.find((v) => String(v.plate || '').toUpperCase() === plate.toUpperCase()) || list[0];
        if (!stopped) setVisit(found || null);
      } catch {
        if (!stopped) setMsg('Не вдалося знайти візит для CRM.');
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { stopped = true; observer.disconnect(); };
  }, [location.pathname, visit?.plate]);

  const load = async () => {
    if (!visit?.id) return;
    try {
      const [recResponse, taskResponse] = await Promise.all([
        api.get(`/api/recommendations/?visit=${visit.id}`),
        api.get(`/api/crm-tasks/?visit=${visit.id}`),
      ]);
      setItems({
        recommendations: Array.isArray(recResponse.data) ? recResponse.data : [],
        tasks: Array.isArray(taskResponse.data) ? taskResponse.data : [],
      });
    } catch {
      setMsg('Не вдалося завантажити CRM.');
    }
  };

  useEffect(() => { load(); }, [visit?.id]);

  const basePayload = () => ({ visit: visit.id, client: visit.client || '', phone: visit.phone || '', plate: visit.plate || '', car: readCar(visit) });

  const saveRec = async (event) => {
    event.preventDefault();
    if (!rec.title.trim()) return;
    try {
      await api.post('/api/recommendations/', { ...basePayload(), ...rec, due_date: rec.due_date || null, due_mileage: rec.due_mileage ? Number(rec.due_mileage) : null });
      setRec(emptyRec); setMode(null); setMsg('Рекомендацію додано.'); load();
    } catch { setMsg('Не вдалося додати рекомендацію.'); }
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (!task.title.trim()) return;
    try {
      await api.post('/api/crm-tasks/', { ...basePayload(), ...task, due_date: task.due_date || null });
      setTask(emptyTask); setMode(null); setMsg('Задачу додано.'); load();
    } catch { setMsg('Не вдалося додати задачу.'); }
  };

  const markDone = async (type, item) => {
    try {
      await api.post(`/api/${type}/${item.id}/mark-done/`);
      load();
    } catch { setMsg('Не вдалося змінити статус.'); }
  };

  const remove = async (type, item) => {
    if (!window.confirm(`Видалити “${item.title}”?`)) return;
    try {
      await api.delete(`/api/${type}/${item.id}/`);
      load();
    } catch { setMsg('Не вдалося видалити.'); }
  };

  if (!anchor || !visit?.id) return null;

  const urgent = items.recommendations.filter((item) => ['soon', 'overdue'].includes(item.state)).length;

  return createPortal(
    <div className="mt-6 bg-white border border-blue-100 rounded-3xl shadow-sm overflow-hidden">
      <div className="p-4 md:p-5 bg-blue-50/70 border-b border-blue-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black uppercase text-slate-900 flex items-center gap-2 text-sm md:text-base"><ClipboardList size={18} className="text-blue-600"/> CRM по цьому візиту</h3>
          <p className="text-xs font-bold text-slate-500 mt-1 break-words">{visit.client} · {visit.phone} · {visit.plate}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Рек." value={items.recommendations.filter((item) => !['done', 'cancelled'].includes(item.state)).length}/>
          <Stat label="Задачі" value={items.tasks.filter((item) => item.state !== 'done').length}/>
          <Stat label="Скоро" value={urgent} danger={urgent > 0}/>
        </div>
      </div>
      {msg && <div className="mx-4 md:mx-5 mt-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl px-3 py-2 text-xs font-bold flex items-center justify-between"><span>{msg}</span><button onClick={() => setMsg('')}><X size={14}/></button></div>}
      <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Рекомендації" icon={<ClipboardList size={16}/>} label="+ Рекомендація" onAdd={() => setMode(mode === 'rec' ? null : 'rec')}>
          {mode === 'rec' && <RecForm form={rec} setForm={setRec} onSave={saveRec}/>} 
          {items.recommendations.length ? items.recommendations.map((item) => <CrmItem key={item.id} item={item} onDone={() => markDone('recommendations', item)} onDelete={() => remove('recommendations', item)}/>) : <Empty text="Рекомендацій ще немає"/>}
        </Panel>
        <Panel title="Задачі" icon={<CheckCircle2 size={16}/>} label="+ Задача" onAdd={() => setMode(mode === 'task' ? null : 'task')}>
          {mode === 'task' && <TaskForm form={task} setForm={setTask} onSave={saveTask}/>} 
          {items.tasks.length ? items.tasks.map((item) => <CrmItem key={item.id} item={item} onDone={() => markDone('crm-tasks', item)} onDelete={() => remove('crm-tasks', item)}/>) : <Empty text="Задач ще немає"/>}
        </Panel>
      </div>
      {urgent > 0 && <div className="mx-4 md:mx-5 mb-4 md:mb-5 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2 text-xs font-bold text-amber-800"><Bell size={16} className="shrink-0"/> Є рекомендації для повторного звернення.</div>}
    </div>, anchor
  );
}

function Stat({ label, value, danger }) {
  return <div className={`rounded-2xl border px-3 py-2 text-center ${danger ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-white border-slate-200 text-slate-700'}`}><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="text-lg font-black leading-none">{value}</p></div>;
}

function Panel({ title, icon, label, onAdd, children }) {
  return <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 md:p-4 min-w-0"><div className="flex items-center justify-between gap-2 mb-3"><h4 className="font-black uppercase text-slate-700 text-xs flex items-center gap-2">{icon}{title}</h4><button onClick={onAdd} className="text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl whitespace-nowrap">{label}</button></div><div className="space-y-2">{children}</div></div>;
}

function RecForm({ form, setForm, onSave }) {
  return <form onSubmit={onSave} className="bg-white border border-blue-100 rounded-2xl p-3 mb-3 space-y-2"><input required value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})} placeholder="Що рекомендуємо?" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"/><textarea value={form.description} onChange={(event)=>setForm({...form,description:event.target.value})} placeholder="Коментар" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 resize-none"/><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input type="date" value={form.due_date} onChange={(event)=>setForm({...form,due_date:event.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"/><input type="number" value={form.due_mileage} onChange={(event)=>setForm({...form,due_mileage:event.target.value})} placeholder="Пробіг" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"/></div><button className="w-full bg-blue-600 text-white rounded-xl py-2 text-[10px] font-black uppercase">Зберегти</button></form>;
}

function TaskForm({ form, setForm, onSave }) {
  return <form onSubmit={onSave} className="bg-white border border-blue-100 rounded-2xl p-3 mb-3 space-y-2"><input required value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})} placeholder="Назва задачі" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"/><textarea value={form.description} onChange={(event)=>setForm({...form,description:event.target.value})} placeholder="Коментар" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 resize-none"/><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input type="date" value={form.due_date} onChange={(event)=>setForm({...form,due_date:event.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"/><select value={form.status} onChange={(event)=>setForm({...form,status:event.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"><option value="new">Нова</option><option value="in_progress">В роботі</option><option value="done">Виконана</option></select></div><button className="w-full bg-blue-600 text-white rounded-xl py-2 text-[10px] font-black uppercase">Зберегти</button></form>;
}

function CrmItem({ item, onDone, onDelete }) {
  const isDone = item.state === 'done' || item.status === 'done';
  return <div className="bg-white border border-slate-200 rounded-2xl p-3 min-w-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-black text-slate-800 text-sm leading-tight break-words">{item.title}</p>{item.description && <p className="text-xs font-medium text-slate-500 mt-1 break-words">{item.description}</p>}</div><span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${colors[item.state] || colors[item.status] || colors.active}`}>{item.state_label || item.status}</span></div><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><CalendarClock size={12}/> {fmtDate(item.due_date)} {item.due_mileage ? `· ${item.due_mileage} км` : ''}</p><div className="flex gap-2">{!isDone && <button onClick={onDone} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">Виконано</button>}<button onClick={onDelete} className="bg-rose-50 text-rose-700 px-2 py-1.5 rounded-lg"><Trash2 size={13}/></button></div></div></div>;
}

function Empty({ text }) { return <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-4 text-center text-xs font-bold text-slate-400">{text}</div>; }
