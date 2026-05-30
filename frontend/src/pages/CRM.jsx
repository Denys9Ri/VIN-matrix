import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Bell, CalendarClock, CheckCircle2, ClipboardList, Plus, Search, Users, X, PhoneCall, CarFront, Clock3 } from 'lucide-react';
import api from '../api/axios';
import Clients from './Clients';

const tabs = [
  { key: 'clients', label: 'Клієнти', icon: Users, path: '/crm/clients' },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList, path: '/crm/recommendations' },
  { key: 'tasks', label: 'Задачі', icon: CheckCircle2, path: '/crm/tasks' },
  { key: 'follow-ups', label: 'Повторні візити', icon: CalendarClock, path: '/crm/follow-ups' },
];

const badge = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  soon: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
};

const emptyRecommendationForm = { client: '', phone: '', plate: '', car: '', title: '', description: '', due_date: '', due_mileage: '', status: 'active' };
const emptyTaskForm = { client: '', phone: '', plate: '', title: '', description: '', due_date: '', status: 'new' };
const fmtDate = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Без дати';

export default function CRM() {
  const { tab = 'clients' } = useParams();
  const navigate = useNavigate();
  const activeTab = ['clients', 'recommendations', 'tasks', 'follow-ups'].includes(tab) ? tab : 'clients';
  const [recommendations, setRecommendations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [recForm, setRecForm] = useState(emptyRecommendationForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [message, setMessage] = useState('');

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/recommendations/');
      setRecommendations(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMessage('Не вдалося завантажити рекомендації.');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/crm-tasks/');
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMessage('Не вдалося завантажити задачі.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
    loadTasks();
  }, []);

  useEffect(() => {
    setFilter('all');
    setSearch('');
  }, [activeTab]);

  const recStats = useMemo(() => ({
    active: recommendations.filter(i => i.state === 'active').length,
    soon: recommendations.filter(i => i.state === 'soon').length,
    overdue: recommendations.filter(i => i.state === 'overdue').length,
    done: recommendations.filter(i => i.state === 'done').length,
  }), [recommendations]);

  const taskStats = useMemo(() => ({
    new: tasks.filter(i => i.state === 'new').length,
    in_progress: tasks.filter(i => i.state === 'in_progress').length,
    overdue: tasks.filter(i => i.state === 'overdue').length,
    done: tasks.filter(i => i.state === 'done').length,
  }), [tasks]);

  const recommendationList = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recommendations.filter(i => {
      const okFilter = filter === 'all' || i.state === filter || i.status === filter;
      const text = [i.client, i.phone, i.plate, i.car, i.title, i.description].filter(Boolean).join(' ').toLowerCase();
      return okFilter && (!q || text.includes(q));
    });
  }, [recommendations, search, filter]);

  const taskList = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter(i => {
      const okFilter = filter === 'all' || i.state === filter || i.status === filter;
      const text = [i.client, i.phone, i.plate, i.title, i.description].filter(Boolean).join(' ').toLowerCase();
      return okFilter && (!q || text.includes(q));
    });
  }, [tasks, search, filter]);

  const followUps = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recommendations
      .filter(i => ['soon', 'overdue'].includes(i.state))
      .filter(i => {
        const text = [i.client, i.phone, i.plate, i.car, i.title, i.description].filter(Boolean).join(' ').toLowerCase();
        return !q || text.includes(q);
      })
      .sort((a, b) => (a.state === 'overdue' ? -1 : 1) - (b.state === 'overdue' ? -1 : 1));
  }, [recommendations, search]);

  const openCreateRecommendation = () => { setEditing(null); setRecForm(emptyRecommendationForm); setModal('recommendation'); };
  const openEditRecommendation = (item) => { setEditing(item); setRecForm({ ...emptyRecommendationForm, ...item, due_mileage: item.due_mileage || '' }); setModal('recommendation'); };
  const openCreateTask = () => { setEditing(null); setTaskForm(emptyTaskForm); setModal('task'); };
  const openEditTask = (item) => { setEditing(item); setTaskForm({ ...emptyTaskForm, ...item }); setModal('task'); };

  const saveRecommendation = async (e) => {
    e.preventDefault();
    if (!recForm.title.trim()) return setMessage('Вкажіть назву рекомендації.');
    const payload = { ...recForm, due_date: recForm.due_date || null, due_mileage: recForm.due_mileage ? Number(recForm.due_mileage) : null };
    try {
      if (editing?.id) await api.patch(`/api/recommendations/${editing.id}/`, payload);
      else await api.post('/api/recommendations/', payload);
      setModal(null); setMessage(editing ? 'Рекомендацію оновлено.' : 'Рекомендацію створено.'); loadRecommendations();
    } catch { setMessage('Не вдалося зберегти рекомендацію.'); }
  };

  const saveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return setMessage('Вкажіть назву задачі.');
    const payload = { ...taskForm, due_date: taskForm.due_date || null };
    try {
      if (editing?.id) await api.patch(`/api/crm-tasks/${editing.id}/`, payload);
      else await api.post('/api/crm-tasks/', payload);
      setModal(null); setMessage(editing ? 'Задачу оновлено.' : 'Задачу створено.'); loadTasks();
    } catch { setMessage('Не вдалося зберегти задачу.'); }
  };

  const markRecDone = async (item) => { try { await api.post(`/api/recommendations/${item.id}/mark-done/`); loadRecommendations(); } catch { setMessage('Не вдалося змінити статус.'); } };
  const removeRec = async (item) => { if (!window.confirm(`Видалити рекомендацію “${item.title}”?`)) return; try { await api.delete(`/api/recommendations/${item.id}/`); loadRecommendations(); } catch { setMessage('Не вдалося видалити.'); } };
  const markTaskDone = async (item) => { try { await api.post(`/api/crm-tasks/${item.id}/mark-done/`); loadTasks(); } catch { setMessage('Не вдалося змінити статус.'); } };
  const removeTask = async (item) => { if (!window.confirm(`Видалити задачу “${item.title}”?`)) return; try { await api.delete(`/api/crm-tasks/${item.id}/`); loadTasks(); } catch { setMessage('Не вдалося видалити.'); } };

  const createTaskFromFollowUp = (item) => {
    setEditing(null);
    setTaskForm({ client: item.client || '', phone: item.phone || '', plate: item.plate || '', title: `Передзвонити: ${item.title}`, description: `Повторне звернення по рекомендації: ${item.title}`, due_date: new Date().toISOString().slice(0, 10), status: 'new' });
    setModal('task');
  };

  const renderSearchBar = (placeholder = 'Пошук по клієнту, авто, номеру або телефону...') => (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={placeholder} className="w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium"/>
        </div>
        {activeTab !== 'follow-ups' && <button onClick={()=>setFilter('all')} className="bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-black uppercase">Показати всі</button>}
      </div>
    </div>
  );

  return <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen overflow-x-hidden">
    <div className="mb-5 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
      <div className="min-w-0"><h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><Users className="text-blue-600" size={30}/> CRM</h1><p className="text-slate-500 font-semibold mt-1 text-sm md:text-base">Клієнти, рекомендації, задачі та повторні звернення в одному місці.</p></div>
      {activeTab === 'recommendations' && <button onClick={openCreateRecommendation} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"><Plus size={16}/> Додати рекомендацію</button>}
      {activeTab === 'tasks' && <button onClick={openCreateTask} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"><Plus size={16}/> Додати задачу</button>}
    </div>

    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-2 mb-5 overflow-x-auto max-w-full"><div className="flex gap-2 min-w-max md:min-w-0">
      {tabs.map(t => { const Icon = t.icon; const active = activeTab === t.key; return <NavLink key={t.key} to={t.path} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={16}/>{t.label}</NavLink>; })}
    </div></div>

    {message && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between gap-3"><span>{message}</span><button onClick={() => setMessage('')}><X size={16}/></button></div>}

    {activeTab === 'clients' && <Clients embedded />}

    {activeTab === 'recommendations' && <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[[ 'active','Активні',recStats.active,'text-blue-600'],['soon','Скоро',recStats.soon,'text-amber-600'],['overdue','Прострочені',recStats.overdue,'text-rose-600'],['done','Виконані',recStats.done,'text-emerald-600']].map(s => <button key={s[0]} onClick={() => setFilter(s[0])} className="bg-white rounded-3xl border border-slate-200 p-4 text-left shadow-sm hover:border-blue-300"><p className="text-[10px] font-black uppercase text-slate-400">{s[1]}</p><p className={`text-2xl font-black ${s[3]}`}>{s[2]}</p></button>)}
      </div>
      {renderSearchBar('Пошук по клієнту, авто, номеру, телефону або рекомендації...')}
      {loading ? <Empty text="Завантаження..." /> : recommendationList.length === 0 ? <Empty text="Рекомендацій поки немає" /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{recommendationList.map(item => <RecommendationCard key={item.id} item={item} onDone={markRecDone} onEdit={openEditRecommendation} onRemove={removeRec} />)}</div>}
    </div>}

    {activeTab === 'tasks' && <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[[ 'new','Нові',taskStats.new,'text-blue-600'],['in_progress','В роботі',taskStats.in_progress,'text-amber-600'],['overdue','Прострочені',taskStats.overdue,'text-rose-600'],['done','Виконані',taskStats.done,'text-emerald-600']].map(s => <button key={s[0]} onClick={() => setFilter(s[0])} className="bg-white rounded-3xl border border-slate-200 p-4 text-left shadow-sm hover:border-blue-300"><p className="text-[10px] font-black uppercase text-slate-400">{s[1]}</p><p className={`text-2xl font-black ${s[3]}`}>{s[2]}</p></button>)}
      </div>
      {renderSearchBar('Пошук по задачах, клієнту, номеру або телефону...')}
      {loading ? <Empty text="Завантаження..." /> : taskList.length === 0 ? <Empty text="Задач поки немає" /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{taskList.map(item => <TaskCard key={item.id} item={item} onDone={markTaskDone} onEdit={openEditTask} onRemove={removeTask} />)}</div>}
    </div>}

    {activeTab === 'follow-ups' && <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <InfoCard label="Потрібно звʼязатись" value={followUps.length} className="text-blue-600" />
        <InfoCard label="Прострочено" value={recommendations.filter(i => i.state === 'overdue').length} className="text-rose-600" />
        <InfoCard label="Скоро" value={recommendations.filter(i => i.state === 'soon').length} className="text-amber-600" />
      </div>
      {renderSearchBar('Пошук повторних звернень...')}
      {followUps.length === 0 ? <Empty text="Немає клієнтів для повторного звернення" /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{followUps.map(item => <FollowUpCard key={item.id} item={item} onCreateTask={createTaskFromFollowUp} />)}</div>}
    </div>}

    {modal === 'recommendation' && <RecommendationModal form={recForm} setForm={setRecForm} editing={editing} onClose={() => setModal(null)} onSave={saveRecommendation} />}
    {modal === 'task' && <TaskModal form={taskForm} setForm={setTaskForm} editing={editing} onClose={() => setModal(null)} onSave={saveTask} />}
  </div>;
}

