import React, { useEffect, useMemo, useState } from 'react';
import { Search, CarFront, CalendarDays, History, Plus, Wrench, Package, ClipboardList, CheckCircle2, X, Phone, FileText, ListChecks, Clock3, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CopyButton from '../components/common/CopyButton';
import api from '../api/axios';

const normalize = (value) => String(value || '').toLowerCase().trim();

const getStatusColor = (status) => {
  const s = String(status).toUpperCase();
  if (s === 'DONE' || s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const recBadge = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  soon: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
};

const formatVisitDate = (visit) => {
  const rawDate = visit.updated_at || visit.created_at || visit.scheduled_datetime;
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDueDate = (value) => {
  if (!value) return 'Без дати';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
};

const getPartArticle = (part) => part?.article || part?.sku || part?.part_number || part?.code || '';
const getPartName = (part) => part?.name || part?.title || 'Запчастина';
const getPartBrand = (part) => part?.brand || part?.manufacturer || '';
const getPartSupplier = (part) => part?.supplier || part?.supplier_name || '';
const getPartSellPrice = (part) => part?.sell_price ?? part?.price ?? part?.sale_price ?? part?.client_price ?? null;
const getServiceName = (service) => service?.name || service?.service_name || 'Послуга';
const getServicePrice = (service) => service?.price ?? service?.sell_price ?? null;

const extractCarData = (visit) => {
  let parsed = {};
  if (visit?.delivery_data && typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try { parsed = JSON.parse(visit.delivery_data); } catch { parsed = {}; }
  }
  return { ...visit, brand: visit.brand || parsed.brand || '', model: visit.model || parsed.model || '', year: visit.year || parsed.year || '', engine: visit.engine || parsed.engine || '' };
};

const emptyRecommendationForm = { title: '', description: '', due_date: '', due_mileage: '' };
const clientTabs = [
  { key: 'overview', label: 'Огляд', icon: UserRound },
  { key: 'visits', label: 'Візити', icon: History },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList },
  { key: 'tasks', label: 'Задачі', icon: ListChecks },
];

const Clients = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [repeatVisitTarget, setRepeatVisitTarget] = useState(null);
  const [repeatForm, setRepeatForm] = useState({ date: '', time: '09:00', comment: '' });
  const [recommendationFormOpen, setRecommendationFormOpen] = useState(false);
  const [recommendationForm, setRecommendationForm] = useState(emptyRecommendationForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitsResponse, recResponse, taskResponse] = await Promise.all([
        api.get('/api/visits/?history=true'),
        api.get('/api/recommendations/').catch(() => ({ data: [] })),
        api.get('/api/crm-tasks/').catch(() => ({ data: [] })),
      ]);
      const rawVisits = Array.isArray(visitsResponse.data) ? visitsResponse.data : [];
      setVisits(rawVisits.map(extractCarData));
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
    } catch (error) {
      alert('Не вдалося завантажити історію клієнтів.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredVisits = useMemo(() => {
    const query = normalize(search);
    if (!query) return visits;
    return visits.filter((visit) => {
      const carText = `${visit.brand || ''} ${visit.model || ''}`;
      const partText = (visit.parts || []).map((part) => `${getPartBrand(part)} ${getPartArticle(part)} ${getPartName(part)} ${getPartSupplier(part)}`).join(' ');
      return [visit.plate, visit.phone, carText, visit.client, visit.vin_code, partText].some((field) => normalize(field).includes(query));
    });
  }, [visits, search]);

  const groupedClients = useMemo(() => {
    const groups = new Map();
    filteredVisits.forEach((visit) => {
      const key = `${normalize(visit.phone)}|${normalize(visit.plate)}|${normalize(visit.client)}`;
      const existing = groups.get(key);
      if (existing) { existing.visits.push(visit); return; }
      groups.set(key, {
        id: key,
        client: visit.client || 'Невідомий клієнт',
        phone: visit.phone || '—',
        plate: visit.plate || '—',
        vin: visit.vin_code || '—',
        car: `${visit.brand || ''} ${visit.model || ''}`.trim() || '—',
        visits: [visit],
      });
    });
    return Array.from(groups.values())
      .map((item) => ({ ...item, visits: item.visits.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)) }))
      .sort((a, b) => b.visits.length - a.visits.length);
  }, [filteredVisits]);

  const selectedRecommendations = useMemo(() => {
    if (!selectedGroup) return [];
    const groupPlate = normalize(selectedGroup.plate);
    const groupPhone = normalize(selectedGroup.phone);
    const groupClient = normalize(selectedGroup.client);
    return recommendations
      .filter((rec) => normalize(rec.plate) === groupPlate || normalize(rec.phone) === groupPhone || (groupClient && normalize(rec.client) === groupClient))
      .sort((a, b) => {
        const order = { overdue: 0, soon: 1, active: 2, done: 3, cancelled: 4 };
        return (order[a.state] ?? 9) - (order[b.state] ?? 9);
      });
  }, [recommendations, selectedGroup]);

  const selectedTasks = useMemo(() => {
    if (!selectedGroup) return [];
    const groupPlate = normalize(selectedGroup.plate);
    const groupPhone = normalize(selectedGroup.phone);
    const groupClient = normalize(selectedGroup.client);
    return tasks
      .filter((task) => normalize(task.plate) === groupPlate || normalize(task.phone) === groupPhone || (groupClient && normalize(task.client) === groupClient))
      .sort((a, b) => {
        const order = { overdue: 0, new: 1, in_progress: 2, done: 3 };
        return (order[a.state] ?? 9) - (order[b.state] ?? 9);
      });
  }, [tasks, selectedGroup]);

  const selectedSummary = useMemo(() => {
    if (!selectedGroup) return null;
    const allParts = selectedGroup.visits.flatMap((visit) => visit.parts || []);
    const allServices = selectedGroup.visits.flatMap((visit) => visit.services || []);
    const total = selectedGroup.visits.reduce((sum, visit) => {
      const partsTotal = (visit.parts || []).reduce((s, part) => s + (Number(getPartSellPrice(part)) || 0), 0);
      const servicesTotal = (visit.services || []).reduce((s, service) => s + (Number(getServicePrice(service)) || 0), 0);
      return sum + partsTotal + servicesTotal;
    }, 0);
    return {
      visits: selectedGroup.visits.length,
      services: allServices.length,
      parts: allParts.length,
      activeRecs: selectedRecommendations.filter((item) => !['done', 'cancelled'].includes(item.status)).length,
      activeTasks: selectedTasks.filter((item) => item.status !== 'done').length,
      lastVisit: selectedGroup.visits[0],
      total,
    };
  }, [selectedGroup, selectedRecommendations, selectedTasks]);

  const buildRepeatVisitPayload = (visit, overrides = {}) => {
    let parsedDeliveryData = {};
    if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
      try { parsedDeliveryData = JSON.parse(visit.delivery_data); } catch { parsedDeliveryData = {}; }
    }
    return {
      plate: visit.plate || '',
      vin_code: visit.vin_code || '',
      client: visit.client || '',
      phone: visit.phone || '',
      brand: visit.brand || parsedDeliveryData.brand || '',
      model: visit.model || parsedDeliveryData.model || '',
      year: parsedDeliveryData.year || visit.year || '',
      engine: parsedDeliveryData.engine || visit.engine || '',
      fuel: parsedDeliveryData.fuel || '',
      date: overrides.date || '',
      time: overrides.time || '09:00',
      comment: overrides.comment || '',
    };
  };

  const openClient = (group) => {
    setSelectedGroup(group);
    setDetailTab('overview');
  };

  const openRepeatVisitModal = (visit) => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    setRepeatVisitTarget(visit); setRepeatForm({ date, time: '09:00', comment: '' });
  };

  const submitRepeatVisit = () => {
    if (!repeatVisitTarget || !repeatForm.date || !repeatForm.time) return;
    navigate('/visits', { state: { repeatVisitData: buildRepeatVisitPayload(repeatVisitTarget, repeatForm) } });
    setRepeatVisitTarget(null);
  };

  const openRecommendationModal = () => {
    setRecommendationForm(emptyRecommendationForm);
    setRecommendationFormOpen(true);
  };

  const submitRecommendation = async () => {
    if (!selectedGroup || !recommendationForm.title.trim()) return;
    try {
      await api.post('/api/recommendations/', {
        client: selectedGroup.client,
        phone: selectedGroup.phone,
        plate: selectedGroup.plate,
        car: selectedGroup.car,
        title: recommendationForm.title.trim(),
        description: recommendationForm.description || '',
        due_date: recommendationForm.due_date || null,
        due_mileage: recommendationForm.due_mileage ? Number(recommendationForm.due_mileage) : null,
        status: 'active',
      });
      setRecommendationFormOpen(false);
      setRecommendationForm(emptyRecommendationForm);
      const recResponse = await api.get('/api/recommendations/');
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
      setDetailTab('recommendations');
    } catch (error) {
      alert('Не вдалося створити рекомендацію.');
    }
  };

  const markRecommendationDone = async (rec) => {
    try {
      await api.post(`/api/recommendations/${rec.id}/mark-done/`);
      const recResponse = await api.get('/api/recommendations/');
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
    } catch (error) {
      alert('Не вдалося змінити статус рекомендації.');
    }
  };

  const markTaskDone = async (task) => {
    try {
      await api.post(`/api/crm-tasks/${task.id}/mark-done/`);
      const taskResponse = await api.get('/api/crm-tasks/');
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
    } catch (error) {
      alert('Не вдалося змінити статус задачі.');
    }
  };

  const getAllArticles = (visit) => (visit.parts || []).map(getPartArticle).filter(Boolean).join('\n');

  return (
    <div className={embedded ? 'w-full max-w-full overflow-x-hidden' : 'w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen bg-slate-50 overflow-x-hidden'}>
      {!embedded && <div className="mb-8"><h1 className="text-3xl font-black text-slate-900 tracking-tight">Історія клієнтів</h1><p className="text-slate-500 font-medium">Керування візитами та історією обслуговування</p></div>}

      <div className="relative mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-2 max-w-full">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по номеру, телефону, імені, авто чи артикулу..." className="w-full min-w-0 pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm md:text-base" />
      </div>

      {loading ? <div className="text-center py-20 text-slate-400 font-bold">Завантаження даних...</div> : <div className="grid gap-4 max-w-full">
        {groupedClients.length === 0 ? <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500 font-semibold">За запитом нічого не знайдено.</div> : groupedClients.map((group) => <button type="button" key={group.id} onClick={() => openClient(group)} className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 group w-full max-w-full min-w-0"><div className="flex items-center gap-3 md:gap-4 min-w-0 w-full sm:w-auto"><div className="bg-slate-100 p-3 rounded-xl text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0"><CarFront size={24} /></div><div className="min-w-0 flex-1"><h3 className="font-black text-lg text-slate-800 break-words">{group.plate}</h3><p className="text-sm text-slate-500 font-semibold break-words">{group.client} • {group.car}</p><p className="text-xs text-slate-400 font-bold mt-1 break-words">{group.phone}</p></div></div><div className="flex items-center gap-3 shrink-0"><span className="text-xs font-black uppercase text-slate-400 tracking-wider">Візитів:</span><span className="bg-slate-800 text-white font-black px-3 py-1 rounded-lg text-sm">{group.visits.length}</span></div></button>)}
      </div>}

      {selectedGroup && <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] my-2 sm:my-0 min-w-0">
          <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight break-words">{selectedGroup.client}</h2>
                <p className="text-sm font-bold text-blue-600 mt-1 break-words">{selectedGroup.plate} • {selectedGroup.car}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold text-slate-500">
                  <span className="bg-white border border-slate-200 rounded-lg px-2 py-1 flex items-center gap-1"><Phone size={12}/> {selectedGroup.phone}</span>
                  <span className="bg-white border border-slate-200 rounded-lg px-2 py-1">VIN: {selectedGroup.vin}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedGroup(null)} className="bg-white border border-slate-200 text-slate-500 hover:text-slate-800 font-black text-xs uppercase px-3 py-2 rounded-xl shrink-0">Закрити</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
              <MiniStat label="Візити" value={selectedSummary?.visits || 0} />
              <MiniStat label="Роботи" value={selectedSummary?.services || 0} />
              <MiniStat label="Запчастини" value={selectedSummary?.parts || 0} />
              <MiniStat label="Рекомендації" value={selectedSummary?.activeRecs || 0} danger={(selectedSummary?.activeRecs || 0) > 0} />
              <MiniStat label="Сума" value={formatMoney(selectedSummary?.total || 0)} wide />
            </div>
          </div>

          <div className="px-3 md:px-6 pt-4 bg-white border-b border-slate-100 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-3">
              {clientTabs.map((tab) => { const Icon = tab.icon; const active = detailTab === tab.key; return <button key={tab.key} type="button" onClick={() => setDetailTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase whitespace-nowrap transition-all ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}><Icon size={15}/>{tab.label}</button>; })}
            </div>
          </div>

          <div className="p-3 md:p-6 overflow-y-auto space-y-4 min-w-0">
            {detailTab === 'overview' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InfoBlock title="Останній візит" icon={<Clock3 size={17} className="text-blue-600"/>}>
                {selectedSummary?.lastVisit ? <VisitMini visit={selectedSummary.lastVisit} onRepeat={openRepeatVisitModal} /> : <EmptySmall text="Візитів немає" />}
              </InfoBlock>
              <InfoBlock title="Що треба не забути" icon={<ClipboardList size={17} className="text-amber-600"/>} action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Plus size={13}/> Додати</button>}>
                {selectedRecommendations.filter((rec) => rec.status !== 'done').slice(0, 3).length === 0 ? <EmptySmall text="Активних рекомендацій немає" /> : selectedRecommendations.filter((rec) => rec.status !== 'done').slice(0, 3).map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}
              </InfoBlock>
              <InfoBlock title="Активні задачі" icon={<ListChecks size={17} className="text-indigo-600"/>}>
                {selectedTasks.filter((task) => task.status !== 'done').slice(0, 3).length === 0 ? <EmptySmall text="Активних задач немає" /> : selectedTasks.filter((task) => task.status !== 'done').slice(0, 3).map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}
              </InfoBlock>
              <InfoBlock title="Дані клієнта" icon={<FileText size={17} className="text-slate-600"/>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <SmallValue label="Клієнт" value={selectedGroup.client} />
                  <SmallValue label="Телефон" value={selectedGroup.phone} />
                  <SmallValue label="Номер" value={selectedGroup.plate} />
                  <SmallValue label="Авто" value={selectedGroup.car} />
                </div>
              </InfoBlock>
            </div>}

            {detailTab === 'recommendations' && <InfoBlock title="Рекомендації по клієнту" icon={<ClipboardList size={17} className="text-indigo-600"/>} action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-blue-700"><Plus size={13} /> Додати</button>}>
              {selectedRecommendations.length === 0 ? <EmptySmall text="По цьому клієнту рекомендацій поки немає." /> : <div className="space-y-2">{selectedRecommendations.map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}</div>}
            </InfoBlock>}

            {detailTab === 'tasks' && <InfoBlock title="Задачі по клієнту" icon={<ListChecks size={17} className="text-blue-600"/>}>
              {selectedTasks.length === 0 ? <EmptySmall text="По цьому клієнту задач поки немає." /> : <div className="space-y-2">{selectedTasks.map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}</div>}
            </InfoBlock>}

            {detailTab === 'visits' && <div className="space-y-4">
              {selectedGroup.visits.map((visit) => <VisitCard key={visit.id} visit={visit} onRepeat={openRepeatVisitModal} getAllArticles={getAllArticles} />)}
            </div>}
          </div>
        </div>
      </div>}

      {recommendationFormOpen && <div className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"><div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"><div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ClipboardList size={18} /> Нова рекомендація</h3><button type="button" onClick={() => setRecommendationFormOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div><div className="p-5 space-y-3 overflow-y-auto"><input value={recommendationForm.title} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Що потрібно зробити?" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /><textarea value={recommendationForm.description} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Коментар" rows={3} className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="date" value={recommendationForm.due_date} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_date: e.target.value }))} className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /><input type="number" value={recommendationForm.due_mileage} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_mileage: e.target.value }))} placeholder="Пробіг" className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /></div></div><div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2"><button type="button" onClick={() => setRecommendationFormOpen(false)} className="px-4 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600">Скасувати</button><button type="button" onClick={submitRecommendation} className="px-4 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700">Зберегти</button></div></div></div>}

      {repeatVisitTarget && <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5"><h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} /> Повторити візит</h3><div className="space-y-3"><input type="date" className="w-full border rounded-lg px-3 py-2" value={repeatForm.date} onChange={(e) => setRepeatForm((prev) => ({ ...prev, date: e.target.value }))} /><input type="time" className="w-full border rounded-lg px-3 py-2" value={repeatForm.time} onChange={(e) => setRepeatForm((prev) => ({ ...prev, time: e.target.value }))} /><textarea placeholder="Коментар" className="w-full border rounded-lg px-3 py-2" rows={3} value={repeatForm.comment} onChange={(e) => setRepeatForm((prev) => ({ ...prev, comment: e.target.value }))} /></div><div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setRepeatVisitTarget(null)} className="px-3 py-2 rounded-lg border">Скасувати</button><button type="button" onClick={submitRepeatVisit} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Створити</button></div></div></div>}
    </div>
  );
};

