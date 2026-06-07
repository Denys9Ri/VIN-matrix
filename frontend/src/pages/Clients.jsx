import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  Hash,
  History,
  ListChecks,
  MessageSquareText,
  Phone,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ClientCommunicationPanel from '../components/crm/ClientCommunicationPanel';
import api from '../api/axios';

const normalize = (value) => String(value || '').toLowerCase().trim();
const digits = (value) => String(value || '').replace(/\D/g, '');
const safeText = (value) => String(value || '').trim();
const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeNumber = (value) => { const number = Number(value); return Number.isFinite(number) ? number : 0; };
const isNotDone = (item) => !['done', 'cancelled', 'canceled'].includes(String(item?.status || item?.state || '').toLowerCase());

const statusLabels = {
  new: 'Новий',
  active: 'Активний',
  regular: 'Постійний',
  sleeping: 'Сплячий',
  problem: 'Проблемний',
  vip: 'VIP',
};

const statusBadge = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  regular: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  sleeping: 'bg-slate-100 text-slate-600 border-slate-200',
  problem: 'bg-rose-50 text-rose-700 border-rose-100',
  vip: 'bg-amber-50 text-amber-700 border-amber-100',
};

const statusStripe = {
  new: 'bg-blue-500',
  active: 'bg-emerald-500',
  regular: 'bg-indigo-500',
  sleeping: 'bg-slate-400',
  problem: 'bg-rose-500',
  vip: 'bg-amber-400',
};

const recBadge = {
  active: 'bg-blue-50 text-blue-700 border-blue-100',
  soon: 'bg-amber-50 text-amber-700 border-amber-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  canceled: 'bg-slate-100 text-slate-500 border-slate-200',
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
};

const clientTabs = [
  { key: 'overview', label: 'Огляд', icon: UserRound },
  { key: 'communication', label: 'Комунікація', icon: MessageSquareText },
  { key: 'visits', label: 'Візити', icon: History },
  { key: 'auto', label: 'Авто', icon: CarFront },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList },
  { key: 'tasks', label: 'Задачі', icon: ListChecks },
];

const getVisitId = (visit) => visit?.id ?? visit?.visit_id ?? visit?.pk ?? null;
const formatVisitId = (visit) => {
  const id = getVisitId(visit);
  return id ? `№${id}` : '№—';
};
const getVisitSearchText = (visit) => [getVisitId(visit), formatVisitId(visit), `візит ${getVisitId(visit) || ''}`, `visit ${getVisitId(visit) || ''}`].filter(Boolean).join(' ');

