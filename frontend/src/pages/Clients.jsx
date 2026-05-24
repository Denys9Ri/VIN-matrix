import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, Phone, CarFront, User, CalendarDays, Wrench } from 'lucide-react';

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

const Clients = () => {
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/visits/?history=true');
        setVisits(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        alert('Не вдалося завантажити історію візитів.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, []);

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
              <section key={group.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <p className="font-black text-slate-800 flex items-center gap-2"><User size={14} /> {group.client}</p>
                    <p className="font-semibold text-slate-600 flex items-center gap-2"><Phone size={14} /> {group.phone}</p>
                    <p className="font-semibold text-slate-600 flex items-center gap-2 uppercase"><CarFront size={14} /> {group.plate}</p>
                    <p className="font-semibold text-slate-600">Авто: {group.car}</p>
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
    </div>
  );
};

export default Clients;
