import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Power, RefreshCw, Search, Trash2, Users, BadgeCheck, BadgeX, Copy } from 'lucide-react';
import api from '../api/axios';

const statusLabel = {
  pending: 'Очікує оплату',
  trial: 'Пробний період',
  active: 'Активний',
  inactive: 'Неактивний',
};

const formatClientCode = (client) => client?.client_code_display || (client?.client_code ? `C${client.client_code}` : '—');

const subscriptionClass = (client) => {
  if (client.subscription_expired || !client.is_access_enabled) return 'bg-rose-50 text-rose-700';
  if (client.subscription_warning) return 'bg-orange-50 text-orange-700';
  return 'bg-emerald-50 text-emerald-700';
};

const copyToClipboard = async (value) => {
  if (!value) return;
  try {
    if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(value);
  } catch (error) {
    console.error('Не вдалося скопіювати', error);
  }
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  return data?.details || data?.error || data?.detail || error?.message || 'Невідома помилка';
};

const PartnerClients = () => {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [alerts, setAlerts] = useState({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsRes, statsRes, settingsRes, alertsRes] = await Promise.all([
        api.get('/api/platform-clients/'),
        api.get('/api/platform-clients/stats/'),
        api.get('/api/settings/'),
        api.get('/api/platform-clients/subscription-alerts/'),
      ]);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setStats(statsRes.data || null);
      setSettings(settingsRes.data || null);
      setAlerts(alertsRes.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => [formatClientCode(client), client.client_code, client.full_name, client.username, client.phone, client.email, client.payment_status, client.assigned_to]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [clients, search]);

  const toggleAccess = async (client) => {
    try {
      await api.patch(`/api/platform-clients/${client.id}/`, { is_access_enabled: !client.is_access_enabled });
      await loadData();
    } catch (error) {
      alert(`Не вдалося змінити доступ: ${getErrorMessage(error)}`);
    }
  };

  const renewClient = async (client) => {
    if (!window.confirm(`Додати/оновити 30 днів для ${client.full_name || client.username}?`)) return;
    try {
      await api.post(`/api/platform-clients/${client.id}/renew-30/`);
      await loadData();
    } catch (error) {
      alert(`Не вдалося оновити підписку: ${getErrorMessage(error)}`);
    }
  };

  const deleteClient = async (client) => {
    const ok = window.confirm(`Видалити клієнта ${client.full_name || client.username}?`);
    if (!ok) return;
    try {
      await api.delete(`/api/platform-clients/${client.id}/`);
      await loadData();
    } catch (error) {
      alert(`Не вдалося видалити клієнта: ${getErrorMessage(error)}`);
    }
  };

  const copyCode = async () => {
    await copyToClipboard(settings?.partner_code);
  };

  const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800">Мої підключені клієнти</h1>
          <p className="text-slate-500 font-semibold mt-1">Тут партнер бачить тільки клієнтів, які зареєстровані через його код.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400">Партнерський код</p>
            <p className="text-lg font-black text-blue-700">{settings?.partner_code || '—'}</p>
          </div>
          <button onClick={copyCode} className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100" title="Скопіювати код">
            <Copy size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Усього клієнтів</p><p className="text-3xl font-black text-slate-900 mt-1">{stats?.my_clients ?? clients.length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Активних</p><p className="text-3xl font-black text-emerald-600 mt-1">{stats?.active_clients ?? clients.filter((c) => c.is_access_enabled).length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Неактивних</p><p className="text-3xl font-black text-rose-600 mt-1">{clients.filter((c) => !c.is_access_enabled).length}</p></div>
        <div className="bg-white rounded-2xl border border-orange-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-orange-500">Скоро / закінчилась</p><p className="text-3xl font-black text-orange-600 mt-1">{(alerts.expiring_count || 0) + (alerts.expired_count || 0)}</p></div>
      </div>

      {alertList.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="text-orange-600" size={20} /><h3 className="font-black text-orange-800">Підписка скоро закінчиться або вже закінчилась</h3></div>
          <div className="grid md:grid-cols-2 gap-2">
            {alertList.map((item) => <div key={item.id} className="bg-white/70 rounded-xl px-3 py-2 text-sm font-bold text-slate-700">{item.client_code_display} · {item.full_name} · до {item.subscription_end_display || '—'}</div>)}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по коду, ПІБ, телефону або логіну" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500" /></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <div className="p-6 text-slate-500 font-semibold">Завантаження...</div> : filteredClients.length === 0 ? <div className="p-8 text-center text-slate-500 font-semibold"><Users className="mx-auto mb-3 text-slate-300" size={36} />Клієнтів ще немає.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнт</th><th className="text-left px-4 py-3">Телефон</th><th className="text-left px-4 py-3">Логін</th><th className="text-left px-4 py-3">Підписка</th><th className="text-left px-4 py-3">Доступ</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredClients.map((client) => { const code = formatClientCode(client); return <tr key={client.id} className="hover:bg-slate-50"><td className="px-4 py-3"><button onClick={() => copyToClipboard(code)} className="font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg inline-flex items-center gap-1">{code} <Copy size={13} /></button></td><td className="px-4 py-3"><p className="font-bold text-slate-800">{client.full_name || '—'}</p>{client.email && <p className="text-xs text-slate-400">{client.email}</p>}</td><td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{client.phone || '—'}</td><td className="px-4 py-3 text-slate-600">{client.username || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg font-bold text-xs ${subscriptionClass(client)}`}>{client.subscription_label || statusLabel[client.payment_status] || client.payment_status || '—'}{client.subscription_end_display ? ` · до ${client.subscription_end_display}` : ''}</span></td><td className="px-4 py-3">{client.is_access_enabled ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16} /> Увімкнено</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><BadgeX size={16} /> Вимкнено</span>}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-2"><button onClick={() => renewClient(client)} className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 inline-flex items-center gap-1"><RefreshCw size={15} /> +30 днів</button><button onClick={() => toggleAccess(client)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 inline-flex items-center gap-1"><Power size={15} /> {client.is_access_enabled ? 'Вимкнути' : 'Увімкнути'}</button><button onClick={() => deleteClient(client)} className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 font-bold text-rose-700 inline-flex items-center gap-1"><Trash2 size={15} /> Видалити</button></div></td></tr>; })}</tbody></table></div>
        )}
      </div>
    </div>
  );
};

export default PartnerClients;