function MiniStat({ label, value, danger, wide }) {
  return <div className={`rounded-2xl border p-3 min-w-0 ${danger ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'} ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[9px] font-black uppercase text-slate-400 truncate">{label}</p><p className="text-lg font-black text-slate-900 truncate">{value}</p></div>;
}

function InfoBlock({ title, icon, action, children }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm min-w-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2 min-w-0">{icon}<span className="break-words">{title}</span></h3>{action}</div>{children}</div>;
}

function EmptySmall({ text }) {
  return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm font-semibold text-slate-400 text-center">{text}</div>;
}

function SmallValue({ label, value }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-sm break-words">{value || '—'}</p></div>;
}

function RecommendationRow({ rec, onDone }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 min-w-0"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1"><p className="text-sm font-black text-slate-800 leading-snug break-words">{rec.title}</p><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 self-start ${recBadge[rec.state] || recBadge.active}`}>{rec.state_label}</span></div>{rec.description && <p className="text-xs font-semibold text-slate-500 mb-2 break-words">{rec.description}</p>}<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold text-slate-500"><span>Дата: {formatDueDate(rec.due_date)} {rec.due_mileage ? `• ${rec.due_mileage} км` : ''}</span>{rec.status !== 'done' && <button type="button" onClick={() => onDone(rec)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={12} /> Виконано</button>}</div></div>;
}

