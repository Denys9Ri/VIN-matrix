import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Car, CheckCircle2, ClipboardList, Copy, CreditCard, Edit3, History, MessageCircle, Package, Phone, PlusCircle, RefreshCcw, Repeat2, Search, Star, TrendingUp, UserCheck, UserRound, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const arr = (value) => (Array.isArray(value) ? value : []);
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};
const isoPlusDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const pipelineOptions = [
  { key: 'new', label: 'Новий' },
  { key: 'active', label: 'Активний' },
  { key: 'regular', label: 'Постійний' },
  { key: 'vip', label: 'VIP' },
  { key: 'sleeping', label: 'Сплячий' },
  { key: 'problem', label: 'Проблемний' },
  { key: 'debt', label: 'З боргом', locked: true },
];
const pipelineLabelByKey = Object.fromEntries(pipelineOptions.map((item) => [item.key, item.label]));
const statusTone = {
  'Новий': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Активний': 'bg-blue-50 text-blue-700 border-blue-100',
  'Постійний': 'bg-cyan-50 text-cyan-700 border-cyan-100',
  VIP: 'bg-violet-50 text-violet-700 border-violet-100',
  'Сплячий': 'bg-slate-100 text-slate-700 border-slate-200',
  'Проблемний': 'bg-amber-50 text-amber-700 border-amber-100',
  'З боргом': 'bg-rose-50 text-rose-700 border-rose-100',
  Борг: 'bg-rose-50 text-rose-700 border-rose-100',
};

const copyText = async (value, onDone, success = 'Скопійовано.') => {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    if (window.isSecureContext && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      onDone?.(success);
      return true;
    }
  } catch {}
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (ok) onDone?.(success);
    return ok;
  } catch {
    return false;
  }
};

const firstCar = (client) => arr(client?.cars)[0] || {};
const clientPayload = (client) => ({
  client: client?.client || '',
  phone: client?.phone || '',
  plate: firstCar(client).plate || '',
  vin_code: firstCar(client).vin_code || '',
});
const clientMessage = (client) => {
  const repeat = arr(client?.repeat_opportunities).find((item) => item.type === 'repeat_part');
  if (repeat?.part) return `Добрий день, ${client?.client || ''}. Нагадуємо про товар з вашої історії: ${repeat.part.brand || ''} ${repeat.part.article || ''} ${repeat.part.name || ''}. Можемо повторити замовлення або підібрати актуальну пропозицію.`;
  if (Number(client?.debt_amount || 0) > 0) return `Добрий день, ${client?.client || ''}. Нагадуємо про неоплачену суму ${money(client.debt_amount)}.`;
  return `Добрий день, ${client?.client || ''}. Давно не бачили вас у нас. Можемо нагадати про сервіс або підібрати актуальну пропозицію.`;
};
const isDebtOrder = (order) => Number(order?.debt_amount || 0) > 0 || ['unpaid', 'debt', 'cod', 'prepaid'].includes(String(order?.payment_status || '').toLowerCase());

