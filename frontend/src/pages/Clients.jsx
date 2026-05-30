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
  History,
  ListChecks,
  Package,
  Phone,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CopyButton from '../components/common/CopyButton';
import api from '../api/axios';

const normalize = (value) => String(value || '').toLowerCase().trim();
const safeText = (value) => String(value || '').trim();
const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getStatusColor = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'DONE' || s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
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

const formatVisitDate = (visit) => {
  const rawDate = visit?.scheduled_datetime || visit?.updated_at || visit?.created_at || visit?.date;
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const formatMileage = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '—';
  return `${number.toLocaleString('uk-UA')} км`;
};

const getPartArticle = (part) => part?.article || part?.sku || part?.part_number || part?.code || '';
const getPartName = (part) => part?.name || part?.title || 'Запчастина';
const getPartBrand = (part) => part?.brand || part?.manufacturer || '';
const getPartSupplier = (part) => part?.supplier || part?.supplier_name || '';
const getPartSellPrice = (part) => part?.sell_price ?? part?.price ?? part?.sale_price ?? part?.client_price ?? null;
const getServiceName = (service) => service?.name || service?.service_name || 'Послуга';
const getServicePrice = (service) => service?.price ?? service?.sell_price ?? null;
const getVisitMileage = (visit) => visit?.mileage ?? visit?.odometer ?? visit?.run ?? visit?.car_mileage ?? null;

const getVisitTotal = (visit) => {
  const partsTotal = safeArray(visit?.parts).reduce((sum, part) => sum + safeNumber(getPartSellPrice(part)), 0);
  const servicesTotal = safeArray(visit?.services).reduce((sum, service) => sum + safeNumber(getServicePrice(service)), 0);
  return partsTotal + servicesTotal;
};

