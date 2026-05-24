import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, CarFront, CalendarDays, History, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const normalize = (value) => String(value || '').toLowerCase().trim();

const getStatusColor = (status) => {
  const s = String(status).toUpperCase();
  if (s === 'DONE' || s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const formatVisitDate = (visit) => {
  const rawDate = visit.updated_at || visit.created_at || visit.scheduled_datetime;
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
  };
};

const Clients = () => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [repeatVisitTarget, setRepeatVisitTarget] = useState(null);
  const [repeatForm, setRepeatForm] = useState({ date: '', time: '09:00', comment: '' });
  const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/visits/?history=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rawVisits = Array.isArray(response.data) ? response.data : [];
        setVisits(rawVisits.map(extractCarData));
      } catch (error) {
        alert('Не вдалося завантажити історію візитів.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, [token]);

  const filteredVisits = useMemo(() => {
    const query = normalize(search);
    if (!query) return visits;

    return visits.filter((visit) => {
      const carText = `${visit.brand || ''} ${visit.model || ''}`;
      return [visit.plate, visit.phone, carText, visit.client, visit.vin_code].some((field) =>
        normalize(field).includes(query)
      );
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

  const buildRepeatVisitPayload = (visit, overrides = {}) => {
    let parsedDeliveryData = {};
    if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
      try {
        parsedDeliveryData = JSON.parse(visit.delivery_data);
      } catch {
        parsedDeliveryData = {};
      }
    }

    return {
      plate: visit.plate || '',
      vin_code: visit.vin_code || '',
      client: visit.client || '',
      phone: visit.phone || '',
      brand: visit.brand || parsedDeliveryData.brand || '',
      model: visit.model || parsedDeliveryData.model || '',
      year: parsedDeliveryData.year || '',
      engine: parsedDeliveryData.engine || '',
      fuel: parsedDeliveryData.fuel || '',
      date: overrides.date || '',
      time: overrides.time || '09:00',
      comment: overrides.comment || '',
    };
  };

  const openRepeatVisitModal = (visit) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    setRepeatVisitTarget(visit);
    setRepeatForm({ date, time: '09:00', comment: '' });
  };

  const submitRepeatVisit = () => {
    if (!repeatVisitTarget || !repeatForm.date || !repeatForm.time) return;

    navigate('/visits', {
      state: {
        repeatVisitData: buildRepeatVisitPayload(repeatVisitTarget, repeatForm),
      },
    });

    setRepeatVisitTarget(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-slate-50">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Історія клієнтів</h1>
        <p className="text-slate-500 font-medium">Керування візитами та історією обслуговування</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук по номеру, телефону, імені чи авто..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold">Завантаження даних...</div>
      ) : (
        <div className="grid gap-4">
          {groupedClients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-slate-500 font-semibold">За запитом нічого не знайдено.</div>
          ) : (
            groupedClients.map((group) => (
              <button
                type="button"
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100 p-3 rounded-xl text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <CarFront size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{group.plate}</h3>
                    <p className="text-sm text-slate-500 font-semibold">{group.client} • {group.car}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Візитів:</span>
                  <span className="bg-slate-800 text-white font-black px-3 py-1 rounded-lg text-sm">{group.visits.length}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-800">{selectedGroup.client}</h2>
                <p className="text-sm font-bold text-blue-600">{selectedGroup.plate} • {selectedGroup.car}</p>
              </div>
              <button type="button" onClick={() => setSelectedGroup(null)} className="text-slate-400 hover:text-slate-600">Закрити</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {selectedGroup.visits.map((visit) => (
                <div key={visit.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-black text-slate-700 flex items-center gap-2">
                      <CalendarDays size={16} /> {formatVisitDate(visit)}
                    </p>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(visit.status)}`}>
                      {visit.status || 'В обробці'}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 mb-4 grid grid-cols-2 gap-4">
                    <div><span className="font-bold text-slate-400 block text-[10px] uppercase">Послуги:</span> {(visit.services || []).map((s) => s.name || s.service_name || 'Послуга').join(', ') || '—'}</div>
                    <div><span className="font-bold text-slate-400 block text-[10px] uppercase">Запчастини:</span> {(visit.parts || []).map((p) => p.name || p.article || p.sku || 'Запчастина').join(', ') || '—'}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openRepeatVisitModal(visit)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition-colors"
                  >
                    <History size={16} /> Повторити візит
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {repeatVisitTarget && (
        <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} /> Повторити візит</h3>
            <div className="space-y-3">
              <input type="date" className="w-full border rounded-lg px-3 py-2" value={repeatForm.date} onChange={(e) => setRepeatForm((prev) => ({ ...prev, date: e.target.value }))} />
              <input type="time" className="w-full border rounded-lg px-3 py-2" value={repeatForm.time} onChange={(e) => setRepeatForm((prev) => ({ ...prev, time: e.target.value }))} />
              <textarea placeholder="Коментар" className="w-full border rounded-lg px-3 py-2" rows={3} value={repeatForm.comment} onChange={(e) => setRepeatForm((prev) => ({ ...prev, comment: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRepeatVisitTarget(null)} className="px-3 py-2 rounded-lg border">Скасувати</button>
              <button type="button" onClick={submitRepeatVisit} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Створити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