function Empty({ text }) {
  return <div className="bg-white rounded-3xl p-10 text-center border border-slate-200"><Bell className="mx-auto text-slate-300 mb-3" size={42}/><p className="font-black text-slate-700">{text}</p></div>;
}

function InfoCard({ label, value, className }) {
  return <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className={`text-2xl font-black ${className}`}>{value}</p></div>;
}

function RecommendationCard({ item, onDone, onEdit, onRemove }) {
  return <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:shadow-md min-w-0"><div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-blue-600 mb-1 truncate">{item.plate || 'Без номера'} · {item.car || 'Авто не вказано'}</p><h2 className="font-black text-lg text-slate-900 leading-tight break-words">{item.title}</h2><p className="text-sm text-slate-500 font-semibold mt-1 break-words">{item.client || 'Клієнт не вказаний'} {item.phone ? `· ${item.phone}` : ''}</p></div><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${badge[item.state] || badge.active}`}>{item.state_label}</span></div>{item.description && <p className="text-sm text-slate-600 font-medium mb-4 bg-slate-50 rounded-2xl p-3 border border-slate-100 break-words">{item.description}</p>}<div className="grid grid-cols-2 gap-2 mb-4"><SmallValue label="Дата" value={fmtDate(item.due_date)} /><SmallValue label="Пробіг" value={item.due_mileage ? `${item.due_mileage} км` : '—'} /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{item.status !== 'done' && <button onClick={()=>onDone(item)} className="bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-emerald-100">Виконано</button>}<button onClick={()=>onEdit(item)} className="bg-blue-50 text-blue-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-blue-100">Редагувати</button><button onClick={()=>onRemove(item)} className="bg-rose-50 text-rose-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-rose-100">Видалити</button></div></div>;
}

function TaskCard({ item, onDone, onEdit, onRemove }) {
  return <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:shadow-md min-w-0"><div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-blue-600 mb-1 truncate">{item.plate || 'Без номера'} {item.client ? `· ${item.client}` : ''}</p><h2 className="font-black text-lg text-slate-900 leading-tight break-words">{item.title}</h2><p className="text-sm text-slate-500 font-semibold mt-1 break-words">{item.phone || 'Телефон не вказаний'}</p></div><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${badge[item.state] || badge.new}`}>{item.state_label}</span></div>{item.description && <p className="text-sm text-slate-600 font-medium mb-4 bg-slate-50 rounded-2xl p-3 border border-slate-100 break-words">{item.description}</p>}<div className="grid grid-cols-1 gap-2 mb-4"><SmallValue label="Крайній термін" value={fmtDate(item.due_date)} /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{item.status !== 'done' && <button onClick={()=>onDone(item)} className="bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-emerald-100">Виконано</button>}<button onClick={()=>onEdit(item)} className="bg-blue-50 text-blue-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-blue-100">Редагувати</button><button onClick={()=>onRemove(item)} className="bg-rose-50 text-rose-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-rose-100">Видалити</button></div></div>;
}

