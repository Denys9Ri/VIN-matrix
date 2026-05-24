import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, Phone, CarFront, User, CalendarDays, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const normalize = (value) => String(value || '').toLowerCase().trim();

const formatVisitDate = (visit) => {
  const rawDate = visit.updated_at || visit.created_at || visit.scheduled_datetime;
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getWorksSummary = (visit) => {
  const services = Array.isArray(visit.services) ? visit.services.length : 0;
  const parts = Array.isArray(visit.parts) ? visit.parts.length : 0;
  if (!services && !parts) return 'Без деталей/робіт';
  return `Роботи: ${services}, Запчастини: ${parts}`;
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

  const buildRepeatVisitPayload = (visit) => {
    let parsedDeliveryData = {};
    if (typeof visit.delivery_data === 'string' && visit.delivery_data.trim().startsWith('{')) {
      try {
        parsedDeliveryData = JSON.parse(visit.delivery_data);
      } catch {
        parsedDeliveryData = {};
      }
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);

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
      date: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`,
      time: '09:00',
    };
  };

  const handleRepeatVisit = (visit) => {
    navigate('/visits', {
      state: {
        repeatVisitData: buildRepeatVisitPayload(visit),
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 md:pl-72 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800 mb-4">Історія візитів клієнтів</h1>
      <p className="text-slate-500 font-semibold mb-5">Пошук по держ. номеру, телефону або авто клієнта.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук: номер, телефон, авто, клієнт"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 font-semibold">Завантаження...</p>
      ) : (
        <div className="space-y-4">
          {groupedClients.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-slate-500 font-semibold">
              За запитом нічого не знайдено.
            </div>
          ) : (
            groupedClients.map((group) => (
              <section
                key={group.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <p className="font-black text-slate-800 flex items-center gap-2"><User size={14} /> {group.client}</p>
                    <p className="font-semibold text-slate-600 flex items-center gap-2"><Phone size={14} /> {group.phone}</p>
                    <p className="font-semibold text-slate-600 flex items-center gap-2 uppercase"><CarFront size={14} /> {group.plate}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className="font-semibold text-left text-blue-700 hover:text-blue-800 underline underline-offset-2"
                    >
                      Авто: {group.car} · Візитів: {group.visits.length}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.visits.map((visit) => (
                    <div key={visit.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={14} /> {formatVisitDate(visit)}</p>
                        <p className="text-xs text-slate-500 mt-1">Статус: {visit.status || '—'}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Wrench size={14} /> {getWorksSummary(visit)}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-800">{selectedGroup.client}</h2>
                <p className="text-sm text-slate-500 font-semibold">Всього візитів: {selectedGroup.visits.length}</p>
              </div>
              <button type="button" onClick={() => setSelectedGroup(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600">Закрити</button>
            </div>

            <div className="p-4 md:p-5 overflow-y-auto max-h-[65vh] space-y-3">
              {selectedGroup.visits.map((visit) => (
                <div key={visit.id} className="border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><CalendarDays size={14} /> {formatVisitDate(visit)}</p>
                  <p className="text-xs text-slate-500 mb-2">Статус: {visit.status || '—'}</p>

                  <div className="text-sm text-slate-700 mb-2">
                    <p className="font-semibold">Послуги:</p>
                    <ul className="list-disc pl-5">
                      {(visit.services || []).length === 0 ? <li>Немає</li> : (visit.services || []).map((service, idx) => <li key={`service-${visit.id}-${idx}`}>{service.name || service.service_name || 'Послуга'}</li>)}
                    </ul>
                  </div>

                  <div className="text-sm text-slate-700 mb-3">
                    <p className="font-semibold">Запчастини:</p>
                    <ul className="list-disc pl-5">
                      {(visit.parts || []).length === 0 ? <li>Немає</li> : (visit.parts || []).map((part, idx) => <li key={`part-${visit.id}-${idx}`}>{part.name || part.article || 'Запчастина'}</li>)}
                    </ul>
                  </div>

                  <button type="button" onClick={() => handleRepeatVisit(visit)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg">
                    Повторити візит
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
