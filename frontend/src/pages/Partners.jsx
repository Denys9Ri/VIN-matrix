import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Copy, Plus, RefreshCcw, Search, UserPlus, Users } from 'lucide-react';
import api from '../api/axios';

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', company_name: '' });
  const [promoteUserId, setPromoteUserId] = useState('');

  const loadPartners = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/partners/');
      setPartners(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((partner) =>
      [partner.full_name, partner.username, partner.partner_code, partner.email]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(q))
    );
  }, [partners, search]);

  const createPartner = async (e) => {
    e.preventDefault();
    await api.post('/api/partners/', form);
    setForm({ username: '', password: '', full_name: '', email: '', company_name: '' });
    await loadPartners();
  };

  const promoteUser = async (e) => {
    e.preventDefault();
    if (!promoteUserId) return;
    await api.post('/api/partners/promote-user/', { user_id: promoteUserId });
    setPromoteUserId('');
    await loadPartners();
  };

  const regenerateCode = async (partner) => {
    await api.patch(`/api/partners/${partner.id}/`, { regenerate_code: true });
    await loadPartners();
  };

  const togglePartner = async (partner) => {
    await api.patch(`/api/partners/${partner.id}/`, { is_active: !partner.is_active });
    await loadPartners();
  };

  const copyCode = async (code) => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800">Партнери / Підписки</h1>
          <p className="text-slate-500 font-semibold mt-1">Керування партнерами, кодами та кількістю підключених клієнтів.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <form onSubmit={createPartner} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="text-blue-600" size={20} />
            <h2 className="font-black text-slate-800">Створити партнера</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border rounded-xl px-3 py-2 font-semibold" placeholder="Логін" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <input className="border rounded-xl px-3 py-2 font-semibold" placeholder="Пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <input className="border rounded-xl px-3 py-2 font-semibold" placeholder="ПІБ" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="border rounded-xl px-3 py-2 font-semibold" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="border rounded-xl px-3 py-2 font-semibold md:col-span-2" placeholder="Назва CRM/СТО партнера" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2 rounded-xl">Створити</button>
        </form>

        <form onSubmit={promoteUser} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="text-emerald-600" size={20} />
            <h2 className="font-black text-slate-800">Зробити існуючого користувача партнером</h2>
          </div>
          <p className="text-sm text-slate-500 font-semibold mb-3">Введи ID користувача. Йому створиться партнерський код і власний CRM-простір, якщо його ще немає.</p>
          <input className="border rounded-xl px-3 py-2 font-semibold w-full" placeholder="User ID" value={promoteUserId} onChange={(e) => setPromoteUserId(e.target.value)} />
          <button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl">Зробити партнером</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук партнера по ПІБ, логіну або коду"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500 font-semibold">Завантаження...</div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-semibold">
            <Users className="mx-auto mb-3 text-slate-300" size={36} />
            Партнерів ще немає.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black">
                <tr>
                  <th className="text-left px-4 py-3">Партнер</th>
                  <th className="text-left px-4 py-3">Код</th>
                  <th className="text-left px-4 py-3">Клієнтів</th>
                  <th className="text-left px-4 py-3">Активних</th>
                  <th className="text-left px-4 py-3">Статус</th>
                  <th className="text-right px-4 py-3">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-800">{partner.full_name}</p>
                      <p className="text-xs text-slate-500">{partner.username} · ID {partner.user_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => copyCode(partner.partner_code)} className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-black">
                        {partner.partner_code || '—'} <Copy size={14} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-black text-slate-800">{partner.clients_count}</td>
                    <td className="px-4 py-3 font-black text-emerald-600">{partner.active_clients_count}</td>
                    <td className="px-4 py-3">
                      {partner.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16} /> Увімкнено</span>
                      ) : (
                        <span className="text-rose-700 font-bold">Вимкнено</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => regenerateCode(partner)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 inline-flex items-center gap-1">
                          <RefreshCcw size={15} /> Новий код
                        </button>
                        <button onClick={() => togglePartner(partner)} className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 font-bold text-blue-700">
                          {partner.is_active ? 'Вимкнути' : 'Увімкнути'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Partners;