function TaskRow({ task, onDone }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 min-w-0"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1"><p className="text-sm font-black text-slate-800 leading-snug break-words">{task.title}</p><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 self-start ${recBadge[task.state] || recBadge.new}`}>{task.state_label || task.status}</span></div>{task.description && <p className="text-xs font-semibold text-slate-500 mb-2 break-words">{task.description}</p>}<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold text-slate-500"><span>Дата: {formatDueDate(task.due_date)}</span>{task.status !== 'done' && <button type="button" onClick={() => onDone(task)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={12} /> Виконано</button>}</div></div>;
}

function VisitMini({ visit, onRepeat }) {
  return <div className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><SmallValue label="Дата" value={formatVisitDate(visit)} /><SmallValue label="Статус" value={visit.status || 'В обробці'} /></div><button type="button" onClick={() => onRepeat(visit)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition-colors"><History size={16} /> Повторити візит</button></div>;
}

function VisitCard({ visit, onRepeat, getAllArticles }) {
  const services = visit.services || [];
  const parts = visit.parts || [];
  const articleCount = parts.map(getPartArticle).filter(Boolean).length;
  return <div className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100 min-w-0"><div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3"><p className="font-black text-slate-700 flex items-center gap-2 break-words"><CalendarDays size={16} /> {formatVisitDate(visit)}</p><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shrink-0 self-start ${getStatusColor(visit.status)}`}>{visit.status || 'В обробці'}</span></div><div className="space-y-4 mb-4"><div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Wrench size={16} className="text-blue-600" /> Послуги</h3><span className="text-[10px] font-black uppercase text-slate-400">{services.length}</span></div>{services.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Послуги не додані</p> : <div className="space-y-2">{services.map((service, index) => <div key={service.id || index} className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"><p className="text-sm font-bold text-slate-700 leading-snug break-words">{getServiceName(service)}</p><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getServicePrice(service))}</p></div>)}</div>}</div><div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Package size={16} className="text-emerald-600" /> Запчастини</h3>{articleCount > 1 && <CopyButton value={getAllArticles(visit)} label="Всі артикули" copiedLabel="Скопійовано" compact />}</div>{parts.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Запчастини не додані</p> : <div className="space-y-3">{parts.map((part, index) => { const article = getPartArticle(part); const brand = getPartBrand(part); const supplier = getPartSupplier(part); return <div key={part.id || `${article}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-w-0"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2"><div className="min-w-0">{brand && <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 mb-1 break-words">{brand}</p>}<p className="text-sm font-black text-slate-800 leading-snug break-words">{getPartName(part)}</p></div><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getPartSellPrice(part))}</p></div><div className="flex flex-wrap items-center gap-2 mt-3">{article ? <CopyButton value={article} label={article} copiedLabel="Скопійовано" title="Скопіювати артикул" compact /> : <span className="rounded-lg bg-slate-100 text-slate-400 px-2 py-1 text-xs font-bold">Артикул: —</span>}{supplier && <span className="rounded-lg bg-white border border-slate-200 text-slate-500 px-2 py-1 text-xs font-bold break-words">{supplier}</span>}</div></div>; })}</div>}</div></div><button type="button" onClick={() => onRepeat(visit)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition-colors"><History size={16} /> Повторити візит</button></div>;
}

export default Clients;