export default function ClientsCRMStage5() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [pipelineSummary, setPipelineSummary] = useState({});
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (query = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/store-clients/${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      const results = arr(res.data?.results);
      setClients(results);
      setPipelineSummary(res.data?.pipeline || {});
      return results;
    } catch {
      setNotice('Не вдалося завантажити CRM-клієнтів.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const openClient = async (client, opts = {}) => {
    if (!client?.key) return;
    setSelected(client);
    setTab(opts.tab || 'overview');
    try {
      const res = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      setSelected(res.data);
      if (opts.tab) setTab(opts.tab);
    } catch {
      setNotice('Не вдалося відкрити картку клієнта.');
    }
  };

  const refreshSelected = async (client = selected) => {
    if (!client?.key) return null;
    try {
      const res = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      setSelected(res.data);
      return res.data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('search') || params.get('q') || '';
    const shouldOpen = params.get('autopen') === '1';
    setSearch(query);
    (async () => {
      const results = await load(query);
      if (shouldOpen && results.length) await openClient(results[0]);
    })();
  }, [location.search]);

  useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = setTimeout(() => setCopyNotice(''), 1800);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  const showNotice = (text) => {
    setNotice(text);
    setCopyNotice(text);
  };

  const filteredClients = useMemo(() => {
    if (pipelineFilter === 'all') return clients;
    return clients.filter((client) => (client.pipeline?.key || '') === pipelineFilter);
  }, [clients, pipelineFilter]);

  const totals = useMemo(() => clients.reduce((acc, client) => {
    acc.count += 1;
    acc.orders += Number(client.orders_count || 0);
    acc.revenue += Number(client.total_revenue || 0);
    acc.profit += Number(client.total_profit || 0);
    acc.debt += Number(client.debt_amount || 0);
    acc.opportunities += Number(client.repeat_opportunities_count || 0);
    return acc;
  }, { count: 0, orders: 0, revenue: 0, profit: 0, debt: 0, opportunities: 0 }), [clients]);

  const createRepeatOrder = async (client = selected) => {
    if (!client) return;
    setBusy('order');
    try {
      const res = await api.post('/api/store-clients/repeat-sale/', { key: client.key, ...clientPayload(client), create_empty: true });
      showNotice(res.data?.message || 'Повторне замовлення створено.');
      navigate(`/visits?visit_id=${res.data?.visit_id || ''}`);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося створити повторне замовлення.');
    } finally {
      setBusy('');
    }
  };

  const repeatPart = async (part, client = selected) => {
    if (!client) return;
    setBusy(`repeat:${part.order_id}-${part.id}`);
    try {
      const res = await api.post('/api/store-clients/repeat-sale/', { key: client.key, ...clientPayload(client), part });
      showNotice(res.data?.message || 'Товар додано в повторне замовлення.');
      navigate(`/visits?visit_id=${res.data?.visit_id || ''}`);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося повторити продаж.');
    } finally {
      setBusy('');
    }
  };

  const createTask = async (client = selected, title = 'Звʼязатися з клієнтом') => {
    if (!client) return;
    setBusy('task');
    try {
      await api.post('/api/crm-tasks/', { ...clientPayload(client), title, description: 'Створено з CRM-картки клієнта.', due_date: isoPlusDays(1), status: 'new' });
      showNotice('CRM-задачу створено на завтра.');
      await refreshSelected(client);
      await load(search);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося створити задачу.');
    } finally {
      setBusy('');
    }
  };

  const createReminder = async (client = selected) => {
    if (!client) return;
    setBusy('reminder');
    try {
      await api.post('/api/crm-service-reminders/', { ...clientPayload(client), reminder_type: 'maintenance', title: 'Повторний контакт / сервіс', due_date: isoPlusDays(30), note: 'Створено з CRM для повторного продажу.', status: 'active' });
      showNotice('Нагадування створено на 30 днів.');
      await refreshSelected(client);
      await load(search);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося створити нагадування.');
    } finally {
      setBusy('');
    }
  };

  const logCall = async (client = selected) => {
    if (!client) return;
    setBusy('call');
    try {
      await api.post('/api/crm-communications/', { ...clientPayload(client), status: 'called', comment: 'Дзвінок зафіксовано з CRM.' });
      await copyText(client.phone, showNotice, 'Телефон скопійовано для дзвінка.');
      await refreshSelected(client);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося записати дзвінок.');
    } finally {
      setBusy('');
    }
  };

  const writeClient = async (client = selected) => {
    if (!client) return;
    await copyText(clientMessage(client), showNotice, 'Текст для клієнта скопійовано.');
    try {
      await api.post('/api/crm-communications/', { ...clientPayload(client), status: 'thinking', comment: 'Підготовлено повідомлення клієнту.' });
      await refreshSelected(client);
    } catch {}
  };

  const setClientStatus = async (client = selected, status = 'active') => {
    if (!client || status === 'debt') return;
    setBusy(`status:${status}`);
    try {
      await api.post('/api/crm-client-statuses/', { ...clientPayload(client), status, note: `Статус встановлено вручну: ${pipelineLabelByKey[status] || status}` });
      showNotice(`Статус клієнта: ${pipelineLabelByKey[status] || status}.`);
      await load(search);
      await refreshSelected(client);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося змінити статус.');
    } finally {
      setBusy('');
    }
  };

  const closeDebt = async (client = selected) => {
    if (!client) return;
    const orders = arr(client.orders).filter(isDebtOrder);
    if (!orders.length) return showNotice('Боргів по цьому клієнту немає.');
    setBusy('debt');
    try {
      await Promise.all(orders.map((order) => api.patch(`/api/visits/${order.id}/`, { payment_status: 'paid', prepayment_amount: Number(order.revenue || order.total_revenue || 0) })));
      showNotice(`Борг закрито. Оновлено замовлень: ${orders.length}.`);
      await load(search);
      await refreshSelected(client);
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося закрити борг.');
    } finally {
      setBusy('');
    }
  };

  const quickAction = (action, client = selected) => {
    if (action === 'call') return logCall(client);
    if (action === 'message') return writeClient(client);
    if (action === 'task') return createTask(client);
    if (action === 'order') return createRepeatOrder(client);
    if (action === 'reminder') return createReminder(client);
    if (action === 'priority') return createTask(client, 'Пріоритетний контакт з клієнтом');
    return null;
  };

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/40 px-3 md:px-6 2xl:px-8 py-4 md:py-6 overflow-x-hidden">
      <div className="max-w-[1780px] mx-auto space-y-5">
        <Hero totals={totals} onRefresh={() => load(search)} />
        {notice && <MessageBox message={notice} onClose={() => setNotice('')} />}
        <SearchBar value={search} setValue={setSearch} onSubmit={submitSearch} />
        <PipelineFilters active={pipelineFilter} setActive={setPipelineFilter} summary={pipelineSummary} total={clients.length} />
        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)] gap-5 items-start">
          <ClientList loading={loading} clients={filteredClients} selected={selected} onOpen={openClient} onCloseDebt={closeDebt} busy={busy} />
          <section className="hidden xl:block min-w-0 w-full">
            {selected ? <ClientProfile client={selected} tab={tab} setTab={setTab} busy={busy} onCloseDebt={closeDebt} onQuickAction={quickAction} onSetStatus={setClientStatus} onRepeatPart={repeatPart} onCopy={(v, m) => copyText(v, showNotice, m)} /> : <EmptyProfile />}
          </section>
        </div>
      </div>
      {selected && <div className="xl:hidden fixed inset-0 z-[80] bg-slate-900/65 backdrop-blur-sm overflow-y-auto overscroll-contain"><div className="bg-white w-full min-h-[100dvh]"><ClientProfile client={selected} tab={tab} setTab={setTab} busy={busy} onClose={() => setSelected(null)} onCloseDebt={closeDebt} onQuickAction={quickAction} onSetStatus={setClientStatus} onRepeatPart={repeatPart} onCopy={(v, m) => copyText(v, showNotice, m)} /></div></div>}
      {copyNotice && <CopyNotice message={copyNotice} />}
    </div>
  );
}