function FollowUpCard({ item, onCreateTask }) {
  return <div className={`rounded-3xl border shadow-sm p-5 min-w-0 ${item.state === 'overdue' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}><div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-slate-500 mb-1 truncate">{item.plate || 'Без номера'} · {item.car || 'Авто не вказано'}</p><h2 className="font-black text-lg text-slate-900 leading-tight break-words">{item.title}</h2><p className="text-sm text-slate-600 font-semibold mt-1 break-words">{item.client || 'Клієнт не вказаний'} {item.phone ? `· ${item.phone}` : ''}</p></div><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${badge[item.state] || badge.active}`}>{item.state_label}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"><SmallValue label="Дата" value={fmtDate(item.due_date)} /><SmallValue label="Пробіг" value={item.due_mileage ? `${item.due_mileage} км` : '—'} /></div><button onClick={() => onCreateTask(item)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2"><PhoneCall size={15}/> Створити задачу на дзвінок</button></div>;
}

function SmallValue({ label, value }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm truncate">{value}</p></div>;
}

function RecommendationModal({ form, setForm, editing, onClose, onSave }) {
  return <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"><form onSubmit={onSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"><ModalHeader title={editing ? 'Редагувати рекомендацію' : 'Нова рекомендація'} subtitle="Що потрібно зробити клієнту пізніше." onClose={onClose} /><div className="p-4 sm:p-5 space-y-3 max-h-[70vh] overflow-y-auto"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Назва рекомендації" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/><textarea value={form.description || ''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Опис / коментар" rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500"/><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[['client','ПІБ клієнта'],['phone','Телефон'],['plate','Держ номер'],['car','Авто']].map(f=><input key={f[0]} value={form[f[0]] || ''} onChange={e=>setForm({...form,[f[0]]:e.target.value})} placeholder={f[1]} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/>)}<input type="date" value={form.due_date || ''} onChange={e=>setForm({...form,due_date:e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/><input type="number" value={form.due_mileage || ''} onChange={e=>setForm({...form,due_mileage:e.target.value})} placeholder="Пробіг" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/></div><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"><option value="active">Активна</option><option value="done">Виконана</option><option value="cancelled">Скасована</option></select></div><ModalFooter onClose={onClose} /></form></div>;
}

