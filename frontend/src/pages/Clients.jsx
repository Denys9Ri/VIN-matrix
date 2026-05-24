import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Users,
  UserCheck,
  UserX,
  Trash2,
  ShieldCheck,
  Briefcase,
  Wallet,
  Loader2,
} from 'lucide-react';

const ROLE_META = {
  admin: {
    label: 'Адміністратор',
    icon: ShieldCheck,
    headerClassName: 'bg-slate-900 text-white',
  },
  partner: {
    label: 'Партнер',
    icon: Briefcase,
    headerClassName: 'bg-blue-700 text-white',
  },
};

const defaultStats = {
  totalClients: 0,
  debtors: 0,
  revenue: 0,
};

const formatMoney = (value) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const Clients = () => {
  const [registrars, setRegistrars] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const [actionClientId, setActionClientId] = useState(null);

  const loadRegistrars = useCallback(async () => {
    setLoading(true);
    try {
      const [registrarsResponse, statsResponse] = await Promise.all([
        axios.get('/api/crm/registrars/'),
        axios.get('/api/crm/kpi/'),
      ]);

      setRegistrars(Array.isArray(registrarsResponse.data) ? registrarsResponse.data : []);
      setStats({
        totalClients: statsResponse.data?.total_clients ?? 0,
        debtors: statsResponse.data?.debtors ?? 0,
        revenue: statsResponse.data?.revenue ?? 0,
      });
    } catch (error) {
      alert('Не вдалося завантажити дані CRM.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrars();
  }, [loadRegistrars]);

  const toggleAccess = async (clientId, isPaid) => {
    setActionClientId(clientId);
    try {
      await axios.patch(`/api/clients/${clientId}/`, { is_paid: !isPaid });
      setRegistrars((prev) =>
        prev.map((registrar) => ({
          ...registrar,
          clients: (registrar.clients || []).map((client) =>
            client.id === clientId ? { ...client, is_paid: !isPaid } : client
          ),
        }))
      );
      setStats((prev) => ({
        ...prev,
        debtors: isPaid ? prev.debtors + 1 : Math.max(0, prev.debtors - 1),
      }));
    } catch (error) {
      alert('Помилка при оновленні доступу.');
    } finally {
      setActionClientId(null);
    }
  };

  const deleteAccount = async (clientId) => {
    const isConfirmed = window.confirm('Ви впевнені, що хочете видалити акаунт клієнта?');
    if (!isConfirmed) {
      return;
    }

    setActionClientId(clientId);
    try {
      await axios.delete(`/api/clients/${clientId}/`);

      setRegistrars((prev) =>
        prev.map((registrar) => ({
          ...registrar,
          clients: (registrar.clients || []).filter((client) => client.id !== clientId),
        }))
      );

      const deletedClient = registrars
        .flatMap((registrar) => registrar.clients || [])
        .find((client) => client.id === clientId);

      setStats((prev) => ({
        totalClients: Math.max(0, prev.totalClients - 1),
        debtors: deletedClient && !deletedClient.is_paid ? Math.max(0, prev.debtors - 1) : prev.debtors,
        revenue: prev.revenue,
      }));
    } catch (error) {
      alert('Помилка при видаленні акаунту.');
    } finally {
      setActionClientId(null);
    }
  };

  const fullRegistrars = useMemo(() => {
    const expectedOrder = [
      { role: 'admin', fallbackName: 'Головний адміністратор' },
      { role: 'partner', fallbackName: 'Партнер №1' },
      { role: 'partner', fallbackName: 'Партнер №2' },
    ];

    const normalized = [...registrars];
    while (normalized.length < 3) {
      const expected = expectedOrder[normalized.length];
      normalized.push({
        id: `virtual-${normalized.length}`,
        name: expected.fallbackName,
        role: expected.role,
        clients: [],
      });
    }

    return normalized;
  }, [registrars]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="mb-8 md:mb-10">
        <h1 className="text-2xl md:text-3xl font-black">CRM: Управління клієнтами</h1>
        <p className="text-slate-500 font-semibold mt-1">Контроль доступу, оплат та структури реєстраторів.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-wider">Всього клієнтів</p>
              <h3 className="text-3xl font-black mt-1">{stats.totalClients}</h3>
            </div>
            <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl"><Users size={22} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-wider">Боржники</p>
              <h3 className="text-3xl font-black mt-1">{stats.debtors}</h3>
            </div>
            <div className="bg-red-100 text-red-600 p-3 rounded-2xl"><UserX size={22} /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-wider">Прибуток</p>
              <h3 className="text-3xl font-black mt-1">{formatMoney(stats.revenue)}</h3>
            </div>
            <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl"><Wallet size={22} /></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-3 text-slate-500 font-bold">
          <Loader2 size={18} className="animate-spin" /> Завантаження даних CRM...
        </div>
      ) : (
        <div className="space-y-8">
          {fullRegistrars.map((registrar) => {
            const roleMeta = ROLE_META[registrar.role] || ROLE_META.partner;
            const RegistrarIcon = roleMeta.icon;
            const clients = registrar.clients || [];

            return (
              <section key={registrar.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className={`p-4 flex items-center gap-3 ${roleMeta.headerClassName}`}>
                  <RegistrarIcon size={18} />
                  <h2 className="font-extrabold text-lg">{registrar.name || roleMeta.label}</h2>
                  <span className="ml-auto bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                    {clients.length} зареєстровано
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase font-black">
                      <tr>
                        <th className="px-6 py-4">Код клієнта</th>
                        <th className="px-6 py-4">ПІБ клієнта</th>
                        <th className="px-6 py-4">Статус оплати</th>
                        <th className="px-6 py-4 text-right">Дії</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-semibold">
                            Немає клієнтів у цього реєстратора.
                          </td>
                        </tr>
                      ) : (
                        clients.map((client) => {
                          const processing = actionClientId === client.id;
                          return (
                            <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-black text-blue-600 uppercase tracking-tight">{client.client_code || 'CLI-000'}</td>
                              <td className="px-6 py-4 font-bold text-slate-700">{client.full_name || 'Без імені'}</td>
                              <td className="px-6 py-4">
                                <button
                                  type="button"
                                  disabled={processing}
                                  onClick={() => toggleAccess(client.id, client.is_paid)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
                                    client.is_paid
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                                  }`}
                                >
                                  {client.is_paid ? <UserCheck size={14} /> : <UserX size={14} />}
                                  {client.is_paid ? 'Доступ надано' : 'Немає оплати'}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  disabled={processing}
                                  onClick={() => deleteAccount(client.id)}
                                  className="inline-flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                  aria-label="Видалити акаунт"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Clients;