function Hero({ totals, onRefresh }) {
  return <header className="relative overflow-hidden rounded-[34px] bg-slate-950 text-white shadow-2xl shadow-slate-200 border border-slate-900"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_35%)]" /><div className="relative p-5 md:p-7 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-5 items-end"><div><div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-100"><UserRound size={15} /> CRM повторних продажів</div><h1 className="mt-4 text-3xl md:text-5xl font-black uppercase italic leading-tight tracking-tight">Клієнти</h1><p className="mt-3 text-sm md:text-base font-bold text-slate-300 max-w-3xl">Картка клієнта, pipeline, борги, прибуток, історія, повторні продажі, задачі й нагадування в одному робочому екрані.</p></div><button type="button" onClick={onRefresh} className="w-full xl:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-950 px-5 py-3 text-xs font-black uppercase shadow-lg hover:bg-slate-100 transition"><RefreshCcw size={16} /> Оновити CRM</button></div><div className="relative grid grid-cols-2 md:grid-cols-5 border-t border-white/10 bg-white/5"><HeroMetric label="Покупців" value={totals.count} /><HeroMetric label="Замовлень" value={totals.orders} /><HeroMetric label="Виручка" value={money(totals.revenue)} /><HeroMetric label="Прибуток" value={money(totals.profit)} good /><HeroMetric label="Борги" value={money(totals.debt)} danger={totals.debt > 0} /></div></header>;
}

function SearchBar({ value, setValue, onSubmit }) {
  return <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-[30px] p-3 md:p-4 shadow-sm flex flex-col md:flex-row gap-3"><div className="relative flex-1 min-w-0"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Пошук: № замовлення, телефон, ПІБ, авто, VIN, артикул або товар..." className="w-full min-h-[52px] bg-slate-50 border-2 border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm md:text-base font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition placeholder:text-slate-400 placeholder:font-bold" /></div><button className="min-h-[52px] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-7 py-3 text-xs font-black uppercase shadow-lg shadow-blue-100 transition">Знайти</button></form>;
}

function PipelineFilters({ active, setActive, summary, total }) {
  const items = [{ key: 'all', label: 'Усі', count: total }, ...pipelineOptions.map((item) => ({ ...item, count: summary?.[item.key] || 0 }))];
  return <div className="bg-white border border-slate-200 rounded-[28px] p-3 shadow-sm overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex gap-2 min-w-max">{items.map((item) => <button key={item.key} type="button" onClick={() => setActive(item.key)} className={`rounded-2xl px-4 py-3 text-[11px] font-black uppercase border transition inline-flex items-center gap-2 ${active === item.key ? 'bg-slate-950 text-white border-slate-950 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-blue-700 hover:border-blue-200'}`}>{item.label}<span className={`rounded-lg px-2 py-0.5 ${active === item.key ? 'bg-white/15 text-white' : 'bg-white text-slate-400'}`}>{item.count || 0}</span></button>)}</div></div>;
}