function TaskModal({ form, setForm, editing, onClose, onSave }) {
  return <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"><form onSubmit={onSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"><ModalHeader title={editing ? 'Редагувати задачу' : 'Нова задача'} subtitle="Що потрібно зробити працівнику або адміністратору." onClose={onClose} /><div className="p-4 sm:p-5 space-y-3 max-h-[70vh] overflow-y-auto"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Назва задачі" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/><textarea value={form.description || ''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Опис / коментар" rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500"/><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[['client','ПІБ клієнта'],['phone','Телефон'],['plate','Держ номер']].map(f=><input key={f[0]} value={form[f[0]] || ''} onChange={e=>setForm({...form,[f[0]]:e.target.value})} placeholder={f[1]} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/>)}<input type="date" value={form.due_date || ''} onChange={e=>setForm({...form,due_date:e.target.value})} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"/></div><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500"><option value="new">Нова</option><option value="in_progress">В роботі</option><option value="done">Виконана</option></select></div><ModalFooter onClose={onClose} /></form></div>;
}

function ModalHeader({ title, subtitle, onClose }) {
  return <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50"><div className="min-w-0"><h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">{title}</h2><p className="text-xs sm:text-sm text-slate-500 font-semibold">{subtitle}</p></div><button type="button" onClick={onClose} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-500 shrink-0"><X size={18}/></button></div>;
}

function ModalFooter({ onClose }) {
  return <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2"><button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase">Скасувати</button><button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700">Зберегти</button></div>;
}
