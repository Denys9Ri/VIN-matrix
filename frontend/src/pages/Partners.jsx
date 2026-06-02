import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, BadgeX, Eye, Power, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserCog, Users } from 'lucide-react';
import api from '../api/axios';
import CopyButton from '../components/common/CopyButton';

const statusLabel = {
  pending: 'Очікує оплату',
  trial: 'Пробний період',
  active: 'Активний',
  inactive: 'Неактивний',
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  return data?.details || data?.error || data?.detail || error?.message || 'Невідома помилка';
};

const subscriptionClass = (client) => {
  if (client.subscription_expired || !client.is_access_enabled) return 'bg-rose-50 text-rose-700';
  if (client.subscription_warning) return 'bg-orange-50 text-orange-700';
  return 'bg-emerald-50 text-emerald-700';
};

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [clients, setClients] = useState([]);
  const [alerts, setAlerts] = useState({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPartnerIdByClient, setSelectedPartnerIdByClient] = useState({});
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [partnersRes, clientsRes, alertsRes] = await Promise.allSettled([
      api.get('/api/partners/'),
      api.get('/api/platform-clients/'),
      api.get('/api/platform-clients/subscription-alerts/'),
    ]);

    const errors = [];
    if (partnersRes.status === 'fulfilled') setPartners(Array.isArray(partnersRes.value.data) ? partnersRes.value.data : []);
    else errors.push(`Партнери: ${getErrorMessage(partnersRes.reason)}`);

    if (clientsRes.status === 'fulfilled') setClients(Array.isArray(clientsRes.value.data) ? clientsRes.value.data : []);
    else errors.push(`Клієнти: ${getErrorMessage(clientsRes.reason)}`);

    if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
    else setAlerts({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });

    if (errors.length) setLoadError(errors.join(' | '));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((partner) => [partner.full_name, partner.username, partner.partner_code, partner.email, partner.user_id]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [partners, search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => [client.client_code_display, client.client_code, client.full_name, client.username, client.phone, client.email, client.assigned_to, client.assigned_partner_code, client.user_id]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [clients, search]);

  const totalActiveClients = clients.filter((client) => client.is_access_enabled).length;
  const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);

  const togglePartner = async (partner) => {
    try { await api.patch(`/api/partners/${partner.id}/`, { is_active: !partner.is_active }); await loadData(); }
    catch (error) { alert(`Не вдалося змінити статус партнера: ${getErrorMessage(error)}`); }
  };

  const makePartnerClient = async (partner) => {
    if (!window.confirm(`Перевести партнера ${partner.full_name || partner.username} у звичайні клієнти? Його клієнти перейдуть до адміна.`)) return;
    try { await api.post(`/api/partners/${partner.id}/make-client/`); await loadData(); }
    catch (error) { alert(`Не вдалося перевести партнера у клієнти: ${getErrorMessage(error)}`); }
  };

  const promoteClient = async (client) => {
    if (!window.confirm(`Зробити ${client.full_name || client.username} партнером?`)) return;
    try { await api.post('/api/partners/promote-user/', { user_id: client.user_id }); await loadData(); }
    catch (error) { alert(`Не вдалося зробити партнером: ${getErrorMessage(error)}`); }
  };

  const toggleClientAccess = async (client) => {
    try { await api.patch(`/api/platform-clients/${client.id}/`, { is_access_enabled: !client.is_access_enabled, payment_status: !client.is_access_enabled ? 'active' : 'inactive' }); await loadData(); }
    catch (error) { alert(`Не вдалося змінити доступ: ${getErrorMessage(error)}`); }
  };

  const renewClient = async (client) => {
    if (!window.confirm(`Додати/оновити 30 днів для ${client.full_name || client.username}?`)) return;
    try { await api.post(`/api/platform-clients/${client.id}/renew-30/`); await loadData(); }
    catch (error) { alert(`Не вдалося оновити підписку: ${getErrorMessage(error)}`); }
  };

  const assignClientOwner = async (client, ownerId) => {
    if (!ownerId) return;
    try { await api.patch(`/api/platform-clients/${client.id}/`, { assigned_owner_id: ownerId }); await loadData(); }
    catch (error) { alert(`Не вдалося змінити партнера: ${getErrorMessage(error)}`); }
  };

  const deleteClient = async (client) => {
    if (!window.confirm(`Видалити акаунт ${client.full_name || client.username} повністю з сайту і бази?`)) return;
    try { await api.delete(`/api/platform-clients/${client.id}/`); setClients((prev) => prev.filter((item) => item.id !== client.id)); await loadData(); alert('Акаунт видалено.'); }
    catch (error) { alert(`Не вдалося видалити акаунт: ${getErrorMessage(error)}`); }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800">Акаунти / Партнери</h1>
        <p className="text-slate-500 font-semibold mt-1">Адмін бачить усіх: партнерів, клієнтів, доступи та привʼязку до партнера.</p>
      </div>

      {loadError && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Частину даних не вдалося завантажити: {loadError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Усього клієнтів</p><p className="text-3xl font-black text-slate-900 mt-1">{clients.length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Партнерів</p><p className="text-3xl font-black text-blue-600 mt-1">{partners.length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">Активних клієнтів</p><p className="text-3xl font-black text-emerald-600 mt-1">{totalActiveClients}</p></div>
        <div className="bg-white rounded-2xl border border-orange-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-orange-500">Підписка скоро / вже закінчилась</p><p className="text-3xl font-black text-orange-600 mt-1">{(alerts.expiring_count || 0) + (alerts.expired_count || 0)}</p></div>
      </div>

      {alertList.length > 0 && <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="text-orange-600" size={20} /><h3 className="font-black text-orange-800">Клієнти, у яких скоро закінчиться або вже закінчилась підписка</h3></div><div className="grid md:grid-cols-2 gap-2">{alertList.map((item) => <div key={item.id} className="bg-white/70 rounded-xl px-3 py-2 text-sm font-bold text-slate-700">{item.client_code_display} · {item.full_name} · до {item.subscription_end_display || '—'}</div>)}</div></div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по ПІБ, телефону, логіну, ID, коду або партнеру" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500" /></div></div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6"><div className="p-4 border-b border-slate-100 flex items-center justify-between"><div className="flex items-center gap-2"><ShieldCheck className="text-blue-600" size={20} /><h2 className="font-black text-slate-800 uppercase">Партнери</h2></div><p className="text-xs text-slate-500 font-bold">Тут тільки акаунти зі статусом партнера. Адмін A6000 сюди не входить.</p></div>{loading ? <div className="p-6 text-slate-500 font-semibold">Завантаження...</div> : filteredPartners.length === 0 ? <div className="p-8 text-center text-slate-500 font-semibold"><Users className="mx-auto mb-3 text-slate-300" size={36} />Партнерів немає.</div> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Партнер</th><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнтів</th><th className="text-left px-4 py-3">Активних</th><th className="text-left px-4 py-3">Статус</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredPartners.map((partner) => <tr key={partner.id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-black text-slate-800">{partner.full_name}</p><p className="text-xs text-slate-500">{partner.username} · ID {partner.user_id}</p></td><td className="px-4 py-3"><CopyButton value={partner.partner_code} label={partner.partner_code || '—'} compact /></td><td className="px-4 py-3 font-black text-slate-800">{partner.clients_count}</td><td className="px-4 py-3 font-black text-emerald-600">{partner.active_clients_count}</td><td className="px-4 py-3">{partner.is_active ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16} /> Увімкнено</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><BadgeX size={16} /> Вимкнено</span>}</td><td className="px-4 py-3"><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={() => togglePartner(partner)} className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 font-bold text-blue-700 inline-flex items-center gap-1"><Power size={15} /> {partner.is_active ? 'Вимкнути' : 'Увімкнути'}</button><button onClick={() => makePartnerClient(partner)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 inline-flex items-center gap-1"><UserCog size={15} /> Зробити клієнтом</button></div></td></tr>)}</tbody></table></div>)}</section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100 flex items-center justify-between"><div className="flex items-center gap-2"><UserCheck className="text-emerald-600" size={20} /><h2 className="font-black text-slate-800 uppercase">Всі клієнти</h2></div><p className="text-xs text-slate-500 font-bold">Клієнтів можна активувати, видалити, зробити партнером або перенести до іншого партнера.</p></div>{loading ? <div className="p-6 text-slate-500 font-semibold">Завантаження...</div> : filteredClients.length === 0 ? <div className="p-8 text-center text-slate-500 font-semibold"><Users className="mx-auto mb-3 text-slate-300" size={36} />Клієнтів немає.</div> : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнт</th><th className="text-left px-4 py-3">Телефон</th><th className="text-left px-4 py-3">Підписка</th><th className="text-left px-4 py-3">Прикріплений</th><th className="text-left px-4 py-3">Доступ</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredClients.map((client) => <tr key={client.id} className="hover:bg-slate-50"><td className="px-4 py-3"><CopyButton value={client.client_code_display || `C${client.client_code}`} label={client.client_code_display || `C${client.client_code}`} compact /></td><td className="px-4 py-3"><p className="font-black text-slate-800">{client.full_name || '—'}</p><p className="text-xs text-slate-500">{client.username} · ID {client.user_id}</p>{client.email && <p className="text-xs text-slate-400">{client.email}</p>}</td><td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{client.phone || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg font-bold text-xs ${subscriptionClass(client)}`}>{client.subscription_label || statusLabel[client.payment_status] || client.payment_status || '—'}{client.subscription_end_display ? ` · до ${client.subscription_end_display}` : ''}</span></td><td className="px-4 py-3 min-w-[220px]"><p className="font-bold text-slate-700 mb-2">{client.assigned_partner_code || 'A6000'} · {client.assigned_to || 'Адмін'}</p><select value={selectedPartnerIdByClient[client.id] || client.assigned_owner_id || ''} onChange={(e) => setSelectedPartnerIdByClient({ ...selectedPartnerIdByClient, [client.id]: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs font-bold w-full"><option value="">Обрати партнера</option>{partners.map((partner) => <option key={partner.user_id} value={partner.user_id}>{partner.partner_code} · {partner.full_name || partner.username}</option>)}</select><button onClick={() => assignClientOwner(client, selectedPartnerIdByClient[client.id])} className="mt-2 text-xs font-black text-blue-700 hover:underline">Змінити партнера</button></td><td className="px-4 py-3">{client.is_access_enabled ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16} /> Увімкнено</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><BadgeX size={16} /> Вимкнено</span>}</td><td className="px-4 py-3"><div className="flex flex-wrap items-center justify-end gap-2"><button onClick={() => setSelectedClient(client)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 inline-flex items-center gap-1"><Eye size={15} /> Деталі</button><button onClick={() => renewClient(client)} className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 inline-flex items-center gap-1"><RefreshCw size={15} /> +30 днів</button><button onClick={() => toggleClientAccess(client)} className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 font-bold text-blue-700 inline-flex items-center gap-1"><Power size={15} /> {client.is_access_enabled ? 'Вимкнути' : 'Увімкнути'}</button><button onClick={() => promoteClient(client)} className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 inline-flex items-center gap-1"><ShieldCheck size={15} /> Зробити партнером</button><button onClick={() => deleteClient(client)} className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 font-bold text-rose-700 inline-flex items-center gap-1"><Trash2 size={15} /> Видалити</button></div></td></tr>)}</tbody></table></div>)}</section>

      {selectedClient && <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedClient(null)}><div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="font-black text-xl text-slate-800">Деталі акаунта</h3><button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-slate-700 font-black">×</button></div><div className="space-y-3 text-sm"><p><span className="font-black text-slate-500">Код:</span> {selectedClient.client_code_display || `C${selectedClient.client_code}`}</p><p><span className="font-black text-slate-500">User ID:</span> {selectedClient.user_id}</p><p><span className="font-black text-slate-500">Логін:</span> {selectedClient.username}</p><p><span className="font-black text-slate-500">ПІБ:</span> {selectedClient.full_name || '—'}</p><p><span className="font-black text-slate-500">Телефон:</span> {selectedClient.phone || '—'}</p><p><span className="font-black text-slate-500">Email:</span> {selectedClient.email || '—'}</p><p><span className="font-black text-slate-500">Прикріплений:</span> {selectedClient.assigned_partner_code || 'A6000'} · {selectedClient.assigned_to || 'Адмін'}</p><p><span className="font-black text-slate-500">Підписка:</span> {selectedClient.subscription_label || statusLabel[selectedClient.payment_status] || '—'} {selectedClient.subscription_end_display ? `до ${selectedClient.subscription_end_display}` : ''}</p><p><span className="font-black text-slate-500">Доступ:</span> {selectedClient.is_access_enabled ? 'Увімкнено' : 'Вимкнено'}</p></div></div></div>}
    </div>
  );
};

export default Partners;