function ClientList({ loading, clients, selected, onOpen, onCloseDebt, busy }) {
  return <section className="bg-white border border-slate-200 rounded-[30px] p-3 md:p-4 shadow-sm h-fit xl:sticky xl:top-6"><div className="flex items-center justify-between gap-3 mb-3 px-1"><div><h2 className="font-black uppercase text-slate-900">Список покупців</h2><p className="text-xs font-bold text-slate-400 mt-1">Натисніть, щоб відкрити картку</p></div><span className="text-[11px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{clients.length}</span></div><div className="space-y-3 max-h-none xl:max-h-[calc(100vh-290px)] overflow-y-auto pr-1">{loading ? <Empty text="Завантаження клієнтів..." /> : clients.map((client) => <ClientCard key={client.key} client={client} active={selected?.key === client.key} onClick={() => onOpen(client)} onCloseDebt={onCloseDebt} busy={busy} />)}{!loading && !clients.length && <Empty text="Клієнтів не знайдено" />}</div></section>;
}

function ClientCard({ client, active, onClick, onCloseDebt, busy }) {
  const debt = Number(client.debt_amount || 0) > 0;
  return <button type="button" onClick={onClick} className={`w-full text-left rounded-[24px] p-4 border transition relative overflow-hidden ${active ? 'bg-blue-50 border-blue-200 shadow-lg shadow-blue-100/70' : 'bg-slate-50 border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-md'}`}><div className={`absolute left-0 top-0 bottom-0 w-1.5 ${debt ? 'bg-rose-400' : active ? 'bg-blue-500' : 'bg-emerald-400'}`} /><div className="pl-1 space-y-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="font-black text-slate-900 leading-tight truncate">{client.client || 'Без імені'}</p><p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1 min-w-0"><Phone size={12} className="shrink-0" /> <span className="truncate">{client.phone || 'Телефон не вказаний'}</span></p></div><Badge status={client.status} /></div><div className="grid grid-cols-3 gap-2"><Mini label="Зам." value={client.orders_count || 0} /><Mini label="Сума" value={money(client.total_revenue)} /><Mini label="Борг" value={money(client.debt_amount)} bad={debt} /></div><div className="grid grid-cols-3 gap-2"><Mini label="Продажі" value={client.repeat_opportunities_count || 0} good={client.repeat_opportunities_count > 0} /><Mini label="Задачі" value={client.active_tasks_count || 0} /><Mini label="Нагад." value={client.active_reminders_count || 0} /></div><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-slate-400">Останнє: {fmtDate(client.last_order_date)}</p>{debt && <span onClick={(event) => { event.stopPropagation(); onCloseDebt?.(client); }} className="bg-emerald-600 text-white rounded-xl px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1 shadow-sm"><CreditCard size={13} /> {busy === 'debt' ? '...' : 'Закрити'}</span>}</div></div></button>;
}

function ClientProfile({ client, tab, setTab, busy, onClose, onCloseDebt, onQuickAction, onSetStatus, onRepeatPart, onCopy }) {
  const orders = arr(client.orders);
  const parts = arr(client.parts);
  const cars = arr(client.cars);
  const debts = orders.filter(isDebtOrder);
  return <div className={`bg-white ${onClose ? 'min-h-[100dvh]' : 'xl:border xl:border-slate-200 xl:rounded-[34px] xl:shadow-sm'} overflow-visible flex flex-col`}><ProfileHeader client={client} busy={busy} onClose={onClose} onCloseDebt={onCloseDebt} onQuickAction={onQuickAction} /><Tabs active={tab} setActive={setTab} /><div className="p-4 md:p-5 bg-slate-50/60 overflow-visible flex-1">{tab === 'overview' && <Overview client={client} orders={orders} parts={parts} cars={cars} debts={debts} onQuickAction={onQuickAction} onRepeatPart={onRepeatPart} onCopy={onCopy} />}{tab === 'sales' && <SalesTab client={client} onQuickAction={onQuickAction} onRepeatPart={onRepeatPart} busy={busy} />}{tab === 'history' && <HistoryTab orders={orders} onRepeatPart={(part) => onRepeatPart(part, client)} busy={busy} />}{tab === 'cars' && <Cars cars={cars} onCopy={onCopy} />}{tab === 'debts' && <Debts debts={debts} onCloseDebt={() => onCloseDebt(client)} busy={busy} />}{tab === 'crm' && <CRMTab client={client} onSetStatus={onSetStatus} onQuickAction={onQuickAction} busy={busy} />}</div></div>;
}

