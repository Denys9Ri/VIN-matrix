import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, UserCheck, Clock3 } from 'lucide-react';
import api from '../api/axios';

const STATUS_OPTIONS = [
  { label: 'Всі', value: 'all' },
  { label: 'Оплачено', value: 'active' },
  { label: 'Не оплачено', value: 'not_paid' },
];

const PlatformClientsAdmin = () => {
  const [clients, setClients] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [representativeFilter, setRepresentativeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('clients');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientsRes, repsRes] = await Promise.all([
        api.get('/api/platform-clients/'),
        api.get('/api/platform-clients/stats/'),
      ]);
      setClients(clientsRes.data || []);
      setRepresentatives(Array.isArray(repsRes.data) ? repsRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const normalize = (s) => String(s || '').toLowerCase();

  const filteredClients = useMemo(() => clients.filter((client) => {
    const fullName = client.full_name || client.username || '';
    const matchesSearch = normalize(fullName).includes(normalize(search))
      || normalize(client.username).includes(normalize(search));

    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'active'
        ? client.payment_status === 'active'
        : client.payment_status !== 'active';

    const matchesRep = representativeFilter === 'all' || client.assigned_to === representativeFilter;

    return matchesSearch && matchesStatus && matchesRep;
  }), [clients, search, statusFilter, representativeFilter]);

  const kpi = useMemo(() => ({
    total: clients.length,
    pending: clients.filter((c) => c.payment_status === 'pending').length,
    activeReps: representatives.length,
  }), [clients, representatives]);

  const togglePaid = async (client) => {
    const isCurrentlyActive = client.payment_status === 'active';
    const payload = {
      payment_status: isCurrentlyActive ? 'pending' : 'active',
      is_access_enabled: !isCurrentlyActive,
    };

    const res = await api.patch(`/api/platform-clients/${client.id}/`, payload);
    setClients((prev) => prev.map((item) => (item.id === client.id ? res.data : item)));
  };

  const openRepresentativeClients = (name) => {
    setActiveTab('clients');
    setRepresentativeFilter(name);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 md:pl-72 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800 mb-6">Адмін-панель клієнтів</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative">
          <Users className="absolute top-4 right-4 text-blue-400" size={18} />
          <p className="text-xs text-slate-500 font-bold uppercase">Всього клієнтів</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{kpi.total}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative">
          <Clock3 className="absolute top-4 right-4 text-amber-400" size={18} />
          <p className="text-xs text-slate-500 font-bold uppercase">Очікують оплату</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{kpi.pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative">
          <UserCheck className="absolute top-4 right-4 text-emerald-400" size={18} />
          <p className="text-xs text-slate-500 font-bold uppercase">Активні представники</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{kpi.activeReps}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <button className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'clients' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`} onClick={() => setActiveTab('clients')}>Клієнти</button>
        <button className={`px-4 py-2 rounded-xl font-bold text-sm ${activeTab === 'representatives' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`} onClick={() => setActiveTab('representatives')}>Представники</button>
      </div>

      {activeTab === 'clients' && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук (ПІБ, телефон)" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm text-slate-700 outline-none">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={representativeFilter} onChange={(e) => setRepresentativeFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm text-slate-700 outline-none">
              <option value="all">Вибір представника</option>
              {representatives.map((rep) => <option key={rep.representative} value={rep.representative}>{rep.representative}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="p-4 text-left">Код</th><th className="p-4 text-left">Клієнт</th><th className="p-4 text-left">Представник</th><th className="p-4 text-left">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700">#CLI-{client.client_code}</td>
                    <td className="p-4"><div className="font-bold text-slate-900">{client.full_name || client.username}</div><div className="text-xs text-slate-500">{client.username}</div></td>
                    <td className="p-4"><span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{client.assigned_to} (Представник)</span></td>
                    <td className="p-4"><button onClick={() => togglePaid(client)} className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${client.payment_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{client.payment_status === 'active' ? 'Доступ надано' : 'Немає оплати'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'representatives' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr><th className="p-4 text-left">Ім'я представника</th><th className="p-4 text-left">Дата реєстрації</th><th className="p-4 text-left">Підписані клієнти</th><th className="p-4 text-left">Дії</th></tr>
            </thead>
            <tbody>
              {representatives.map((rep) => (
                <tr key={rep.representative} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-900">{rep.representative}</td>
                  <td className="p-4 text-slate-600">{rep.registered_at ? new Date(rep.registered_at).toLocaleDateString('uk-UA') : '—'}</td>
                  <td className="p-4 font-bold text-slate-700">{rep.clients_count}</td>
                  <td className="p-4"><button onClick={() => openRepresentativeClients(rep.representative)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold">Переглянути клієнтів</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && <p className="mt-4 text-sm text-slate-500 font-semibold">Завантаження...</p>}
    </div>
  );
};

export default PlatformClientsAdmin;
