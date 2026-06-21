import { useEffect, useState } from 'react';
import { ArrowUpRight, Inbox, Phone, RefreshCw, UsersRound } from 'lucide-react';
import api from '../api/axios';
import './AerialInterface.css';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function LandingLeads() {
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/landing/leads/');
      setData(response.data || { results: [], count: 0 });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Не вдалося завантажити заявки.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return <div className="aerial-leads-page min-h-full bg-slate-50 p-4 sm:p-7">
    <div className="aerial-leads-shell mx-auto max-w-6xl">
      <div className="aerial-leads-header mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="aerial-leads-kicker mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">Sales inbox</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Заявки з landing</h1>
          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500">Контакти людей, які запросили демо VIN-matrix. Відповідай швидко: саме тут найтепліший інтерес.</p>
        </div>
        <button type="button" onClick={load} className="aerial-leads-action inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Оновити</button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="aerial-leads-stat rounded-2xl bg-slate-950 p-5 text-white shadow-lg"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Усього заявок</span><strong className="mt-2 block text-4xl font-black">{data.count || 0}</strong></div>
        <div className="aerial-leads-stat rounded-2xl border border-slate-200 bg-white p-5"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Наступний крок</span><strong className="mt-2 block text-base font-black text-slate-900">Зателефонувати та дати демо</strong></div>
        <div className="aerial-leads-stat rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Порада</span><strong className="mt-2 block text-base font-black text-emerald-950">Відповідь у день заявки</strong></div>
      </div>

      {error && <div className="aerial-leads-error rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      {!loading && !error && data.results?.length === 0 && <div className="aerial-leads-empty rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><Inbox className="mx-auto mb-4 text-slate-300" size={42} /><h2 className="text-lg font-black text-slate-800">Поки заявок немає</h2><p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">Коли людина залишить форму на сторінці /landing, контакт з’явиться тут.</p></div>}
      {data.results?.length > 0 && <div className="aerial-leads-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hidden grid-cols-[1.2fr_1fr_1fr_.8fr_.9fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:grid"><span>Контакт</span><span>Телефон</span><span>Бізнес</span><span>Команда</span><span>Заявка</span></div>{data.results.map((lead) => <article className="grid gap-3 border-b border-slate-100 px-5 py-5 last:border-b-0 md:grid-cols-[1.2fr_1fr_1fr_.8fr_.9fr] md:items-center md:gap-4" key={lead.id}><div><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:hidden">Контакт</span><strong className="block text-base font-black text-slate-900">{lead.name}</strong><span className="text-xs font-semibold text-slate-400">{lead.source || 'landing'}</span></div><div><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:hidden">Телефон</span><a className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-rose-600" href={`tel:${String(lead.phone || '').replace(/[^+\d]/g, '')}`}><Phone size={14} />{lead.phone}</a></div><div><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:hidden">Бізнес</span><span className="inline-flex items-center gap-2 font-bold text-slate-700"><UsersRound size={14} className="text-slate-400" />{lead.business_type}</span></div><div><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:hidden">Команда</span><span className="font-bold text-slate-700">{lead.team_size}</span></div><div><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 md:hidden">Заявка</span><span className="text-xs font-semibold text-slate-500">{formatDate(lead.created_at)}</span></div></article>)}</div>}
      <a className="mt-5 inline-flex items-center gap-2 text-sm font-black text-rose-600 hover:text-rose-700" href="/landing" target="_blank" rel="noreferrer">Відкрити landing <ArrowUpRight size={15} /></a>
    </div>
  </div>;
}