function ProfileHeader({ client, busy, onClose, onCloseDebt, onQuickAction }) {
  const hasDebt = Number(client.debt_amount || 0) > 0;
  return <div className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.38),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_36%)]" /><div className="relative p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">Картка покупця</p><div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="text-2xl md:text-4xl font-black uppercase leading-tight break-words">{client.client || 'Без імені'}</h2><Badge status={client.status} dark /></div><p className="mt-2 text-xs font-bold text-slate-300">{client.pipeline?.reason || 'CRM-профіль клієнта'}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300"><InfoPill icon={<Phone size={14}/>} text={client.phone || 'Телефон не вказаний'} /><InfoPill icon={<Star size={14}/>} text={`ID: ${client.key}`} /></div></div>{onClose && <button type="button" onClick={onClose} className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/20 flex items-center justify-center"><X size={19}/></button>}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><Stat label="Замовлень" value={client.orders_count || 0} dark /><Stat label="Покупки" value={money(client.total_revenue)} dark /><Stat label="Прибуток" value={money(client.total_profit)} good dark /><Stat label="Борг" value={money(client.debt_amount)} bad={hasDebt} dark /></div><div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2"><QuickButton icon={<Phone size={15}/>} label="Подзвонити" busy={busy === 'call'} onClick={() => onQuickAction('call', client)} /><QuickButton icon={<MessageCircle size={15}/>} label="Написати" onClick={() => onQuickAction('message', client)} /><QuickButton icon={<ClipboardList size={15}/>} label="Задача" busy={busy === 'task'} onClick={() => onQuickAction('task', client)} /><QuickButton icon={<PlusCircle size={15}/>} label="Замовлення" busy={busy === 'order'} onClick={() => onQuickAction('order', client)} /><QuickButton icon={<Bell size={15}/>} label="Нагадування" busy={busy === 'reminder'} onClick={() => onQuickAction('reminder', client)} /></div>{hasDebt && <div className="mt-5 rounded-[24px] border border-rose-300/30 bg-rose-500/12 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="text-sm font-black uppercase text-rose-100 flex items-center gap-2"><AlertTriangle size={16}/> Є неоплачена сума</p><p className="text-xs font-bold text-rose-100/80 mt-1">Клієнт автоматично в pipeline “З боргом”.</p></div><button type="button" disabled={busy === 'debt'} onClick={() => onCloseDebt?.(client)} className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 text-white px-5 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2"><CreditCard size={16}/> {busy === 'debt' ? 'Закриваємо...' : 'Закрити борг'}</button></div>}</div></div>;
}

function QuickButton({ icon, label, onClick, busy }) {
  return <button type="button" disabled={busy} onClick={onClick} className="rounded-2xl bg-white/10 border border-white/15 text-white px-3 py-3 text-[11px] font-black uppercase inline-flex items-center justify-center gap-2 hover:bg-white/20 disabled:opacity-60 transition">{icon}{busy ? '...' : label}</button>;
}

