import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, CarFront, CalendarDays, History, Plus, Wrench, Package, ClipboardList, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CopyButton from '../components/common/CopyButton';

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
  return { ...visit, brand: visit.brand || parsed.brand || '', model: visit.model || parsed.model || '' };
};

const emptyRecommendationForm = {
  title: '',
  description: '',
  due_date: '',
  due_mileage: '',
};

const Clients = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [repeatVisitTarget, setRepeatVisitTarget] = useState(null);
  const [repeatForm, setRepeatForm] = useState({ date: '', time: '09:00', comment: '' });
  const [recommendationFormOpen, setRecommendationFormOpen] = useState(false);
  const [recommendationForm, setRecommendationForm] = useState(emptyRecommendationForm);
  const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
  const token = localStorage.getItem('access_token');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitsResponse, recResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/?history=true`, { headers: authHeaders }),
        axios.get(`${API_BASE}/api/recommendations/`, { headers: authHeaders }).catch(() => ({ data: [] })),
      ]);
      const rawVisits = Array.isArray(visitsResponse.data) ? visitsResponse.data : [];
      setVisits(rawVisits.map(extractCarData));
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
    } catch (error) {
      alert('Не вдалося завантажити історію клієнтів.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token]);

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
      groups.set(key, { id: key, client: visit.client || 'Невідомий клієнт', phone: visit.phone || '—', plate: visit.plate || '—', car: `${visit.brand || ''} ${visit.model || ''}`.trim() || '—', visits: [visit] });
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

  const buildRepeatVisitPayload = (visit, overrides = {}) => {
    let parsedDeliveryData = {};
    if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
      try { parsedDeliveryData = JSON.parse(visit.delivery_data); } catch { parsedDeliveryData = {}; }
    }
    return { plate: visit.plate || '', vin_code: visit.vin_code || '', client: visit.client || '', phone: visit.phone || '', brand: visit.brand || parsedDeliveryData.brand || '', model: visit.model || parsedDeliveryData.model || '', year: parsedDeliveryData.year || '', engine: parsedDeliveryData.engine || '', fuel: parsedDeliveryData.fuel || '', date: overrides.date || '', time: overrides.time || '09:00', comment: overrides.comment || '' };
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
      await axios.post(`${API_BASE}/api/recommendations/`, {
        client: selectedGroup.client,
        phone: selectedGroup.phone,
        plate: selectedGroup.plate,
        car: selectedGroup.car,
        title: recommendationForm.title.trim(),
        description: recommendationForm.description || '',
        due_date: recommendationForm.due_date || null,
        due_mileage: recommendationForm.due_mileage ? Number(recommendationForm.due_mileage) : null,
        status: 'active',
      }, { headers: authHeaders });
      setRecommendationFormOpen(false);
      setRecommendationForm(emptyRecommendationForm);
      const recResponse = await axios.get(`${API_BASE}/api/recommendations/`, { headers: authHeaders });
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
    } catch (error) {
      alert('Не вдалося створити рекомендацію.');
    }
  };

  const markRecommendationDone = async (rec) => {
    try {
      await axios.post(`${API_BASE}/api/recommendations/${rec.id}/mark-done/`, {}, { headers: authHeaders });
      const recResponse = await axios.get(`${API_BASE}/api/recommendations/`, { headers: authHeaders });
      setRecommendations(Array.isArray(recResponse.data) ? recResponse.data : []);
    } catch (error) {
      alert('Не вдалося змінити статус рекомендації.');
    }
  };

  const getAllArticles = (visit) => (visit.parts || []).map(getPartArticle).filter(Boolean).join('\n');

  return (
    <div className={embedded ? 'w-full' : 'max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-slate-50'}>
      {!embedded && <div className="mb-8"><h1 className="text-3xl font-black text-slate-900 tracking-tight">Історія клієнтів</h1><p className="text-slate-500 font-medium">Керування візитами та історією обслуговування</p></div>}

      <div className="relative mb-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по номеру, телефону, імені, авто чи артикулу..." className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-base" />
      </div>

      {loading ? <div className="text-center py-20 text-slate-400 font-bold">Завантаження даних...</div> : <div className="grid gap-4">
        {groupedClients.length === 0 ? <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500 font-semibold">За запитом нічого не знайдено.</div> : groupedClients.map((group) => <button type="button" key={group.id} onClick={() => setSelectedGroup(group)} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"><div className="flex items-center gap-4 min-w-0"><div className="bg-slate-100 p-3 rounded-xl text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><CarFront size={24} /></div><div className="min-w-0"><h3 className="font-black text-lg text-slate-800">{group.plate}</h3><p className="text-sm text-slate-500 font-semibold truncate">{group.client} • {group.car}</p></div></div><div className="flex items-center gap-3"><span className="text-xs font-black uppercase text-slate-400 tracking-wider">Візитів:</span><span className="bg-slate-800 text-white font-black px-3 py-1 rounded-lg text-sm">{group.visits.length}</span></div></button>)}
      </div>}

      {selectedGroup && <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 gap-3">
            <div className="min-w-0"><h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight truncate">{selectedGroup.client}</h2><p className="text-sm font-bold text-blue-600 mt-1">{selectedGroup.plate} • {selectedGroup.car}</p><p className="text-xs font-semibold text-slate-400 mt-1">Телефон: {selectedGroup.phone}</p></div>
            <button type="button" onClick={() => setSelectedGroup(null)} className="text-slate-400 hover:text-slate-600 font-semibold shrink-0">Закрити</button>
          </div>
          <div className="p-4 md:p-6 overflow-y-auto space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h3 className="font-black text-slate-800 flex items-center gap-2"><ClipboardList size={17} className="text-indigo-600" /> Рекомендації по клієнту</h3>
                <button type="button" onClick={openRecommendationModal} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-blue-700"><Plus size={13} /> Додати</button>
              </div>
              {selectedRecommendations.length === 0 ? <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm font-semibold text-slate-400 text-center">По цьому клієнту рекомендацій поки немає.</div> : <div className="space-y-2">
                {selectedRecommendations.slice(0, 5).map((rec) => <div key={rec.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1"><p className="text-sm font-black text-slate-800 leading-snug">{rec.title}</p><span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${recBadge[rec.state] || recBadge.active}`}>{rec.state_label}</span></div>
                  {rec.description && <p className="text-xs font-semibold text-slate-500 mb-2">{rec.description}</p>}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                    <span>Дата: {formatDueDate(rec.due_date)} {rec.due_mileage ? `• ${rec.due_mileage} км` : ''}</span>
                    {rec.status !== 'done' && <button type="button" onClick={() => markRecommendationDone(rec)} className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={12} /> Виконано</button>}
                  </div>
                </div>)}
                {selectedRecommendations.length > 5 && <button type="button" onClick={() => navigate('/crm/recommendations')} className="w-full bg-slate-50 text-slate-500 font-black text-[10px] uppercase py-2 rounded-xl hover:bg-slate-100">Показати всі в CRM</button>}
              </div>}
            </div>

            {selectedGroup.visits.map((visit) => { const services = visit.services || []; const parts = visit.parts || []; const articleCount = parts.map(getPartArticle).filter(Boolean).length; return <div key={visit.id} className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100"><div className="flex justify-between items-start mb-4 gap-3"><p className="font-black text-slate-700 flex items-center gap-2"><CalendarDays size={16} /> {formatVisitDate(visit)}</p><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shrink-0 ${getStatusColor(visit.status)}`}>{visit.status || 'В обробці'}</span></div><div className="space-y-4 mb-4"><div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Wrench size={16} className="text-blue-600" /> Послуги</h3><span className="text-[10px] font-black uppercase text-slate-400">{services.length}</span></div>{services.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Послуги не додані</p> : <div className="space-y-2">{services.map((service, index) => <div key={service.id || index} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><p className="text-sm font-bold text-slate-700 leading-snug">{getServiceName(service)}</p><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getServicePrice(service))}</p></div>)}</div>}</div><div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3 mb-3"><h3 className="font-black text-slate-800 flex items-center gap-2"><Package size={16} className="text-emerald-600" /> Запчастини</h3>{articleCount > 1 && <CopyButton value={getAllArticles(visit)} label="Всі артикули" copiedLabel="Скопійовано" compact />}</div>{parts.length === 0 ? <p className="text-sm text-slate-400 font-semibold">Запчастини не додані</p> : <div className="space-y-3">{parts.map((part, index) => { const article = getPartArticle(part); const brand = getPartBrand(part); const supplier = getPartSupplier(part); return <div key={part.id || `${article}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3 mb-2"><div className="min-w-0">{brand && <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 mb-1">{brand}</p>}<p className="text-sm font-black text-slate-800 leading-snug break-words">{getPartName(part)}</p></div><p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatMoney(getPartSellPrice(part))}</p></div><div className="flex flex-wrap items-center gap-2 mt-3">{article ? <CopyButton value={article} label={article} copiedLabel="Скопійовано" title="Скопіювати артикул" compact /> : <span className="rounded-lg bg-slate-100 text-slate-400 px-2 py-1 text-xs font-bold">Артикул: —</span>}{supplier && <span className="rounded-lg bg-white border border-slate-200 text-slate-500 px-2 py-1 text-xs font-bold">{supplier}</span>}</div></div>; })}</div>}</div></div><button type="button" onClick={() => openRepeatVisitModal(visit)} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition-colors"><History size={16} /> Повторити візит</button></div>; })}
          </div>
        </div>
      </div>}

      {recommendationFormOpen && <div className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"><div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ClipboardList size={18} /> Нова рекомендація</h3><button type="button" onClick={() => setRecommendationFormOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div><div className="p-5 space-y-3"><input value={recommendationForm.title} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Що потрібно зробити?" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /><textarea value={recommendationForm.description} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Коментар" rows={3} className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="date" value={recommendationForm.due_date} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_date: e.target.value }))} className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /><input type="number" value={recommendationForm.due_mileage} onChange={(e) => setRecommendationForm((prev) => ({ ...prev, due_mileage: e.target.value }))} placeholder="Пробіг" className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" /></div></div><div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2"><button type="button" onClick={() => setRecommendationFormOpen(false)} className="px-4 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600">Скасувати</button><button type="button" onClick={submitRecommendation} className="px-4 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700">Зберегти</button></div></div></div>}

      {repeatVisitTarget && <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5"><h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} /> Повторити візит</h3><div className="space-y-3"><input type="date" className="w-full border rounded-lg px-3 py-2" value={repeatForm.date} onChange={(e) => setRepeatForm((prev) => ({ ...prev, date: e.target.value }))} /><input type="time" className="w-full border rounded-lg px-3 py-2" value={repeatForm.time} onChange={(e) => setRepeatForm((prev) => ({ ...prev, time: e.target.value }))} /><textarea placeholder="Коментар" className="w-full border rounded-lg px-3 py-2" rows={3} value={repeatForm.comment} onChange={(e) => setRepeatForm((prev) => ({ ...prev, comment: e.target.value }))} /></div><div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setRepeatVisitTarget(null)} className="px-3 py-2 rounded-lg border">Скасувати</button><button type="button" onClick={submitRepeatVisit} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Створити</button></div></div></div>}
    </div>
  );
};

export default Clients;