const formatVisitDate = (visit) => {
  const rawDate = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at || visit?.date;
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatShortDate = (visit) => {
  const rawDate = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at || visit?.date;
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const visitDateParam = (visit) => {
  const rawDate = visit?.scheduled_datetime || visit?.created_at || visit?.date;
  if (!rawDate) return '';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatDueDate = (value) => {
  if (!value) return 'Без дати';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴` : '—';
};

const formatMileage = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number.toLocaleString('uk-UA')} км` : '—';
};

const getPartArticle = (part) => part?.article || part?.sku || part?.part_number || part?.code || '';
const getPartName = (part) => part?.name || part?.title || 'Запчастина';
const getPartBrand = (part) => part?.brand || part?.manufacturer || '';
const getPartSupplier = (part) => part?.supplier || part?.supplier_name || '';
const getPartSellPrice = (part) => part?.sell_price ?? part?.price ?? part?.sale_price ?? part?.client_price ?? null;
const getServiceName = (service) => service?.name || service?.service_name || 'Послуга';
const getServicePrice = (service) => service?.price ?? service?.sell_price ?? null;
const getVisitMileage = (visit) => visit?.mileage ?? visit?.odometer ?? visit?.run ?? visit?.car_mileage ?? null;
const getVisitTotal = (visit) => safeArray(visit?.parts).reduce((sum, part) => sum + safeNumber(getPartSellPrice(part)), 0) + safeArray(visit?.services).reduce((sum, service) => sum + safeNumber(getServicePrice(service)), 0);

const extractCarData = (visit) => {
  let parsed = {};
  if (visit?.delivery_data && typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try { parsed = JSON.parse(visit.delivery_data); } catch { parsed = {}; }
  }
  return {
    ...visit,
    brand: visit.brand || parsed.brand || '',
    model: visit.model || parsed.model || '',
    year: visit.year || parsed.year || '',
    engine: visit.engine || parsed.engine || '',
    fuel: visit.fuel || parsed.fuel || '',
    mileage: visit.mileage ?? parsed.mileage ?? parsed.probig ?? visit.odometer ?? null,
  };
};

const emptyRecommendationForm = { title: '', description: '', due_date: '', due_mileage: '' };

const clientMatches = (item, group) => {
  if (!item || !group) return false;
  const itemPlate = normalize(item.plate), itemPhone = normalize(item.phone), itemClient = normalize(item.client);
  return (itemPlate && itemPlate === normalize(group.plate)) || (itemPhone && itemPhone === normalize(group.phone)) || (itemClient && itemClient === normalize(group.client));
};

const isOlderThanDays = (visit, days) => {
  const raw = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at || visit?.date;
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  return date < limit;
};

const Clients = ({ embedded = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visits, setVisits] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [clientStatuses, setClientStatuses] = useState([]);
  const [serviceReminders, setServiceReminders] = useState([]);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [repeatVisitTarget, setRepeatVisitTarget] = useState(null);
  const [repeatForm, setRepeatForm] = useState({ date: '', time: '09:00', mileage: '', comment: '' });
  const [recommendationFormOpen, setRecommendationFormOpen] = useState(false);
  const [recommendationForm, setRecommendationForm] = useState(emptyRecommendationForm);
  const [creatingRepeatVisit, setCreatingRepeatVisit] = useState(false);
  const [autoOpenKey, setAutoOpenKey] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitsResponse, recResponse, taskResponse, statusResponse, serviceResponse] = await Promise.all([
        api.get('/api/visits/?history=true'),
        api.get('/api/recommendations/').catch(() => ({ data: [] })),
        api.get('/api/crm-tasks/').catch(() => ({ data: [] })),
        api.get('/api/crm-client-statuses/').catch(() => ({ data: [] })),
        api.get('/api/crm-service-reminders/?status=active').catch(() => ({ data: [] })),
      ]);
      setVisits((Array.isArray(visitsResponse.data) ? visitsResponse.data : []).map(extractCarData));
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
      setClientStatuses(Array.isArray(statusResponse.data) ? statusResponse.data : []);
      setServiceReminders(Array.isArray(serviceResponse.data) ? serviceResponse.data : []);
    } catch { alert('Не вдалося завантажити історію клієнтів.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    if (urlSearch) setSearch(urlSearch);
  }, [location.search]);

  const filteredVisits = useMemo(() => {
    const query = normalize(search);
    if (!query) return visits;
    const queryDigits = digits(search);
    return visits.filter((visit) => {
      const carText = `${visit.brand || ''} ${visit.model || ''} ${visit.year || ''} ${visit.engine || ''}`;
      const partText = safeArray(visit.parts).map((part) => `${getPartBrand(part)} ${getPartArticle(part)} ${getPartName(part)} ${getPartSupplier(part)}`).join(' ');
      const textMatch = [getVisitSearchText(visit), visit.plate, visit.phone, carText, visit.client, visit.vin_code, partText].some((field) => normalize(field).includes(query));
      const phoneMatch = queryDigits.length >= 4 && digits(visit.phone).includes(queryDigits);
      return textMatch || phoneMatch;
    });
  }, [visits, search]);

  const groupedClients = useMemo(() => {
    const groups = new Map();
    filteredVisits.forEach((visit) => {
      const key = `${normalize(visit.phone)}|${normalize(visit.plate)}|${normalize(visit.client)}`;
      if (groups.has(key)) { groups.get(key).visits.push(visit); return; }
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
    return Array.from(groups.values()).map((group) => {
      const sortedVisits = group.visits.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      const statusRecord = clientStatuses.find((status) => clientMatches(status, group));
      const activeRecs = recommendations.filter((rec) => clientMatches(rec, group) && isNotDone(rec));
      const activeTasks = tasks.filter((task) => clientMatches(task, group) && isNotDone(task));
      const activeServiceReminders = serviceReminders.filter((reminder) => clientMatches(reminder, group) && isNotDone(reminder));
      const total = sortedVisits.reduce((sum, visit) => sum + getVisitTotal(visit), 0);
      return { ...group, visits: sortedVisits, status: statusRecord?.status || 'new', statusLabel: statusRecord?.status_label || statusLabels[statusRecord?.status] || 'Новий', activeRecs: activeRecs.length, activeTasks: activeTasks.length, activeServiceReminders: activeServiceReminders.length, total, lastVisit: sortedVisits[0] };
    }).sort((a, b) => b.visits.length - a.visits.length);
  }, [filteredVisits, clientStatuses, recommendations, tasks, serviceReminders]);

  const allGroupedClients = useMemo(() => {
    const queryBackup = search;
    const groups = new Map();
    visits.forEach((visit) => {
      const key = `${normalize(visit.phone)}|${normalize(visit.plate)}|${normalize(visit.client)}`;
      if (groups.has(key)) { groups.get(key).visits.push(visit); return; }
      groups.set(key, { id: key, client: visit.client || 'Невідомий клієнт', phone: visit.phone || '—', plate: visit.plate || '—', vin: visit.vin_code || '—', car: `${visit.brand || ''} ${visit.model || ''}`.trim() || '—', visits: [visit] });
    });
    return Array.from(groups.values()).map((group) => ({ ...group, visits: group.visits.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)), status: 'new', statusLabel: statusLabels.new, activeRecs: 0, activeTasks: 0, activeServiceReminders: 0, total: group.visits.reduce((sum, visit) => sum + getVisitTotal(visit), 0), lastVisit: group.visits[0] }));
  }, [visits, search]);

  const filterStats = useMemo(() => ({
    all: groupedClients.length,
    'status-new': groupedClients.filter((group) => group.status === 'new').length,
    'status-active': groupedClients.filter((group) => group.status === 'active').length,
    'status-regular': groupedClients.filter((group) => group.status === 'regular').length,
    'status-sleeping': groupedClients.filter((group) => group.status === 'sleeping').length,
    'status-problem': groupedClients.filter((group) => group.status === 'problem').length,
    'status-vip': groupedClients.filter((group) => group.status === 'vip').length,
    recommendations: groupedClients.filter((group) => group.activeRecs > 0).length,
    tasks: groupedClients.filter((group) => group.activeTasks > 0).length,
    service: groupedClients.filter((group) => group.activeServiceReminders > 0).length,
    inactive90: groupedClients.filter((group) => isOlderThanDays(group.lastVisit, 90)).length,
    topRevenue: groupedClients.length,
  }), [groupedClients]);

  const visibleClients = useMemo(() => {
    let result = [...groupedClients];
    if (clientFilter.startsWith('status-')) result = result.filter((group) => group.status === clientFilter.replace('status-', ''));
    else if (clientFilter === 'recommendations') result = result.filter((group) => group.activeRecs > 0);
    else if (clientFilter === 'tasks') result = result.filter((group) => group.activeTasks > 0);
    else if (clientFilter === 'service') result = result.filter((group) => group.activeServiceReminders > 0);
    else if (clientFilter === 'inactive90') result = result.filter((group) => isOlderThanDays(group.lastVisit, 90));
    if (clientFilter === 'topRevenue') result.sort((a, b) => b.total - a.total);
    return result;
  }, [groupedClients, clientFilter]);

  const selectedRecommendations = useMemo(() => selectedGroup ? recommendations.filter((rec) => clientMatches(rec, selectedGroup)).sort((a, b) => ({ overdue: 0, soon: 1, active: 2, new: 2, done: 3, cancelled: 4, canceled: 4 }[a.state] ?? 9) - ({ overdue: 0, soon: 1, active: 2, new: 2, done: 3, cancelled: 4, canceled: 4 }[b.state] ?? 9)) : [], [recommendations, selectedGroup]);
  const selectedTasks = useMemo(() => selectedGroup ? tasks.filter((task) => clientMatches(task, selectedGroup)).sort((a, b) => ({ overdue: 0, new: 1, in_progress: 2, done: 3 }[a.state] ?? 9) - ({ overdue: 0, new: 1, in_progress: 2, done: 3 }[b.state] ?? 9)) : [], [tasks, selectedGroup]);
  const selectedSummary = useMemo(() => {
    if (!selectedGroup) return null;
    const allParts = selectedGroup.visits.flatMap((visit) => safeArray(visit.parts));
    const allServices = selectedGroup.visits.flatMap((visit) => safeArray(visit.services));
    const activeRecommendations = selectedRecommendations.filter(isNotDone);
    const activeTasks = selectedTasks.filter(isNotDone);
    const lastVisit = selectedGroup.visits[0];
    return { visits: selectedGroup.visits.length, services: allServices.length, parts: allParts.length, activeRecs: activeRecommendations.length, activeTasks: activeTasks.length, lastVisit, lastMileage: selectedGroup.visits.map(getVisitMileage).find((value) => Number(value) > 0) || null, lastVisitTotal: lastVisit ? getVisitTotal(lastVisit) : 0, total: selectedGroup.visits.reduce((sum, visit) => sum + getVisitTotal(visit), 0), activeRecommendations, activeTasks };
  }, [selectedGroup, selectedRecommendations, selectedTasks]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(location.search);
    const shouldOpen = params.get('autopen') === '1' || params.get('open') === 'client' || params.get('visit') || params.get('order_id');
    if (!shouldOpen) return;
    const key = location.search;
    if (autoOpenKey === key) return;
    const targetId = params.get('order_id') || params.get('visit') || params.get('visit_id');
    const targetSearch = params.get('search') || '';
    const targetTab = params.get('tab') || 'overview';
    const pool = groupedClients.length ? groupedClients : allGroupedClients;
    let match = null;
    if (targetId) match = pool.find((group) => group.visits.some((visit) => String(getVisitId(visit)) === String(targetId)));
    if (!match && targetSearch) {
      const q = normalize(targetSearch);
      const qDigits = digits(targetSearch);
      match = pool.find((group) => normalize(group.client).includes(q) || normalize(group.plate).includes(q) || normalize(group.vin).includes(q) || (qDigits.length >= 4 && digits(group.phone).includes(qDigits)));
    }
    if (match) {
      setSelectedGroup(match);
      setDetailTab(['overview', 'communication', 'visits', 'auto', 'recommendations', 'tasks'].includes(targetTab) ? targetTab : 'overview');
      setAutoOpenKey(key);
    }
  }, [loading, location.search, groupedClients, allGroupedClients, autoOpenKey]);

  const buildCleanRepeatPayload = (visit, overrides = {}) => {
    const cleanDate = safeText(overrides.date), cleanTime = safeText(overrides.time || '09:00');
    return { plate: safeText(visit.plate).toUpperCase(), vin_code: safeText(visit.vin_code), client: safeText(visit.client), phone: safeText(visit.phone), scheduled_datetime: cleanDate && cleanTime ? new Date(`${cleanDate}T${cleanTime}`).toISOString() : null, delivery_type: 'pickup', delivery_data: JSON.stringify({ brand: safeText(visit.brand), model: safeText(visit.model), year: safeText(visit.year), engine: safeText(visit.engine), fuel: safeText(visit.fuel), mileage: safeText(overrides.mileage || getVisitMileage(visit) || '') }), payment_status: 'unpaid', prepayment_amount: 0, comment: safeText(overrides.comment) ? `[Повторний візит на основі ${formatVisitId(visit)}] ${safeText(overrides.comment)}` : `[Повторний візит на основі ${formatVisitId(visit)}]` };
  };

  const openClient = (group) => { setSelectedGroup(group); setDetailTab('overview'); };
  const openRepeatVisitModal = (visit) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    setRepeatVisitTarget(visit);
    setRepeatForm({ date, time: '09:00', mileage: getVisitMileage(visit) || '', comment: '' });
  };
  const submitRepeatVisit = async () => {
    if (!repeatVisitTarget || !repeatForm.date || !repeatForm.time || creatingRepeatVisit) return;
    const payload = buildCleanRepeatPayload(repeatVisitTarget, repeatForm);
    if (!payload.plate || !payload.client || !payload.phone) return alert('Не вистачає даних клієнта для повторного візиту.');
    setCreatingRepeatVisit(true);
    try {
      await api.post('/api/visits/', payload);
      setRepeatVisitTarget(null);
      setSelectedGroup(null);
      await loadData();
      navigate('/visits', { state: { createdRepeatVisit: true } });
    } catch { alert('Не вдалося створити повторний візит.'); }
    finally { setCreatingRepeatVisit(false); }
  };
  const openRecommendationModal = () => { setRecommendationForm(emptyRecommendationForm); setRecommendationFormOpen(true); };
  const submitRecommendation = async () => {
    if (!selectedGroup || !recommendationForm.title.trim()) return;
    try {
      await api.post('/api/recommendations/', { client: selectedGroup.client, phone: selectedGroup.phone, plate: selectedGroup.plate, car: selectedGroup.car, title: recommendationForm.title.trim(), description: recommendationForm.description || '', due_date: recommendationForm.due_date || null, due_mileage: recommendationForm.due_mileage ? Number(recommendationForm.due_mileage) : null, status: 'active' });
      setRecommendationFormOpen(false);
      setRecommendationForm(emptyRecommendationForm);
      const res = await api.get('/api/recommendations/');
      setRecommendations(Array.isArray(res.data) ? res.data : []);
      setDetailTab('recommendations');
    } catch { alert('Не вдалося створити рекомендацію.'); }
  };
  const markRecommendationDone = async (rec) => { try { await api.post(`/api/recommendations/${rec.id}/mark-done/`); const res = await api.get('/api/recommendations/'); setRecommendations(Array.isArray(res.data) ? res.data : []); } catch { alert('Не вдалося змінити статус рекомендації.'); } };
  const markTaskDone = async (task) => { try { await api.post(`/api/crm-tasks/${task.id}/mark-done/`); const res = await api.get('/api/crm-tasks/'); setTasks(Array.isArray(res.data) ? res.data : []); } catch { alert('Не вдалося змінити статус задачі.'); } };
  const reloadTasks = async () => { try { const res = await api.get('/api/crm-tasks/'); setTasks(Array.isArray(res.data) ? res.data : []); setDetailTab('tasks'); } catch {} };

  const modalOpen = Boolean((selectedGroup && window.innerWidth < 1024) || recommendationFormOpen || repeatVisitTarget);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [modalOpen]);

  return (
    <div className={embedded ? 'w-full max-w-full overflow-x-hidden' : 'w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen bg-slate-50 overflow-x-hidden'}>
      {!embedded && <div className="mb-8"><h1 className="text-3xl font-black text-slate-900 tracking-tight">Історія клієнтів</h1><p className="text-slate-500 font-medium">Керування візитами та історією обслуговування</p></div>}

      <div className="relative mb-4 bg-white rounded-[28px] border border-slate-200 shadow-sm p-2 max-w-full">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук по ID візиту, номеру, телефону, імені, авто чи артикулу..." className="w-full min-w-0 pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm md:text-base" />
      </div>

      <ClientFilters active={clientFilter} setActive={setClientFilter} stats={filterStats} />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-5 items-start">
        <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black uppercase text-slate-900">Список клієнтів</h2>
              <p className="text-xs font-bold text-slate-400 mt-1">СТО-клієнти в стилі магазину</p>
            </div>
            <span className="bg-slate-100 text-slate-600 rounded-full px-3 py-1 text-xs font-black">{visibleClients.length}</span>
          </div>
          <div className="max-h-[68vh] overflow-y-auto p-3 space-y-3">
            {loading ? <div className="text-center py-16 text-slate-400 font-bold">Завантаження даних...</div> : visibleClients.length === 0 ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 text-slate-500 font-semibold text-center">За цим фільтром нічого не знайдено.</div> : visibleClients.map((group) => <ClientCard key={group.id} group={group} active={selectedGroup?.id === group.id} onClick={() => openClient(group)} />)}
          </div>
        </div>

        <div className="hidden lg:block min-w-0">
          {selectedGroup ? <ClientDetailPanel selectedGroup={selectedGroup} selectedSummary={selectedSummary} selectedRecommendations={selectedRecommendations} selectedTasks={selectedTasks} detailTab={detailTab} setDetailTab={setDetailTab} onClose={() => setSelectedGroup(null)} openRecommendationModal={openRecommendationModal} openRepeatVisitModal={openRepeatVisitModal} markRecommendationDone={markRecommendationDone} markTaskDone={markTaskDone} reloadTasks={reloadTasks} navigate={navigate} /> : <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-12 text-center text-slate-400"><UserRound className="mx-auto mb-4" size={56}/><p className="font-black uppercase text-slate-700">Оберіть клієнта</p><p className="text-sm font-semibold mt-2">Тут буде історія візитів, авто, задачі та рекомендації.</p></div>}
        </div>
      </div>

      {selectedGroup && <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm p-0 overflow-hidden"><ClientDetailPanel mobile selectedGroup={selectedGroup} selectedSummary={selectedSummary} selectedRecommendations={selectedRecommendations} selectedTasks={selectedTasks} detailTab={detailTab} setDetailTab={setDetailTab} onClose={() => setSelectedGroup(null)} openRecommendationModal={openRecommendationModal} openRepeatVisitModal={openRepeatVisitModal} markRecommendationDone={markRecommendationDone} markTaskDone={markTaskDone} reloadTasks={reloadTasks} navigate={navigate} /></div>}
      {recommendationFormOpen && <RecommendationModal recommendationForm={recommendationForm} setRecommendationForm={setRecommendationForm} submitRecommendation={submitRecommendation} onClose={() => setRecommendationFormOpen(false)} />}
      {repeatVisitTarget && <RepeatVisitModal repeatVisitTarget={repeatVisitTarget} repeatForm={repeatForm} setRepeatForm={setRepeatForm} submitRepeatVisit={submitRepeatVisit} onClose={() => setRepeatVisitTarget(null)} isSaving={creatingRepeatVisit} />}
    </div>
  );
};

function ClientCard({ group, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`relative overflow-hidden w-full text-left rounded-3xl border shadow-sm transition-all p-4 pl-5 ${active ? 'bg-blue-50 border-blue-200 ring-4 ring-blue-50' : 'bg-slate-50/70 border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-md'}`}>
      <span className={`absolute left-0 top-0 h-full w-1.5 ${statusStripe[group.status] || statusStripe.new}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 text-lg leading-tight break-words">{group.plate}</h3>
          <p className="text-sm font-bold text-slate-600 mt-1 break-words">{group.client}</p>
          <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1"><Phone size={13}/> {group.phone}</p>
        </div>
        <span className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase shrink-0 ${statusBadge[group.status] || statusBadge.new}`}>{group.statusLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <SmallBox label="Віз." value={group.visits.length} />
        <SmallBox label="Сума" value={formatMoney(group.total)} />
        <SmallBox label="Задачі" value={group.activeTasks + group.activeRecs} danger={(group.activeTasks + group.activeRecs) > 0} />
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 text-xs font-bold text-slate-400">
        <span>Останнє: {formatShortDate(group.lastVisit)}</span>
        <span className="rounded-lg bg-white border border-slate-100 px-2 py-1 text-slate-500">{formatVisitId(group.lastVisit)}</span>
      </div>
    </button>
  );
}

function SmallBox({ label, value, danger }) {
  return <div className="bg-white rounded-2xl border border-slate-100 p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400 truncate">{label}</p><p className={`font-black text-sm mt-1 truncate ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>;
}

function ClientFilters({ active, setActive, stats }) {
  const filters = [['all', 'Всі', stats.all], ['status-new', 'Нові', stats['status-new']], ['status-active', 'Активні', stats['status-active']], ['status-regular', 'Постійні', stats['status-regular']], ['status-problem', 'Проблемні', stats['status-problem']], ['status-vip', 'VIP', stats['status-vip']], ['recommendations', 'З рекомендаціями', stats.recommendations], ['tasks', 'З задачами', stats.tasks], ['service', 'Обслуговування', stats.service], ['inactive90', 'Без візиту 3 міс.', stats.inactive90], ['topRevenue', 'Найбільш прибуткові', stats.topRevenue]];
  return <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-3 mb-5 overflow-x-auto max-w-full"><div className="flex gap-2 min-w-max pb-1">{filters.map(([key, label, count]) => <button key={key} type="button" onClick={() => setActive(key)} className={`px-3 py-2 rounded-2xl text-xs font-black uppercase whitespace-nowrap border transition-all ${active === key ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>{label}: {count || 0}</button>)}</div></div>;
}

function ClientDetailPanel({ mobile = false, selectedGroup, selectedSummary, selectedRecommendations, selectedTasks, detailTab, setDetailTab, onClose, openRecommendationModal, openRepeatVisitModal, markRecommendationDone, markTaskDone, reloadTasks, navigate }) {
  const activeRecs = safeArray(selectedSummary?.activeRecommendations);
  const activeTasks = safeArray(selectedSummary?.activeTasks);
  const lastVisit = selectedSummary?.lastVisit;
  return (
    <div className={`${mobile ? 'h-[100dvh] rounded-none' : 'rounded-[32px]'} bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[calc(100dvh-8rem)]`}>
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 shrink-0" />
      <div className="p-5 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Картка клієнта СТО</p>
              <span className={`rounded-2xl border px-3 py-1 text-[10px] font-black uppercase ${statusBadge[selectedGroup.status] || statusBadge.new}`}>{selectedGroup.statusLabel}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight break-words">{selectedGroup.plate}</h2>
            <p className="text-sm font-black text-slate-600 mt-1 break-words">{selectedGroup.client} · {selectedGroup.car}</p>
            <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-1"><Phone size={14}/> {selectedGroup.phone}</p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          <MiniStat label="Візити" value={selectedSummary?.visits || 0} />
          <MiniStat label="Роботи" value={selectedSummary?.services || 0} />
          <MiniStat label="Запчастини" value={selectedSummary?.parts || 0} />
          <MiniStat label="Задачі" value={safeNumber(selectedSummary?.activeRecs) + safeNumber(selectedSummary?.activeTasks)} danger={(safeNumber(selectedSummary?.activeRecs) + safeNumber(selectedSummary?.activeTasks)) > 0} />
          <MiniStat label="Сума" value={formatMoney(selectedSummary?.total || 0)} wide />
        </div>
      </div>

      <div className="px-4 pt-4 bg-slate-50/60 border-b border-slate-100 overflow-x-auto shrink-0">
        <div className="flex gap-2 min-w-max pb-3">
          {clientTabs.map((tab) => { const Icon = tab.icon; const active = detailTab === tab.key; return <button key={tab.key} type="button" onClick={() => setDetailTab(tab.key)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase whitespace-nowrap transition-all ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'}`}><Icon size={15}/>{tab.label}</button>; })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 bg-white">
        {detailTab === 'overview' && <div className="space-y-5"><OverviewHero selectedGroup={selectedGroup} selectedSummary={selectedSummary} onRepeat={openRepeatVisitModal} navigate={navigate} /><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><InfoBlock title="Останній візит" icon={<Clock3 size={18} className="text-blue-600" />}>{lastVisit ? <VisitMini visit={lastVisit} onRepeat={openRepeatVisitModal} navigate={navigate} /> : <EmptySmall text="Візитів немає" />}</InfoBlock><InfoBlock title="Що треба не забути" icon={<ClipboardList size={18} className="text-amber-600" />} action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Plus size={14}/> Додати</button>}>{activeRecs.length === 0 ? <EmptySmall text="Активних нагадувань немає" /> : <div className="space-y-2">{activeRecs.slice(0, 4).map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}</div>}</InfoBlock><InfoBlock title="Активні задачі" icon={<ListChecks size={18} className="text-indigo-600" />}>{activeTasks.length === 0 ? <EmptySmall text="Активних задач немає" /> : <div className="space-y-2">{activeTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}</div>}</InfoBlock><InfoBlock title="Контакт і авто" icon={<FileText size={18} className="text-slate-600" />}><AutoGrid selectedGroup={selectedGroup} selectedSummary={selectedSummary} /></InfoBlock></div></div>}
        {detailTab === 'communication' && <ClientCommunicationPanel selectedGroup={selectedGroup} lastVisit={lastVisit} onRepeat={openRepeatVisitModal} onAddRecommendation={openRecommendationModal} onTaskCreated={reloadTasks} />}
        {detailTab === 'visits' && <div className="space-y-4">{selectedGroup.visits.map((visit) => <VisitCard key={getVisitId(visit) || visit.created_at} visit={visit} onRepeat={openRepeatVisitModal} navigate={navigate} />)}</div>}
        {detailTab === 'auto' && <InfoBlock title="Автомобіль клієнта" icon={<CarFront size={18} className="text-blue-600" />}><AutoGrid selectedGroup={selectedGroup} selectedSummary={selectedSummary} /></InfoBlock>}
        {detailTab === 'recommendations' && <InfoBlock title="Рекомендації по клієнту" icon={<ClipboardList size={18} className="text-indigo-600" />} action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Plus size={14}/> Додати</button>}>{selectedRecommendations.length === 0 ? <EmptySmall text="По цьому клієнту рекомендацій поки немає." /> : <div className="space-y-2">{selectedRecommendations.map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}</div>}</InfoBlock>}
        {detailTab === 'tasks' && <InfoBlock title="Задачі по клієнту" icon={<ListChecks size={18} className="text-blue-600" />}>{selectedTasks.length === 0 ? <EmptySmall text="По цьому клієнту задач поки немає." /> : <div className="space-y-2">{selectedTasks.map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}</div>}</InfoBlock>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400 truncate">{label}</p><p className={`text-lg font-black mt-1 truncate ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>;
}

function OverviewHero({ selectedGroup, selectedSummary, onRepeat, navigate }) {
  const lastVisit = selectedSummary?.lastVisit;
  const warningCount = safeNumber(selectedSummary?.activeRecs) + safeNumber(selectedSummary?.activeTasks);
  const openVisit = () => {
    if (!lastVisit) return;
    const date = visitDateParam(lastVisit);
    navigate(`/visits?visit_id=${getVisitId(lastVisit)}${date ? `&date=${date}` : ''}`);
  };
  return <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 shadow-sm min-w-0"><div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5"><div className="min-w-0"><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"><CarFront size={24}/></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Огляд клієнта</p><h3 className="text-xl font-black text-slate-900 break-words">{selectedGroup.plate} · {selectedGroup.car}</h3>{lastVisit && <p className="text-xs font-bold text-slate-500 mt-1">Останній візит {formatVisitId(lastVisit)} · {formatVisitDate(lastVisit)}</p>}</div></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><SmallValue label="Останній пробіг" value={formatMileage(selectedSummary?.lastMileage)} /><SmallValue label="За весь час" value={formatMoney(selectedSummary?.total)} /><SmallValue label="Активних справ" value={warningCount} /></div></div><div className="rounded-3xl border border-slate-100 bg-white p-4 flex flex-col justify-center gap-3"><p className={`font-black ${warningCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{warningCount > 0 ? `Є ${warningCount} активних справ` : 'Все спокійно'}</p><p className="text-sm font-semibold text-slate-500">Швидко відкрийте останній візит або створіть повторний запис.</p><div className="grid grid-cols-1 gap-2"><button type="button" onClick={openVisit} disabled={!lastVisit} className="bg-slate-900 disabled:bg-slate-200 text-white py-3 rounded-2xl text-xs font-black uppercase">Відкрити візит</button>{lastVisit && <button type="button" onClick={() => onRepeat(lastVisit)} className="bg-blue-600 text-white py-3 rounded-2xl text-xs font-black uppercase">Повторити {formatVisitId(lastVisit)}</button>}</div></div></div></div>;
}

function AutoGrid({ selectedGroup, selectedSummary }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><SmallValue label="Клієнт" value={selectedGroup.client}/><SmallValue label="Телефон" value={selectedGroup.phone}/><SmallValue label="Номер авто" value={selectedGroup.plate}/><SmallValue label="Авто" value={selectedGroup.car}/><SmallValue label="VIN" value={selectedGroup.vin} wide/><SmallValue label="Останній пробіг" value={formatMileage(selectedSummary?.lastMileage)} wide/></div>;
}

function InfoBlock({ title, icon, action, children }) {
  return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm min-w-0"><div className="flex items-center justify-between gap-3 mb-4"><h3 className="font-black text-slate-900 flex items-center gap-2 text-sm uppercase">{icon}{title}</h3>{action}</div>{children}</div>;
}

function EmptySmall({ text }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center text-sm font-bold text-slate-400">{text}</div>;
}

function VisitMini({ visit, onRepeat, navigate }) {
  const openVisit = () => {
    const date = visitDateParam(visit);
    navigate(`/visits?visit_id=${getVisitId(visit)}${date ? `&date=${date}` : ''}`);
  };
  return <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-blue-900">Візит {formatVisitId(visit)}</p><p className="text-xs font-bold text-blue-700 mt-1">{formatVisitDate(visit)}</p></div><span className="rounded-xl bg-white border border-blue-100 px-3 py-1 text-[10px] font-black uppercase text-blue-700">{visit.status || '—'}</span></div><div className="grid grid-cols-2 gap-2 mt-3"><button type="button" onClick={openVisit} className="bg-slate-900 text-white py-2.5 rounded-xl text-xs font-black uppercase">Відкрити</button><button type="button" onClick={() => onRepeat(visit)} className="bg-white text-blue-700 border border-blue-100 py-2.5 rounded-xl text-xs font-black uppercase">Повторити</button></div></div>;
}

function VisitCard({ visit, onRepeat, navigate }) {
  const parts = safeArray(visit.parts);
  const services = safeArray(visit.services);
  const openVisit = () => {
    const date = visitDateParam(visit);
    navigate(`/visits?visit_id=${getVisitId(visit)}${date ? `&date=${date}` : ''}`);
  };
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">Візит {formatVisitId(visit)}</p><p className="text-sm font-bold text-slate-500 mt-1">{formatVisitDate(visit)}</p></div><span className="rounded-xl bg-slate-100 text-slate-600 px-3 py-1 text-[10px] font-black uppercase">{visit.status || '—'}</span></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4"><SmallValue label="Сума" value={formatMoney(getVisitTotal(visit))}/><SmallValue label="Пробіг" value={formatMileage(getVisitMileage(visit))}/><SmallValue label="Робіт" value={services.length}/><SmallValue label="Запчастин" value={parts.length}/></div>{(parts.length || services.length) ? <div className="mt-4 space-y-2">{services.map((service, index) => <LineItem key={`s-${index}`} title={getServiceName(service)} meta="Робота" value={formatMoney(getServicePrice(service))}/>) }{parts.map((part, index) => <LineItem key={`p-${index}`} title={`${getPartBrand(part)} ${getPartArticle(part)}`.trim() || getPartName(part)} meta={getPartName(part)} value={formatMoney(getPartSellPrice(part))}/>)}</div> : null}<div className="grid grid-cols-2 gap-2 mt-4"><button type="button" onClick={openVisit} className="bg-slate-900 text-white py-3 rounded-2xl text-xs font-black uppercase">Відкрити візит</button><button type="button" onClick={() => onRepeat(visit)} className="bg-blue-50 text-blue-700 py-3 rounded-2xl text-xs font-black uppercase">Повторити</button></div></div>;
}

function LineItem({ title, meta, value }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-black text-slate-800 truncate">{title}</p><p className="text-xs font-bold text-slate-400 truncate">{meta}</p></div><p className="font-black text-slate-900 shrink-0">{value}</p></div>;
}

function RecommendationRow({ rec, onDone }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-black text-slate-800 truncate">{rec.title}</p><p className="text-xs font-bold text-slate-400 truncate">{formatDueDate(rec.due_date)} · {rec.description || 'без опису'}</p></div><div className="flex items-center gap-2 shrink-0"><span className={`hidden sm:inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${recBadge[rec.state] || recBadge.active}`}>{rec.state_label || rec.status || '—'}</span>{isNotDone(rec) && <button type="button" onClick={() => onDone(rec)} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><CheckCircle2 size={16}/></button>}</div></div>;
}

function TaskRow({ task, onDone }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-black text-slate-800 truncate">{task.title}</p><p className="text-xs font-bold text-slate-400 truncate">{formatDueDate(task.due_date)} · {task.description || task.phone || 'без опису'}</p></div>{isNotDone(task) && <button type="button" onClick={() => onDone(task)} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><CheckCircle2 size={16}/></button>}</div>;
}

function SmallValue({ label, value, wide }) {
  return <div className={`rounded-2xl bg-slate-50 border border-slate-100 p-3 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}><p className="text-[10px] font-black uppercase text-slate-400 truncate">{label}</p><p className="font-black text-slate-900 mt-1 break-words">{value || '—'}</p></div>;
}

function RecommendationModal({ recommendationForm, setRecommendationForm, submitRecommendation, onClose }) {
  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6"><div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-black text-xl text-slate-900">Нова рекомендація</h2><button type="button" onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center"><X size={18}/></button></div><div className="space-y-3"><input value={recommendationForm.title} onChange={(e) => setRecommendationForm({ ...recommendationForm, title: e.target.value })} placeholder="Що треба зробити" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/><textarea value={recommendationForm.description} onChange={(e) => setRecommendationForm({ ...recommendationForm, description: e.target.value })} placeholder="Коментар" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 min-h-[110px]"/><div className="grid grid-cols-2 gap-3"><input type="date" value={recommendationForm.due_date} onChange={(e) => setRecommendationForm({ ...recommendationForm, due_date: e.target.value })} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/><input type="number" value={recommendationForm.due_mileage} onChange={(e) => setRecommendationForm({ ...recommendationForm, due_mileage: e.target.value })} placeholder="Пробіг" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/></div><button type="button" onClick={submitRecommendation} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black uppercase">Зберегти</button></div></div></div>;
}

function RepeatVisitModal({ repeatVisitTarget, repeatForm, setRepeatForm, submitRepeatVisit, onClose, isSaving }) {
  return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6"><div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-black text-xl text-slate-900">Повторний візит</h2><button type="button" onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center"><X size={18}/></button></div><div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 mb-4"><p className="font-black text-blue-900">{repeatVisitTarget.plate} · {repeatVisitTarget.client}</p><p className="text-xs font-bold text-blue-700 mt-1">На основі {formatVisitId(repeatVisitTarget)}</p></div><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><input type="date" value={repeatForm.date} onChange={(e) => setRepeatForm({ ...repeatForm, date: e.target.value })} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/><input type="time" value={repeatForm.time} onChange={(e) => setRepeatForm({ ...repeatForm, time: e.target.value })} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/></div><input value={repeatForm.mileage} onChange={(e) => setRepeatForm({ ...repeatForm, mileage: e.target.value })} placeholder="Пробіг" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500"/><textarea value={repeatForm.comment} onChange={(e) => setRepeatForm({ ...repeatForm, comment: e.target.value })} placeholder="Коментар" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-500 min-h-[90px]"/><button type="button" disabled={isSaving} onClick={submitRepeatVisit} className="w-full bg-blue-600 disabled:bg-slate-300 text-white rounded-2xl py-4 font-black uppercase">{isSaving ? 'Створюємо...' : 'Створити візит'}</button></div></div></div>;
}

export default Clients;