function Tabs({ active, setActive }) {
  const tabs = [{ key: 'overview', label: 'Огляд', icon: UserRound }, { key: 'sales', label: 'Продажі', icon: Repeat2 }, { key: 'history', label: 'Історія', icon: History }, { key: 'cars', label: 'Авто', icon: Car }, { key: 'debts', label: 'Борги', icon: CreditCard }, { key: 'crm', label: 'CRM', icon: ClipboardList }];
  return <div className="border-b border-slate-100 bg-white px-3 md:px-5 py-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex gap-2 min-w-max">{tabs.map((item) => { const Icon = item.icon; const isActive = active === item.key; return <button key={item.key} type="button" onClick={() => setActive(item.key)} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase transition-all border whitespace-nowrap ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-blue-200 hover:text-blue-700'}`}><Icon size={15} /> {item.label}</button>; })}</div></div>;
}

function Overview({ client, orders, parts, cars, debts, onQuickAction, onRepeatPart, onCopy }) {
  return <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5"><div className="space-y-5 min-w-0"><Panel title="Короткий профіль" icon={<UserRound size={17} className="text-blue-600" />}><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><ProfileInfo label="Телефон" value={client.phone || '—'} icon={<Phone size={16}/>} /><ProfileInfo label="Остання покупка" value={fmtDate(client.last_order_date || orders[0]?.created_at)} icon={<History size={16}/>} /><ProfileInfo label="Pipeline" value={client.status || 'Новий'} icon={<UserCheck size={16}/>} /></div></Panel><Panel title="Останні покупки" icon={<Package size={17} className="text-amber-500" />}><PartList parts={parts.slice(0, 5)} onRepeatPart={(part) => onRepeatPart(part, client)} /></Panel><Panel title="Рекомендовані дії" icon={<TrendingUp size={17} className="text-blue-600" />}><OpportunityList client={client} onQuickAction={onQuickAction} onRepeatPart={onRepeatPart} /></Panel></div><div className="space-y-5 min-w-0"><Panel title="Оплата" icon={<CreditCard size={17} className="text-emerald-600" />}><div className={`rounded-[24px] border p-4 ${Number(client.debt_amount || 0) > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}><p className="text-[11px] font-black uppercase text-slate-500">Баланс</p><p className="mt-2 text-3xl font-black text-slate-900">{money(client.debt_amount)}</p><p className="mt-2 text-xs font-bold text-slate-500">Борг переводить клієнта в pipeline “З боргом”.</p></div></Panel><Panel title="Авто / VIN" icon={<Car size={17} className="text-blue-600" />}><Cars cars={cars.slice(0, 2)} onCopy={onCopy} compact /></Panel><Panel title="Ризики" icon={<AlertTriangle size={17} className="text-amber-500" />}><Insight text={client.pipeline?.reason || 'Клієнт без явних ризиків.'} /><Insight text={debts.length ? `${debts.length} замовлень потребують контролю оплати.` : 'Боргів по клієнту не знайдено.'} /></Panel></div></div>;
}

function SalesTab({ client, onQuickAction, onRepeatPart, busy }) {
  return <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_380px] gap-5"><div className="space-y-5"><Panel title="Повторні продажі" icon={<Repeat2 size={17} className="text-blue-600" />}><OpportunityList client={client} onQuickAction={onQuickAction} onRepeatPart={onRepeatPart} full /></Panel><Panel title="Товари з історії" icon={<Package size={17} className="text-amber-500" />}><PartList parts={arr(client.parts).slice(0, 10)} onRepeatPart={(part) => onRepeatPart(part, client)} busy={busy} /></Panel></div><Panel title="Швидкий запуск" icon={<PlusCircle size={17} className="text-emerald-600" />}><div className="space-y-2"><ActionTile icon={<PlusCircle size={16}/>} title="Створити повторне замовлення" text="Клієнт, телефон, авто і VIN підтягнуться автоматично" onClick={() => onQuickAction('order', client)} busy={busy === 'order'} /><ActionTile icon={<Bell size={16}/>} title="Поставити нагадування" text="Повернути клієнта через 30 днів" onClick={() => onQuickAction('reminder', client)} busy={busy === 'reminder'} /><ActionTile icon={<ClipboardList size={16}/>} title="Створити задачу" text="Задача менеджеру на завтра" onClick={() => onQuickAction('task', client)} busy={busy === 'task'} /></div></Panel></div>;
}

function OpportunityList({ client, onQuickAction, onRepeatPart, full = false }) {
  const opportunities = arr(client.repeat_opportunities).slice(0, full ? 6 : 3);
  if (!opportunities.length) return <Empty text="CRM поки не бачить явних можливостей для повторного продажу" />;
  return <div className="space-y-2">{opportunities.map((item, idx) => <div key={`${item.type}-${idx}`} className={`rounded-[22px] border p-4 ${item.priority === 'high' ? 'bg-rose-50 border-rose-100' : item.priority === 'medium' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{item.title}</p><p className="text-xs font-bold text-slate-500 mt-1 leading-relaxed">{item.description}</p></div>{item.type === 'repeat_part' ? <Repeat2 className="text-blue-600 shrink-0" size={18}/> : <Bell className="text-amber-500 shrink-0" size={18}/>}</div><div className="mt-3 flex flex-wrap gap-2">{item.part ? <button type="button" onClick={() => onRepeatPart?.(item.part, client)} className="rounded-2xl bg-blue-600 text-white px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1"><Repeat2 size={13}/> Повторити товар</button> : <button type="button" onClick={() => onQuickAction?.(item.type === 'service_reminder' ? 'reminder' : 'task', client)} className="rounded-2xl bg-slate-900 text-white px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1"><ClipboardList size={13}/> Дія</button>}<button type="button" onClick={() => onQuickAction?.('order', client)} className="rounded-2xl bg-white text-blue-700 border border-blue-100 px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1"><PlusCircle size={13}/> Замовлення</button></div></div>)}</div>;
}

function HistoryTab({ orders, onRepeatPart, busy }) {
  if (!orders.length) return <Empty text="Історії покупок ще немає" />;
  return <div className="space-y-3">{orders.map((order) => <div key={order.id} className="bg-white border border-slate-200 rounded-[24px] p-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-black text-slate-900">Замовлення №{order.id}</p><p className="text-xs font-bold text-slate-500 mt-1">{fmtDate(order.created_at)} · {money(order.revenue)} · прибуток {money(order.profit)}</p></div><Badge status={order.status} /></div><div className="mt-3"><PartList parts={arr(order.parts).map((part) => ({ ...part, order_id: order.id, date: order.created_at }))} onRepeatPart={onRepeatPart} busy={busy} compact /></div></div>)}</div>;
}

function CRMTab({ client, onSetStatus, onQuickAction, busy }) {
  return <div className="grid grid-cols-1 2xl:grid-cols-[360px_minmax(0,1fr)] gap-5"><div className="space-y-5"><Panel title="Pipeline" icon={<UserCheck size={17} className="text-blue-600" />}><p className="text-xs font-bold text-slate-500 mb-3">Поточний статус: <b className="text-slate-900">{client.status}</b></p><div className="grid grid-cols-2 gap-2">{pipelineOptions.filter((item) => !item.locked).map((item) => <button key={item.key} type="button" disabled={busy === `status:${item.key}`} onClick={() => onSetStatus(client, item.key)} className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] font-black uppercase text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100 disabled:opacity-60">{busy === `status:${item.key}` ? '...' : item.label}</button>)}</div></Panel><Panel title="Дії" icon={<ClipboardList size={17} className="text-emerald-600" />}><div className="space-y-2"><ActionTile icon={<Phone size={16}/>} title="Подзвонити" text="Записати дзвінок у CRM" onClick={() => onQuickAction('call', client)} busy={busy === 'call'} /><ActionTile icon={<MessageCircle size={16}/>} title="Написати" text="Скопіювати готовий текст клієнту" onClick={() => onQuickAction('message', client)} /><ActionTile icon={<ClipboardList size={16}/>} title="Створити задачу" text="Задача менеджеру на завтра" onClick={() => onQuickAction('task', client)} busy={busy === 'task'} /></div></Panel></div><div className="space-y-5"><Panel title="Задачі" icon={<ClipboardList size={17} className="text-blue-600" />}><CRMList items={client.tasks} empty="Активних задач немає" /></Panel><Panel title="Нагадування" icon={<Bell size={17} className="text-amber-500" />}><CRMList items={client.reminders} empty="Активних нагадувань немає" /></Panel><Panel title="Рекомендації" icon={<TrendingUp size={17} className="text-emerald-600" />}><CRMList items={client.recommendations} empty="Активних рекомендацій немає" /></Panel><Panel title="Комунікації" icon={<MessageCircle size={17} className="text-violet-600" />}><CRMList items={client.communications} empty="Історії комунікацій немає" communication /></Panel></div></div>;
}

function CRMList({ items, empty, communication = false }) {
  const safe = arr(items);
  if (!safe.length) return <Empty text={empty} />;
  return <div className="space-y-2">{safe.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-3"><div className="flex justify-between gap-3"><p className="font-black text-sm text-slate-900">{communication ? item.status_label : item.title}</p><span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{fmtDate(item.due_date || item.created_at)}</span></div>{(item.description || item.note || item.comment) && <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{item.description || item.note || item.comment}</p>}</div>)}</div>;
}

function Cars({ cars, onCopy }) {
  const safe = arr(cars);
  if (!safe.length) return <Empty text="Авто не вказані" />;
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{safe.map((car, idx) => <div key={`${car.plate || car.vin_code || idx}`} className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-sm"><p className="font-black text-slate-900 flex items-center gap-2"><Car size={16} className="text-blue-600" />{car.plate || 'Без номера'}</p><div className="mt-3 grid grid-cols-1 gap-2"><Mini label="VIN" value={car.vin_code || '—'} /></div>{car.vin_code && <button type="button" onClick={() => onCopy?.(car.vin_code, 'VIN скопійовано.')} className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 inline-flex items-center gap-1"><Copy size={14}/> VIN</button>}</div>)}</div>;
}

function Debts({ debts, onCloseDebt, busy }) {
  if (!debts.length) return <Empty text="Боргів немає" />;
  return <div className="space-y-3">{debts.map((order) => <div key={order.id} className="bg-white border border-rose-100 rounded-[24px] p-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-black text-slate-900">Замовлення №{order.id}</p><p className="text-xs font-bold text-slate-500 mt-1">{fmtDate(order.created_at)} · {order.payment_status}</p></div><div className="text-left md:text-right"><p className="text-2xl font-black text-rose-600">{money(order.debt_amount || order.revenue)}</p><button type="button" disabled={busy === 'debt'} onClick={onCloseDebt} className="mt-2 rounded-2xl bg-emerald-600 text-white px-4 py-2 text-[11px] font-black uppercase disabled:bg-slate-300">Закрити борг</button></div></div></div>)}</div>;
}

function PartList({ parts, onRepeatPart, busy }) {
  const safe = arr(parts);
  if (!safe.length) return <Empty text="Товарів немає" />;
  return <div className="space-y-2">{safe.map((part, idx) => <div key={`${part.order_id || 'p'}-${part.id || idx}`} className="rounded-2xl bg-white border border-slate-200 p-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_120px_110px] gap-3 items-center"><div className="min-w-0"><p className="font-black text-slate-900 break-words">{part.brand} {part.article}</p><p className="text-xs font-bold text-slate-500 mt-1 break-words">{part.name}</p></div><Mini label="Продаж" value={money(part.sell_price || part.revenue)} good /><button type="button" disabled={busy === `repeat:${part.order_id}-${part.id}`} onClick={() => onRepeatPart?.(part)} className="rounded-xl bg-blue-600 text-white px-3 py-2 text-[11px] font-black uppercase inline-flex items-center justify-center gap-1 disabled:bg-slate-300"><Repeat2 size={13}/> Повтор</button></div>)}</div>;
}

function Panel({ title, icon, children }) { return <section className="bg-white border border-slate-200 rounded-[28px] p-4 md:p-5 shadow-sm min-w-0"><h3 className="font-black uppercase text-sm text-slate-900 mb-4 flex items-center gap-2">{icon}{title}</h3>{children}</section>; }
function ProfileInfo({ label, value, icon }) { return <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">{icon}{label}</p><p className="mt-2 text-sm font-black text-slate-900 break-words">{value}</p></div>; }
function ActionTile({ icon, title, text, onClick, busy }) { return <button type="button" onClick={onClick} disabled={busy} className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:border-blue-100 transition disabled:opacity-60"><div className="flex items-start gap-3"><span className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">{icon}</span><span><span className="block font-black text-sm text-slate-900">{busy ? 'Виконуємо...' : title}</span><span className="block text-xs font-semibold text-slate-500 mt-1">{text}</span></span></div></button>; }
function InfoPill({ icon, text }) { return <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-black text-white/90 max-w-full">{icon}<span className="truncate">{text}</span></span>; }
function HeroMetric({ label, value, danger, good }) { return <div className="p-4 md:p-5 border-r border-white/10 last:border-r-0"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className={`mt-2 text-xl md:text-2xl font-black truncate ${danger ? 'text-rose-200' : good ? 'text-emerald-200' : 'text-white'}`}>{value}</p></div>; }
function MessageBox({ message, onClose }) { return <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-[24px] p-4 font-bold text-sm flex items-start justify-between gap-3 shadow-sm"><span>{message}</span><button type="button" onClick={onClose} className="rounded-xl bg-white/70 p-1 text-blue-700 hover:bg-white"><X size={16}/></button></div>; }
function CopyNotice({ message }) { return <div className="fixed left-1/2 bottom-6 z-[120] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl shadow-emerald-200/60 flex items-center gap-3 text-sm font-black text-emerald-700"><span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center animate-pulse"><CheckCircle2 size={19} /></span><span>{message}</span></div>; }
function Badge({ status, dark = false }) { const cls = statusTone[status] || 'bg-slate-100 text-slate-600 border-slate-200'; return <span className={`inline-flex rounded-xl border px-2.5 py-1 text-[11px] font-black uppercase whitespace-nowrap ${dark ? 'bg-white/10 text-white border-white/20' : cls}`}>{status || 'Новий'}</span>; }
function Stat({ label, value, bad, good, dark }) { return <div className={`rounded-2xl p-4 border min-w-0 ${dark ? 'bg-white/10 border-white/10' : 'bg-white border-slate-100'}`}><p className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-slate-300' : 'text-slate-400'}`}>{label}</p><p className={`mt-2 text-lg md:text-xl font-black truncate ${bad ? 'text-rose-300' : good ? 'text-emerald-300' : dark ? 'text-white' : 'text-slate-900'}`}>{value}</p></div>; }
function Mini({ label, value, bad, good }) { return <div className="rounded-xl bg-white border border-slate-100 px-2.5 py-2 min-w-0"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-xs font-black truncate ${bad ? 'text-rose-600' : good ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p></div>; }
function Insight({ text }) { return <p className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm font-bold text-slate-600 leading-relaxed flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />{text}</p>; }
function Empty({ text }) { return <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">{text}</div>; }
function EmptyProfile() { return <div className="bg-white border border-dashed border-slate-200 rounded-[34px] p-10 text-center text-slate-400 font-black uppercase"><UserRound size={42} className="mx-auto mb-3 opacity-40" />Оберіть клієнта зі списку</div>; }