const extractCarData = (visit) => {
  let parsed = {};
  if (visit?.delivery_data && typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(visit.delivery_data);
    } catch {
      parsed = {};
    }
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
const clientTabs = [
  { key: 'overview', label: 'Огляд', icon: UserRound },
  { key: 'visits', label: 'Візити', icon: History },
  { key: 'recommendations', label: 'Рекомендації', icon: ClipboardList },
  { key: 'tasks', label: 'Задачі', icon: ListChecks },
];
const isNotDone = (item) => !['done', 'cancelled', 'canceled'].includes(String(item?.status || item?.state || '').toLowerCase());

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
  const [repeatForm, setRepeatForm] = useState({ date: '', time: '09:00', mileage: '', comment: '' });
  const [recommendationFormOpen, setRecommendationFormOpen] = useState(false);
  const [recommendationForm, setRecommendationForm] = useState(emptyRecommendationForm);
  const [creatingRepeatVisit, setCreatingRepeatVisit] = useState(false);

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
    } catch {
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
      const carText = `${visit.brand || ''} ${visit.model || ''} ${visit.year || ''} ${visit.engine || ''}`;
      const partText = safeArray(visit.parts)
        .map((part) => `${getPartBrand(part)} ${getPartArticle(part)} ${getPartName(part)} ${getPartSupplier(part)}`)
        .join(' ');
      return [visit.plate, visit.phone, carText, visit.client, visit.vin_code, partText]
        .some((field) => normalize(field).includes(query));
    });
  }, [visits, search]);

  const groupedClients = useMemo(() => {
    const groups = new Map();
    filteredVisits.forEach((visit) => {
      const key = `${normalize(visit.phone)}|${normalize(visit.plate)}|${normalize(visit.client)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.visits.push(visit);
        return;
      }
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
      .map((item) => ({
        ...item,
        visits: item.visits.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)),
      }))
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
        const order = { overdue: 0, soon: 1, active: 2, new: 2, done: 3, cancelled: 4, canceled: 4 };
        return (order[a.state] ?? order[a.status] ?? 9) - (order[b.state] ?? order[b.status] ?? 9);
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
        return (order[a.state] ?? order[a.status] ?? 9) - (order[b.state] ?? order[b.status] ?? 9);
      });
  }, [tasks, selectedGroup]);

  const selectedSummary = useMemo(() => {
    if (!selectedGroup) return null;
    const allParts = selectedGroup.visits.flatMap((visit) => safeArray(visit.parts));
    const allServices = selectedGroup.visits.flatMap((visit) => safeArray(visit.services));
    const lastVisit = selectedGroup.visits[0];
    const total = selectedGroup.visits.reduce((sum, visit) => sum + getVisitTotal(visit), 0);
    const activeRecommendations = selectedRecommendations.filter(isNotDone);
    const activeTasks = selectedTasks.filter(isNotDone);
    const lastMileage = selectedGroup.visits.map(getVisitMileage).find((value) => Number(value) > 0) || null;

    return {
      visits: selectedGroup.visits.length,
      services: allServices.length,
      parts: allParts.length,
      activeRecs: activeRecommendations.length,
      activeTasks: activeTasks.length,
      lastVisit,
      lastMileage,
      lastVisitTotal: lastVisit ? getVisitTotal(lastVisit) : 0,
      total,
      activeRecommendations,
      activeTasks,
    };
  }, [selectedGroup, selectedRecommendations, selectedTasks]);

  const buildCleanRepeatPayload = (visit, overrides = {}) => {
    const cleanDate = safeText(overrides.date);
    const cleanTime = safeText(overrides.time || '09:00');
    const scheduledDatetime = cleanDate && cleanTime ? new Date(`${cleanDate}T${cleanTime}`).toISOString() : null;
    const mileage = safeText(overrides.mileage || getVisitMileage(visit) || '');

    return {
      plate: safeText(visit.plate).toUpperCase(),
      vin_code: safeText(visit.vin_code),
      client: safeText(visit.client),
      phone: safeText(visit.phone),
      scheduled_datetime: scheduledDatetime,
      delivery_type: 'pickup',
      delivery_data: JSON.stringify({
        brand: safeText(visit.brand),
        model: safeText(visit.model),
        year: safeText(visit.year),
        engine: safeText(visit.engine),
        fuel: safeText(visit.fuel),
        mileage,
      }),
      payment_status: 'unpaid',
      prepayment_amount: 0,
      comment: safeText(overrides.comment) ? `[Повторний візит] ${safeText(overrides.comment)}` : '[Повторний візит]',
    };
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
    if (!payload.plate || !payload.client || !payload.phone) {
      alert('Не вистачає даних клієнта для повторного візиту.');
      return;
    }
    setCreatingRepeatVisit(true);
    try {
      await api.post('/api/visits/', payload);
      setRepeatVisitTarget(null);
      setSelectedGroup(null);
      await loadData();
      navigate('/visits', { state: { createdRepeatVisit: true } });
    } catch {
      alert('Не вдалося створити повторний візит.');
    } finally {
      setCreatingRepeatVisit(false);
    }
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
    } catch {
      alert('Не вдалося створити рекомендацію.');
    }
  };

  const markRecommendationDone = async (rec) => {
    try {
      await api.post(`/api/recommendations/${rec.id}/mark-done/`);
      const recResponse = await api.get('/api/recommendations/');
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
    } catch {
      alert('Не вдалося змінити статус рекомендації.');
    }
  };

  const markTaskDone = async (task) => {
    try {
      await api.post(`/api/crm-tasks/${task.id}/mark-done/`);
      const taskResponse = await api.get('/api/crm-tasks/');
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
    } catch {
      alert('Не вдалося змінити статус задачі.');
    }
  };

  const getAllArticles = (visit) => safeArray(visit.parts).map(getPartArticle).filter(Boolean).join('\n');

  const modalOpen = Boolean(selectedGroup || recommendationFormOpen || repeatVisitTarget);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [modalOpen]);

  return (
    <div className={embedded ? 'w-full max-w-full overflow-x-hidden' : 'w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-8 min-h-screen bg-slate-50 overflow-x-hidden'}>
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Історія клієнтів</h1>
          <p className="text-slate-500 font-medium">Керування візитами та історією обслуговування</p>
        </div>
      )}

      <div className="relative mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-2 max-w-full">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Пошук по номеру, телефону, імені, авто чи артикулу..."
          className="w-full min-w-0 pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm md:text-base"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold">Завантаження даних...</div>
      ) : (
        <div className="grid gap-4 max-w-full">
          {groupedClients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500 font-semibold">За запитом нічого не знайдено.</div>
          ) : groupedClients.map((group) => (
            <button
              type="button"
              key={group.id}
              onClick={() => openClient(group)}
              className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 group w-full max-w-full min-w-0"
            >
              <div className="flex items-center gap-3 md:gap-4 min-w-0 w-full sm:w-auto">
                <div className="bg-slate-100 p-3 rounded-xl text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  <CarFront size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-lg text-slate-800 break-words">{group.plate}</h3>
                  <p className="text-sm text-slate-500 font-semibold break-words">{group.client} • {group.car}</p>
                  <p className="text-xs text-slate-400 font-bold mt-1 break-words">{group.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Візитів:</span>
                <span className="bg-slate-800 text-white font-black px-3 py-1 rounded-lg text-sm">{group.visits.length}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedGroup && (
        <ClientDetailsModal
          selectedGroup={selectedGroup}
          selectedSummary={selectedSummary}
          selectedRecommendations={selectedRecommendations}
          selectedTasks={selectedTasks}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          setSelectedGroup={setSelectedGroup}
          openRecommendationModal={openRecommendationModal}
          openRepeatVisitModal={openRepeatVisitModal}
          markRecommendationDone={markRecommendationDone}
          markTaskDone={markTaskDone}
          getAllArticles={getAllArticles}
        />
      )}
      {recommendationFormOpen && (
        <RecommendationModal
          recommendationForm={recommendationForm}
          setRecommendationForm={setRecommendationForm}
          submitRecommendation={submitRecommendation}
          onClose={() => setRecommendationFormOpen(false)}
        />
      )}
      {repeatVisitTarget && (
        <RepeatVisitModal
          repeatVisitTarget={repeatVisitTarget}
          repeatForm={repeatForm}
          setRepeatForm={setRepeatForm}
          submitRepeatVisit={submitRepeatVisit}
          onClose={() => setRepeatVisitTarget(null)}
          isSaving={creatingRepeatVisit}
        />
      )}
    </div>
  );
};

function ClientDetailsModal({
  selectedGroup,
  selectedSummary,
  selectedRecommendations,
  selectedTasks,
  detailTab,
  setDetailTab,
  setSelectedGroup,
  openRecommendationModal,
  openRepeatVisitModal,
  markRecommendationDone,
  markTaskDone,
  getAllArticles,
}) {
  const activeRecs = safeArray(selectedSummary?.activeRecommendations);
  const activeTasks = safeArray(selectedSummary?.activeTasks);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <div className="bg-white w-full sm:w-full max-w-none sm:max-w-5xl rounded-none sm:rounded-3xl shadow-2xl overflow-y-auto sm:overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] min-w-0 overscroll-contain">
        <div className="p-5 sm:p-4 md:p-6 border-b border-slate-100 bg-slate-50 sm:shrink-0">
          <div className="flex justify-between items-start gap-3 mb-5 sm:mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600 mb-2">Картка клієнта</p>
              <h2 className="text-2xl sm:text-xl md:text-2xl font-black text-slate-800 leading-tight break-words">{selectedGroup.client}</h2>
              <p className="text-base sm:text-sm font-bold text-blue-600 mt-1 break-words">{selectedGroup.plate} • {selectedGroup.car}</p>
              <div className="flex flex-wrap gap-2 mt-3 sm:mt-2 text-sm sm:text-xs font-bold text-slate-500">
                <span className="bg-white border border-slate-200 rounded-xl sm:rounded-lg px-3 sm:px-2 py-2 sm:py-1 flex items-center gap-1"><Phone size={14} /> {selectedGroup.phone}</span>
                <span className="bg-white border border-slate-200 rounded-xl sm:rounded-lg px-3 sm:px-2 py-2 sm:py-1 break-all">VIN: {selectedGroup.vin}</span>
                <span className="bg-white border border-slate-200 rounded-xl sm:rounded-lg px-3 sm:px-2 py-2 sm:py-1 flex items-center gap-1"><Gauge size={14} /> {formatMileage(selectedSummary?.lastMileage)}</span>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedGroup(null)} className="bg-white border border-slate-200 text-slate-500 hover:text-slate-800 font-black text-xs uppercase px-3 py-2 rounded-xl shrink-0">Закрити</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-2 md:gap-3">
            <MiniStat label="Візити" value={selectedSummary?.visits || 0} />
            <MiniStat label="Роботи" value={selectedSummary?.services || 0} />
            <MiniStat label="Запчастини" value={selectedSummary?.parts || 0} />
            <MiniStat label="Нагадування" value={safeNumber(selectedSummary?.activeRecs)} danger={safeNumber(selectedSummary?.activeRecs) > 0} />
            <MiniStat label="Сума" value={formatMoney(selectedSummary?.total || 0)} wide />
          </div>
        </div>

        <div className="px-4 sm:px-3 md:px-6 pt-4 bg-white border-b border-slate-100 overflow-x-auto sm:shrink-0">
          <div className="flex gap-2 min-w-max pb-3">
            {clientTabs.map((tab) => {
              const Icon = tab.icon;
              const active = detailTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 sm:py-2.5 rounded-2xl text-sm sm:text-xs font-black uppercase whitespace-nowrap transition-all ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-none sm:flex-1 sm:min-h-0 p-4 sm:p-3 md:p-6 overflow-visible sm:overflow-y-auto sm:overscroll-contain space-y-5 sm:space-y-4 min-w-0 pb-8 sm:pb-6">
          {detailTab === 'overview' && (
            <div className="space-y-5">
              <OverviewHero selectedGroup={selectedGroup} selectedSummary={selectedSummary} onRepeat={openRepeatVisitModal} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-4">
                <InfoBlock title="Останній візит" icon={<Clock3 size={18} className="text-blue-600" />}>
                  {selectedSummary?.lastVisit ? <VisitMini visit={selectedSummary.lastVisit} onRepeat={openRepeatVisitModal} /> : <EmptySmall text="Візитів немає" />}
                </InfoBlock>
                <InfoBlock
                  title="Що треба не забути"
                  icon={<ClipboardList size={18} className="text-amber-600" />}
                  action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-4 sm:px-3 py-3 sm:py-2 rounded-xl text-xs sm:text-[10px] font-black uppercase flex items-center justify-center gap-1"><Plus size={14} /> Додати</button>}
                >
                  {activeRecs.length === 0 ? <EmptySmall text="Активних нагадувань немає" /> : (
                    <div className="space-y-3 sm:space-y-2">
                      {activeRecs.slice(0, 4).map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}
                      {activeRecs.length > 4 && <button type="button" onClick={() => setDetailTab('recommendations')} className="w-full rounded-xl border border-blue-100 bg-blue-50 text-blue-700 py-3 text-xs font-black uppercase">Показати всі: {activeRecs.length}</button>}
                    </div>
                  )}
                </InfoBlock>
                <InfoBlock title="Активні задачі" icon={<ListChecks size={18} className="text-indigo-600" />}>
                  {activeTasks.length === 0 ? <EmptySmall text="Активних задач немає" /> : (
                    <div className="space-y-3 sm:space-y-2">
                      {activeTasks.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}
                    </div>
                  )}
                </InfoBlock>
                <InfoBlock title="Контакт і авто" icon={<FileText size={18} className="text-slate-600" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                    <SmallValue label="Клієнт" value={selectedGroup.client} />
                    <SmallValue label="Телефон" value={selectedGroup.phone} />
                    <SmallValue label="Номер авто" value={selectedGroup.plate} />
                    <SmallValue label="Авто" value={selectedGroup.car} />
                    <SmallValue label="VIN" value={selectedGroup.vin} wide />
                    <SmallValue label="Останній пробіг" value={formatMileage(selectedSummary?.lastMileage)} wide />
                  </div>
                </InfoBlock>
              </div>
            </div>
          )}

          {detailTab === 'recommendations' && (
            <InfoBlock
              title="Рекомендації по клієнту"
              icon={<ClipboardList size={18} className="text-indigo-600" />}
              action={<button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-4 sm:px-3 py-3 sm:py-2 rounded-xl text-xs sm:text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-blue-700"><Plus size={14} /> Додати</button>}
            >
              {selectedRecommendations.length === 0 ? <EmptySmall text="По цьому клієнту рекомендацій поки немає." /> : (
                <div className="space-y-3 sm:space-y-2">
                  {selectedRecommendations.map((rec) => <RecommendationRow key={rec.id} rec={rec} onDone={markRecommendationDone} />)}
                </div>
              )}
            </InfoBlock>
          )}

          {detailTab === 'tasks' && (
            <InfoBlock title="Задачі по клієнту" icon={<ListChecks size={18} className="text-blue-600" />}>
              {selectedTasks.length === 0 ? <EmptySmall text="По цьому клієнту задач поки немає." /> : (
                <div className="space-y-3 sm:space-y-2">
                  {selectedTasks.map((task) => <TaskRow key={task.id} task={task} onDone={markTaskDone} />)}
                </div>
              )}
            </InfoBlock>
          )}

          {detailTab === 'visits' && (
            <div className="space-y-5 sm:space-y-4">
              {selectedGroup.visits.map((visit) => <VisitCard key={visit.id} visit={visit} onRepeat={openRepeatVisitModal} getAllArticles={getAllArticles} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewHero({ selectedGroup, selectedSummary, onRepeat }) {
  const lastVisit = selectedSummary?.lastVisit;
  const activeRecCount = safeNumber(selectedSummary?.activeRecs);
  const activeTaskCount = safeNumber(selectedSummary?.activeTasks);
  const warningCount = activeRecCount + activeTaskCount;
  const warningText = warningCount > 0
    ? `Активних нагадувань/задач: ${warningCount}`
    : 'Активних нагадувань і задач немає.';

  return (
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 sm:p-4 shadow-sm min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0"><CarFront size={24} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Огляд клієнта</p>
              <h3 className="text-xl sm:text-lg font-black text-slate-900 break-words">{selectedGroup.plate} · {selectedGroup.car}</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <QuickMetric label="Останній візит" value={lastVisit ? formatVisitDate(lastVisit) : '—'} />
            <QuickMetric label="Пробіг" value={formatMileage(selectedSummary?.lastMileage)} />
            <QuickMetric label="За весь час" value={formatMoney(selectedSummary?.total || 0)} />
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col justify-between gap-4 min-w-0">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${warningCount ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {warningCount ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900 break-words">{warningCount ? 'Є що проконтролювати' : 'Все спокійно'}</p>
              <p className="text-sm font-semibold text-slate-500 break-words">{warningText}</p>
            </div>
          </div>
          {lastVisit && (
            <button type="button" onClick={() => onRepeat(lastVisit)} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-black py-3 rounded-2xl hover:bg-slate-800 transition-colors">
              <History size={17} /> Повторити візит
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickMetric({ label, value }) {
  return <div className="rounded-2xl bg-white border border-slate-200 p-4 min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-sm font-black text-slate-900 mt-1 break-words">{value}</p></div>;
}

function MiniStat({ label, value, danger, wide }) {
  return <div className={`rounded-2xl border p-4 sm:p-3 min-w-0 ${danger ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'} ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] sm:text-[9px] font-black uppercase text-slate-400 truncate">{label}</p><p className="text-xl sm:text-lg font-black text-slate-900 truncate">{value}</p></div>;
}

function InfoBlock({ title, icon, action, children }) {
  return <div className="bg-white rounded-3xl sm:rounded-2xl border border-slate-200 p-5 sm:p-4 shadow-sm min-w-0"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-3"><h3 className="text-base sm:text-sm font-black text-slate-800 flex items-center gap-2 min-w-0">{icon}<span className="break-words">{title}</span></h3>{action}</div>{children}</div>;
}

function EmptySmall({ text }) {
  return <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 sm:p-4 text-base sm:text-sm font-semibold text-slate-400 text-center">{text}</div>;
}

function SmallValue({ label, value, wide }) {
  return <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-3 min-w-0 ${wide ? 'sm:col-span-2' : ''}`}><p className="text-[11px] sm:text-[10px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-800 text-base sm:text-sm break-words">{value || '—'}</p></div>;
}

function RecommendationRow({ rec, onDone }) {
  const state = rec.state || rec.status || 'active';
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-3 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2 sm:mb-1">
        <p className="text-base sm:text-sm font-black text-slate-800 leading-snug break-words">{rec.title}</p>
        <span className={`text-[10px] sm:text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 self-start ${recBadge[state] || recBadge.active}`}>{rec.state_label || state}</span>
      </div>
      {rec.description && <p className="text-sm sm:text-xs font-semibold text-slate-500 mb-2 break-words">{rec.description}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-[11px] font-bold text-slate-500">
        <span>Дата: {formatDueDate(rec.due_date)} {rec.due_mileage ? `• ${Number(rec.due_mileage).toLocaleString('uk-UA')} км` : ''}</span>
        {isNotDone(rec) && <button type="button" onClick={() => onDone(rec)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 sm:px-2 py-2 sm:py-1 rounded-lg font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Виконано</button>}
      </div>
    </div>
  );
}

function TaskRow({ task, onDone }) {
  const state = task.state || task.status || 'new';
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-3 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2 sm:mb-1">
        <p className="text-base sm:text-sm font-black text-slate-800 leading-snug break-words">{task.title}</p>
        <span className={`text-[10px] sm:text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 self-start ${recBadge[state] || recBadge.new}`}>{task.state_label || state}</span>
      </div>
      {task.description && <p className="text-sm sm:text-xs font-semibold text-slate-500 mb-2 break-words">{task.description}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-[11px] font-bold text-slate-500">
        <span>Дата: {formatDueDate(task.due_date)}</span>
        {isNotDone(task) && <button type="button" onClick={() => onDone(task)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 sm:px-2 py-2 sm:py-1 rounded-lg font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Виконано</button>}
      </div>
    </div>
  );
}

function VisitMini({ visit, onRepeat }) {
  const services = safeArray(visit.services);
  const parts = safeArray(visit.parts);
  return (
    <div className="space-y-4 sm:space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
        <SmallValue label="Дата" value={formatVisitDate(visit)} />
        <SmallValue label="Статус" value={visit.status || 'В обробці'} />
        <SmallValue label="Пробіг" value={formatMileage(getVisitMileage(visit))} />
        <SmallValue label="Сума" value={formatMoney(getVisitTotal(visit))} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-2"><SmallValue label="Робіт" value={services.length} /><SmallValue label="Запчастин" value={parts.length} /></div>
      <button type="button" onClick={() => onRepeat(visit)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 sm:py-2.5 rounded-2xl sm:rounded-xl hover:bg-slate-900 transition-colors"><History size={17} /> Повторити візит</button>
    </div>
  );
}

function VisitCard({ visit, onRepeat, getAllArticles }) {
  const services = safeArray(visit.services);
  const parts = safeArray(visit.parts);
  const articleCount = parts.map(getPartArticle).filter(Boolean).length;

  return (
    <div className="bg-slate-50 rounded-3xl sm:rounded-2xl p-5 sm:p-4 md:p-5 border border-slate-100 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <p className="text-base sm:text-sm font-black text-slate-700 flex items-center gap-2 break-words"><CalendarDays size={17} /> {formatVisitDate(visit)}</p>
          <p className="text-xs font-bold text-slate-400 mt-1">Пробіг: {formatMileage(getVisitMileage(visit))} • Сума: {formatMoney(getVisitTotal(visit))}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shrink-0 self-start ${getStatusColor(visit.status)}`}>{visit.status || 'В обробці'}</span>
      </div>
      <div className="space-y-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Wrench size={16} className="text-blue-600" /> Послуги</h3><span className="text-[10px] font-black uppercase text-slate-400">{services.length}</span></div>
          {services.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Послуги не додані</p> : (
            <div className="space-y-2">{services.map((service, index) => <div key={service.id || index} className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"><p className="text-sm font-bold text-slate-700 leading-snug break-words">{getServiceName(service)}</p><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getServicePrice(service))}</p></div>)}</div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Package size={16} className="text-emerald-600" /> Запчастини</h3>{articleCount > 1 && <CopyButton value={getAllArticles(visit)} label="Всі артикули" copiedLabel="Скопійовано" compact />}</div>
          {parts.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Запчастини не додані</p> : (
            <div className="space-y-3">
              {parts.map((part, index) => {
                const article = getPartArticle(part);
                const brand = getPartBrand(part);
                const supplier = getPartSupplier(part);
                return (
                  <div key={part.id || `${article}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2"><div className="min-w-0">{brand && <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 mb-1 break-words">{brand}</p>}<p className="text-sm font-black text-slate-800 leading-snug break-words">{getPartName(part)}</p></div><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getPartSellPrice(part))}</p></div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">{article ? <CopyButton value={article} label={article} copiedLabel="Скопійовано" title="Скопіювати артикул" compact /> : <span className="rounded-lg bg-slate-100 text-slate-400 px-2 py-1 text-xs font-bold">Артикул: —</span>}{supplier && <span className="rounded-lg bg-white border border-slate-200 text-slate-500 px-2 py-1 text-xs font-bold break-words">{supplier}</span>}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <button type="button" onClick={() => onRepeat(visit)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-3.5 sm:py-2.5 rounded-2xl sm:rounded-xl hover:bg-slate-900 transition-colors"><History size={17} /> Повторити візит</button>
    </div>
  );
}

function RecommendationModal({ recommendationForm, setRecommendationForm, submitRecommendation, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="w-[calc(100vw-1rem)] sm:w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden max-h-[calc(100dvh-1rem)] flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ClipboardList size={18} /> Нова рекомендація</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 space-y-3 overflow-y-auto overscroll-contain">
          <input value={recommendationForm.title} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Що потрібно зробити?" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" />
          <textarea value={recommendationForm.description} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Коментар" rows={3} className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="date" value={recommendationForm.due_date} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_date: e.target.value }))} className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /><input type="number" value={recommendationForm.due_mileage} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_mileage: e.target.value }))} placeholder="Пробіг" className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /></div>
        </div>
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2 shrink-0"><button type="button" onClick={onClose} className="px-4 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600">Скасувати</button><button type="button" onClick={submitRecommendation} className="px-4 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700">Зберегти</button></div>
      </div>
    </div>
  );
}

function RepeatVisitModal({ repeatVisitTarget, repeatForm, setRepeatForm, submitRepeatVisit, onClose, isSaving }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="w-[calc(100vw-1rem)] sm:w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Новий запис</p><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Plus size={18} /> Повторний візит</h3><p className="text-xs font-bold text-slate-500 mt-1 break-words">{repeatVisitTarget?.client} · {repeatVisitTarget?.plate}</p></div><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0"><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Дата</label><input type="date" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 font-bold outline-none focus:border-blue-500" value={repeatForm.date} onChange={(e) => setRepeatForm((prev) => ({ ...prev, date: e.target.value }))} /></div><div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Час</label><input type="time" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 font-bold outline-none focus:border-blue-500" value={repeatForm.time} onChange={(e) => setRepeatForm((prev) => ({ ...prev, time: e.target.value }))} /></div></div>
          <div><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Пробіг</label><input type="number" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 font-bold outline-none focus:border-blue-500" value={repeatForm.mileage} onChange={(e) => setRepeatForm((prev) => ({ ...prev, mileage: e.target.value }))} placeholder="Поточний пробіг" /></div>
          <textarea placeholder="Коментар до нового візиту" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-3 font-semibold outline-none focus:border-blue-500 resize-none" rows={3} value={repeatForm.comment} onChange={(e) => setRepeatForm((prev) => ({ ...prev, comment: e.target.value }))} />
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs font-bold text-blue-700">Буде створено новий візит. Старий запис, роботи, запчастини та ID не копіюються.</div>
        </div>
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2"><button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600 disabled:opacity-50">Скасувати</button><button type="button" onClick={submitRepeatVisit} disabled={isSaving || !repeatForm.date || !repeatForm.time} className="px-4 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Створюю...' : 'Створити візит'}</button></div>
      </div>
    </div>
  );
}

export default Clients;
