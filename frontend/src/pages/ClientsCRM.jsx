import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Copy,
  CreditCard,
  Edit3,
  ExternalLink,
  History,
  Package,
  Phone,
  RefreshCcw,
  Repeat2,
  Search,
  Star,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const arr = (v) => Array.isArray(v) ? v : [];
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusTone = {
  VIP: 'bg-violet-50 text-violet-700 border-violet-100',
  Борг: 'bg-rose-50 text-rose-700 border-rose-100',
  Проблемний: 'bg-amber-50 text-amber-700 border-amber-100',
  Постійний: 'bg-blue-50 text-blue-700 border-blue-100',
  Новий: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const payLabel = {
  unpaid: 'Не оплачено',
  prepaid: 'Передплата',
  paid: 'Оплачено',
  cod: 'Післяплата',
  debt: 'Борг',
};

const orderLabel = {
  SELECTION: 'В обробці',
  ORDERED: 'Очікує товар',
  IN_PROGRESS: 'Очікує товар',
  DONE: 'Готове',
  SHIPPED: 'Відправлено',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

const orderTone = {
  SELECTION: 'bg-amber-50 text-amber-700 border-amber-100',
  ORDERED: 'bg-blue-50 text-blue-700 border-blue-100',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-100',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SHIPPED: 'bg-violet-50 text-violet-700 border-violet-100',
  COMPLETED: 'bg-green-50 text-green-700 border-green-100',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-100',
};

const copyText = async (value, onDone, successMessage = 'Скопійовано.') => {
  const text = String(value || '').trim();
  if (!text) {
    onDone?.('Немає що копіювати.');
    return false;
  }

  const fallbackCopy = () => {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    textarea.remove();
    return copied;
  };

  try {
    if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      onDone?.(successMessage);
      return true;
    }
  } catch {}

  if (fallbackCopy()) {
    onDone?.(successMessage);
    return true;
  }

  onDone?.(`Не вдалося скопіювати автоматично. Скопіюйте вручну: ${text}`);
  return false;
};

const normalizePaymentLink = (value) => {
  const link = String(value || '').trim();
  if (!link) return '';
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link}`;
};

const orderDebtAmount = (order) => Number(order?.debt_amount ?? order?.revenue ?? order?.total_revenue ?? order?.total ?? 0) || 0;
const orderPaidAmount = (order) => Number(order?.revenue ?? order?.total_revenue ?? order?.total ?? order?.debt_amount ?? 0) || 0;
const isDebtOrder = (order) => orderDebtAmount(order) > 0 || ['unpaid', 'debt', 'cod', 'prepaid'].includes(String(order?.payment_status || '').toLowerCase());

export default function ClientsCRM() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editClient, setEditClient] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [busyRepeat, setBusyRepeat] = useState(null);
  const [companyPaymentLink, setCompanyPaymentLink] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [debtBusy, setDebtBusy] = useState(false);

  const load = async (query = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/store-clients/${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      const results = arr(res.data?.results);
      setClients(results);
      return results;
    } catch {
      setMessage('Не вдалося завантажити клієнтів. Перевірте підключення або backend endpoint.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const openClient = async (client, opts = {}) => {
    if (!client?.key) return;
    setSelected(client);
    setTab(opts.tab || 'history');
    setExpandedOrders(new Set(opts.orderId ? [Number(opts.orderId)] : []));
    try {
      const res = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      const detail = res.data;
      setSelected(detail);
      const orderId = opts.orderId ? Number(opts.orderId) : arr(detail?.orders)[0]?.id;
      if (orderId) setExpandedOrders(new Set([orderId]));
      if (opts.tab) setTab(opts.tab);
    } catch {
      setMessage('Не вдалося відкрити картку клієнта.');
    }
  };

  useEffect(() => {
    api.get('/api/settings/')
      .then((res) => setCompanyPaymentLink(res.data?.company?.payment_link || ''))
      .catch(() => {});
  }, []);

  const showActionNotice = (text) => {
    const message = String(text || '').trim();
    if (!message) return;
    setMessage(message);
    setCopyNotice(message);
  };

  useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = setTimeout(() => setCopyNotice(''), 1800);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('search') || params.get('q') || '';
    const orderId = params.get('order_id');
    const urlTab = params.get('tab') || 'history';
    const shouldOpen = params.get('autopen') === '1' || Boolean(orderId);
    setSearch(query);

    (async () => {
      const results = await load(query || orderId || '');
      if (shouldOpen && results.length) {
        let target = results[0];
        if (orderId) {
          target = results.find((c) => arr(c.orders).some((o) => Number(o.id) === Number(orderId))) || results[0];
        }
        await openClient(target, { tab: urlTab, orderId });
      }
    })();
  }, [location.search]);

  const totals = useMemo(() => clients.reduce((acc, client) => {
    acc.count += 1;
    acc.orders += Number(client.orders_count || 0);
    acc.revenue += Number(client.total_revenue || 0);
    acc.profit += Number(client.total_profit || 0);
    acc.debt += Number(client.debt_amount || 0);
    return acc;
  }, { count: 0, orders: 0, revenue: 0, profit: 0, debt: 0 }), [clients]);

  const openEdit = (client) => {
    const car = arr(client.cars)[0] || {};
    setEditClient({
      key: client.key,
      client: client.client || '',
      phone: client.phone || '',
      plate: car.plate || '',
      vin_code: car.vin_code || '',
      overwrite_car: false,
    });
  };

  const saveClient = async (event) => {
    event.preventDefault();
    if (!editClient) return;
    try {
      const res = await api.patch('/api/store-clients/update/', {
        key: editClient.key,
        client: editClient.client,
        phone: editClient.phone,
        plate: editClient.plate,
        vin_code: editClient.vin_code,
        overwrite_car: editClient.overwrite_car,
      });
      if (res.data?.client) setSelected(res.data.client);
      setEditClient(null);
      setMessage(`Картку покупця оновлено. Змінено замовлень: ${res.data?.updated ?? 0}.`);
      load(search);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося оновити покупця.');
    }
  };

  const openSearchByPart = (part) => {
    const params = new URLSearchParams();
    params.set('q', part.article || part.name || '');
    if (selected?.key) params.set('clientKey', selected.key);
    if (selected?.phone) params.set('clientPhone', selected.phone);
    if (selected?.client) params.set('clientName', selected.client);
    navigate(`/search?${params.toString()}`);
  };

  const refreshSelectedClient = async (client = selected) => {
    if (!client?.key) return null;
    try {
      const detail = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      setSelected(detail.data);
      return detail.data;
    } catch {
      return null;
    }
  };

  const handleCopy = (value, successMessage = 'Скопійовано.') => copyText(value, showActionNotice, successMessage);

  const handlePaymentLinkCopy = async () => {
    const paymentLink = normalizePaymentLink(companyPaymentLink);
    if (!paymentLink) {
      showActionNotice('Посилання на оплату ще не додано в Налаштуваннях → Профіль компанії → Оплата.');
      return;
    }
    await copyText(paymentLink, showActionNotice, 'Посилання на оплату скопійовано.');
  };

  const handleCloseDebt = async (clientOverride = selected) => {
    const target = clientOverride || selected;
    if (!target) return;

    const targetOrders = arr(target.orders).filter(isDebtOrder);
    if (!targetOrders.length && Number(target.debt_amount || 0) <= 0) {
      showActionNotice('Боргів по цьому клієнту немає.');
      return;
    }

    if (!targetOrders.length) {
      showActionNotice('Не бачу замовлень для закриття боргу. Відкрийте повну картку клієнта і спробуйте ще раз.');
      return;
    }

    setDebtBusy(true);
    try {
      await Promise.all(targetOrders.map((order) => api.patch(`/api/visits/${order.id}/`, {
        payment_status: 'paid',
        prepayment_amount: orderPaidAmount(order),
      })));

      showActionNotice(`Борг закрито. Оновлено замовлень: ${targetOrders.length}.`);
      await load(search);
      await refreshSelectedClient(target);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося закрити борг. Перевірте права доступу або спробуйте ще раз.');
    } finally {
      setDebtBusy(false);
    }
  };

  const repeatPart = async (part) => {
    if (!selected) return;
    setBusyRepeat(`${part.order_id}-${part.id}`);
    try {
      const res = await api.post('/api/store-clients/repeat-sale/', {
        key: selected.key,
        phone: selected.phone,
        client: selected.client,
        plate: arr(selected.cars)[0]?.plate || '',
        vin_code: arr(selected.cars)[0]?.vin_code || '',
        part,
      });
      setMessage(res.data?.message || 'Товар додано в нове замовлення.');
      navigate(`/visits?visit_id=${res.data?.visit_id || ''}`);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося повторити продаж.');
    } finally {
      setBusyRepeat(null);
    }
  };

  const toggleOrder = (id) => setExpandedOrders((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/40 px-3 md:px-6 2xl:px-8 py-4 md:py-6 overflow-x-hidden">
      <div className="max-w-[1780px] mx-auto space-y-5">
        <header className="relative overflow-hidden rounded-[34px] bg-slate-950 text-white shadow-2xl shadow-slate-200 border border-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_35%)]" />
          <div className="relative p-5 md:p-7 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-5 items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
                <UserRound size={15} /> CRM покупців
              </div>
              <h1 className="mt-4 text-3xl md:text-5xl font-black uppercase italic leading-tight tracking-tight">Клієнти</h1>
              <p className="mt-3 text-sm md:text-base font-bold text-slate-300 max-w-3xl">
                Історія покупок, борги, авто, VIN, повторний продаж і швидка оплата в одному професійному екрані.
              </p>
            </div>
            <button
              type="button"
              onClick={() => load(search)}
              className="w-full xl:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-950 px-5 py-3 text-xs font-black uppercase shadow-lg hover:bg-slate-100 transition"
            >
              <RefreshCcw size={16} /> Оновити CRM
            </button>
          </div>
          <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-white/10 bg-white/5">
            <HeroMetric label="Покупців" value={totals.count} />
            <HeroMetric label="Замовлень" value={totals.orders} />
            <HeroMetric label="Виручка" value={money(totals.revenue)} />
            <HeroMetric label="Борги" value={money(totals.debt)} danger={totals.debt > 0} />
          </div>
        </header>

        {message && <MessageBox message={message} onClose={() => setMessage('')} />}

        <form onSubmit={submitSearch} className="bg-white border border-slate-200 rounded-[30px] p-3 md:p-4 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук: № замовлення, телефон, ПІБ, авто, VIN, артикул або товар..."
              className="w-full min-h-[52px] bg-slate-50 border-2 border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm md:text-base font-extrabold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition placeholder:text-slate-400 placeholder:font-bold"
            />
          </div>
          <button className="min-h-[52px] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-7 py-3 text-xs font-black uppercase shadow-lg shadow-blue-100 transition">
            Знайти
          </button>
        </form>

        <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)] gap-5 items-start">
          <section className="bg-white border border-slate-200 rounded-[30px] p-3 md:p-4 shadow-sm h-fit xl:sticky xl:top-6">
            <div className="flex items-center justify-between gap-3 mb-3 px-1">
              <div>
                <h2 className="font-black uppercase text-slate-900">Список покупців</h2>
                <p className="text-xs font-bold text-slate-400 mt-1">Натисніть на покупця, щоб відкрити картку</p>
              </div>
              <span className="text-[11px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{clients.length}</span>
            </div>
            <div className="space-y-3 max-h-none xl:max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {loading ? <Empty text="Завантаження клієнтів..." /> : clients.map((client) => (
                <ClientCard
                  key={client.key}
                  client={client}
                  active={selected?.key === client.key}
                  onClick={() => openClient(client)}
                  onCloseDebt={handleCloseDebt}
                  debtBusy={debtBusy}
                />
              ))}
              {!loading && !clients.length && <Empty text="Клієнтів не знайдено" />}
            </div>
          </section>

          <section className="hidden xl:block min-w-0 w-full">
            {selected ? (
              <ClientProfileCard
                client={selected}
                tab={tab}
                setTab={setTab}
                onEdit={() => openEdit(selected)}
                onCloseDebt={handleCloseDebt}
                onCopy={handleCopy}
                onPaymentLinkCopy={handlePaymentLinkCopy}
                debtBusy={debtBusy}
                expandedOrders={expandedOrders}
                toggleOrder={toggleOrder}
                onSearchPart={openSearchByPart}
                onRepeatPart={repeatPart}
                busyRepeat={busyRepeat}
              />
            ) : (
              <EmptyProfile />
            )}
          </section>
        </div>
      </div>

      {selected && (
        <div className="xl:hidden fixed inset-0 z-[80] bg-slate-900/65 backdrop-blur-sm overflow-y-auto overscroll-contain block">
          <div className="bg-white w-full min-h-[100dvh] shadow-2xl rounded-none">
            <ClientProfileCard
              client={selected}
              tab={tab}
              setTab={setTab}
              onClose={() => setSelected(null)}
              onEdit={() => openEdit(selected)}
              onCloseDebt={handleCloseDebt}
              onCopy={handleCopy}
              onPaymentLinkCopy={handlePaymentLinkCopy}
              debtBusy={debtBusy}
              expandedOrders={expandedOrders}
              toggleOrder={toggleOrder}
              onSearchPart={openSearchByPart}
              onRepeatPart={repeatPart}
              busyRepeat={busyRepeat}
            />
          </div>
        </div>
      )}

      {copyNotice && <CopyNotice message={copyNotice} />}

      {editClient && (
        <EditClientModal
          form={editClient}
          setForm={setEditClient}
          onClose={() => setEditClient(null)}
          onSubmit={saveClient}
        />
      )}
    </div>
  );
}


function CopyNotice({ message }) {
  return (
    <div className="fixed left-1/2 bottom-6 z-[120] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl shadow-emerald-200/60 flex items-center gap-3 text-sm font-black text-emerald-700">
      <span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center animate-pulse"><CheckCircle2 size={19} /></span>
      <span>{message}</span>
    </div>
  );
}

function HeroMetric({ label, value, danger }) {
  return (
    <div className="p-4 md:p-5 border-r border-white/10 last:border-r-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-xl md:text-2xl font-black truncate ${danger ? 'text-rose-200' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function MessageBox({ message, onClose }) {
  return (
    <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-[24px] p-4 font-bold text-sm flex items-start justify-between gap-3 shadow-sm">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl bg-white/70 p-1 text-blue-700 hover:bg-white"><X size={16}/></button>
    </div>
  );
}

function ClientCard({ client, active, onClick, onCloseDebt, debtBusy }) {
  const debt = Number(client.debt_amount || 0) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[24px] p-4 border transition relative overflow-hidden ${active ? 'bg-blue-50 border-blue-200 shadow-lg shadow-blue-100/70' : 'bg-slate-50 border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-md'}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${debt ? 'bg-rose-400' : active ? 'bg-blue-500' : 'bg-emerald-400'}`} />
      <div className="pl-1 space-y-3">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-slate-900 leading-tight truncate">{client.client || 'Без імені'}</p>
            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1 min-w-0"><Phone size={12} className="shrink-0" /> <span className="truncate">{client.phone || 'Телефон не вказаний'}</span></p>
          </div>
          <Badge status={client.status} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Mini label="Зам." value={client.orders_count || 0} />
          <Mini label="Сума" value={money(client.total_revenue)} />
          <Mini label="Борг" value={money(client.debt_amount)} bad={debt} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-slate-400">Останнє: {fmtDate(client.last_order_date)}</p>
          {debt && (
            <span
              onClick={(event) => { event.stopPropagation(); onCloseDebt?.(client); }}
              className="bg-emerald-600 text-white rounded-xl px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1 shadow-sm"
            >
              <CreditCard size={13} /> {debtBusy ? 'Закриваємо...' : 'Закрити'}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ClientProfileCard({ client, tab, setTab, onClose, onEdit, onCloseDebt, onCopy, onPaymentLinkCopy, debtBusy, expandedOrders, toggleOrder, onSearchPart, onRepeatPart, busyRepeat }) {
  const orders = arr(client.orders);
  const parts = arr(client.parts);
  const cars = arr(client.cars);
  const debts = orders.filter((order) => Number(order.debt_amount || 0) > 0 || ['unpaid', 'debt', 'cod', 'prepaid'].includes(order.payment_status));
  const returns = parts.filter((part) => ['returned', 'defective'].includes(part.stock_status));
  const hasDebt = Number(client.debt_amount || 0) > 0 || debts.length > 0;

  return (
    <div className={`bg-white ${onClose ? 'min-h-[100dvh]' : 'xl:border xl:border-slate-200 xl:rounded-[34px] xl:shadow-sm'} overflow-visible flex flex-col`}>
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.38),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.25),transparent_36%)]" />
        <div className="relative p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">Картка покупця</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl md:text-4xl font-black uppercase leading-tight break-words">{client.client || 'Без імені'}</h2>
                <Badge status={client.status} dark />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300">
                <InfoPill icon={<Phone size={14}/>} text={client.phone || 'Телефон не вказаний'} onCopy={() => onCopy?.(client.phone, 'Телефон скопійовано.')} />
                {client.key && <InfoPill icon={<Star size={14}/>} text={`ID: ${client.key}`} onCopy={() => onCopy?.(client.key, 'ID покупця скопійовано.')} />}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onEdit} className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/20 flex items-center justify-center" title="Редагувати покупця"><Edit3 size={17}/></button>
              {onClose && <button type="button" onClick={onClose} className="h-11 w-11 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/20 flex items-center justify-center"><X size={19}/></button>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Stat label="Замовлень" value={client.orders_count || orders.length || 0} dark />
            <Stat label="Покупки" value={money(client.total_revenue)} dark />
            <Stat label="Прибуток" value={money(client.total_profit)} good dark />
            <Stat label="Борг" value={money(client.debt_amount)} bad={hasDebt} dark />
          </div>

          {hasDebt && (
            <div className="mt-5 rounded-[24px] border border-rose-300/30 bg-rose-500/12 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-rose-100 flex items-center gap-2"><AlertTriangle size={16}/> Є неоплачена сума</p>
                <p className="text-xs font-bold text-rose-100/80 mt-1">Натисніть “Закрити борг”, щоб позначити неоплачені замовлення клієнта як оплачені.</p>
              </div>
              <button type="button" disabled={debtBusy} onClick={() => onCloseDebt?.(client)} className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 text-white px-5 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20">
                <CreditCard size={16}/> {debtBusy ? 'Закриваємо...' : 'Закрити борг'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Tabs active={tab} setActive={setTab} />

      <div className="p-4 md:p-5 bg-slate-50/60 overflow-visible flex-1">
        {tab === 'overview' && <Overview client={client} orders={orders} parts={parts} cars={cars} debts={debts} returns={returns} onCloseDebt={onCloseDebt} onPaymentLinkCopy={onPaymentLinkCopy} debtBusy={debtBusy} onCopy={onCopy} onRepeatPart={onRepeatPart} onSearchPart={onSearchPart} busyRepeat={busyRepeat} />}
        {tab === 'history' && <PurchaseHistory orders={orders} expandedOrders={expandedOrders} toggleOrder={toggleOrder} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busyRepeat={busyRepeat} onCopy={onCopy} />}
        {tab === 'cars' && <Cars cars={cars} onCopy={onCopy} />}
        {tab === 'debts' && <Debts debts={debts} onCloseDebt={onCloseDebt} debtBusy={debtBusy} />}
        {tab === 'returns' && <Returns returns={returns} onCopy={onCopy} />}
      </div>
    </div>
  );
}

function InfoPill({ icon, text, onCopy }) {
  return (
    <button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-black text-white/90 hover:bg-white/15 transition max-w-full">
      {icon}<span className="truncate">{text}</span>{onCopy && <Copy size={13} className="opacity-70" />}
    </button>
  );
}

function Tabs({ active, setActive }) {
  const tabs = [
    { key: 'overview', label: 'Огляд', icon: UserRound },
    { key: 'history', label: 'Історія', icon: History },
    { key: 'cars', label: 'Авто', icon: Car },
    { key: 'debts', label: 'Борги', icon: CreditCard },
    { key: 'returns', label: 'Повернення', icon: RefreshCcw },
  ];

  return (
    <div className="border-b border-slate-100 bg-white px-3 md:px-5 py-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2 min-w-max">
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase transition-all border whitespace-nowrap ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-blue-200 hover:text-blue-700'}`}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Overview({ client, orders, parts, cars, debts, returns, onCloseDebt, onPaymentLinkCopy, debtBusy, onCopy, onSearchPart, onRepeatPart, busyRepeat }) {
  const lastOrder = orders[0];
  const topParts = parts.slice(0, 5);
  const hasDebt = Number(client.debt_amount || 0) > 0 || debts.length > 0;

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
      <div className="space-y-5 min-w-0">
        <Panel title="Короткий профіль" icon={<UserRound size={17} className="text-blue-600" />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ProfileInfo label="Телефон" value={client.phone || '—'} icon={<Phone size={16}/>} />
            <ProfileInfo label="Остання покупка" value={fmtDate(client.last_order_date || lastOrder?.created_at)} icon={<History size={16}/>} />
            <ProfileInfo label="Авто" value={`${cars.length || 0} в картці`} icon={<Car size={16}/>} />
          </div>
        </Panel>

        <Panel title="Останні покупки" icon={<Package size={17} className="text-amber-500" />}>
          {topParts.length ? (
            <div className="space-y-2">
              {topParts.map((part, idx) => <PartLine key={`${part.order_id || 'p'}-${part.id || idx}`} p={part} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busy={busyRepeat === `${part.order_id}-${part.id}`} />)}
            </div>
          ) : <Empty text="Покупок ще немає" />}
        </Panel>
      </div>

      <div className="space-y-5 min-w-0">
        <Panel title="Оплата" icon={<CreditCard size={17} className="text-emerald-600" />}>
          <div className={`rounded-[24px] border p-4 ${hasDebt ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-[11px] font-black uppercase ${hasDebt ? 'text-rose-600' : 'text-emerald-700'}`}>{hasDebt ? 'Є борг' : 'Боргів немає'}</p>
            <p className={`mt-2 text-3xl font-black ${hasDebt ? 'text-rose-700' : 'text-emerald-700'}`}>{money(client.debt_amount)}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">Кнопка нижче закриває борг у картці клієнта. Посилання на оплату можна скопіювати окремо.</p>
            <button type="button" disabled={debtBusy || !hasDebt} onClick={() => onCloseDebt?.(client)} className="mt-4 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2">
              <CreditCard size={16}/> {debtBusy ? 'Закриваємо...' : hasDebt ? 'Закрити борг' : 'Боргів немає'}
            </button>
            <button type="button" onClick={onPaymentLinkCopy} className="mt-2 w-full rounded-2xl bg-white border border-emerald-100 text-emerald-700 px-4 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2">
              <Copy size={15}/> Скопіювати реквізити
            </button>
          </div>
        </Panel>

        <Panel title="Авто / VIN" icon={<Car size={17} className="text-blue-600" />}>
          <Cars cars={cars.slice(0, 2)} compact onCopy={onCopy} />
        </Panel>

        <Panel title="Ризики" icon={<AlertTriangle size={17} className="text-amber-500" />}>
          <Insight text={debts.length ? `${debts.length} замовлень потребують контролю оплати.` : 'Боргів по клієнту не знайдено.'} />
          <Insight text={returns.length ? `${returns.length} позицій у поверненнях / браку.` : 'Повернень і браку немає.'} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-[28px] p-4 md:p-5 shadow-sm min-w-0">
      <h3 className="font-black uppercase text-sm text-slate-900 mb-4 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </section>
  );
}

function ProfileInfo({ label, value, icon }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 min-w-0">
      <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">{icon}{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900 break-words">{value}</p>
    </div>
  );
}

function PurchaseHistory({ orders, expandedOrders, toggleOrder, onSearchPart, onRepeatPart, busyRepeat, onCopy }) {
  if (!orders.length) return <Empty text="Історії покупок ще немає" />;
  return (
    <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm">
      <div className="hidden 2xl:grid grid-cols-[110px_90px_140px_minmax(220px,1fr)_120px_120px_48px] gap-3 px-4 py-3 bg-slate-100 text-[11px] font-black uppercase text-slate-500 tracking-wide">
        <span>Дата</span><span>№</span><span>Статус</span><span>Товари</span><span>Сума</span><span>Прибуток</span><span />
      </div>
      <div className="divide-y divide-slate-100">
        {orders.map((order) => {
          const open = expandedOrders.has(order.id);
          const parts = arr(order.parts);
          return (
            <div key={order.id} className="bg-white">
              <button type="button" onClick={() => toggleOrder(order.id)} className={`w-full text-left transition ${open ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-800'}`}>
                <div className="hidden 2xl:grid grid-cols-[110px_90px_140px_minmax(220px,1fr)_120px_120px_48px] gap-3 items-center px-4 py-3">
                  <span className="font-black text-sm">{fmtDate(order.scheduled_datetime || order.created_at)}</span>
                  <span className="font-black">№{order.id}</span>
                  <StatusChip status={order.status} invert={open} />
                  <span className={`text-xs font-bold truncate ${open ? 'text-blue-50' : 'text-slate-500'}`}>{parts.length ? parts.map((p) => `${p.brand || ''} ${p.article || ''}`.trim()).join(', ') : 'Товарів немає'}</span>
                  <span className="font-black">{money(order.revenue)}</span>
                  <span className={`font-black ${open ? 'text-emerald-100' : 'text-emerald-600'}`}>{money(order.profit)}</span>
                  <span className={`rounded-xl p-2 justify-self-end ${open ? 'bg-white/15' : 'bg-white border border-slate-200'}`}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                </div>
                <div className="2xl:hidden p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-lg">№{order.id} • {fmtDate(order.scheduled_datetime || order.created_at)}</p>
                      <p className={`text-xs font-bold mt-1 break-words ${open ? 'text-blue-50' : 'text-slate-500'}`}>{parts.length ? parts.map((p) => `${p.brand || ''} ${p.article || ''}`.trim()).join(', ') : 'Товарів немає'}</p>
                    </div>
                    <span className={`rounded-xl p-2 shrink-0 ${open ? 'bg-white/15' : 'bg-white border border-slate-200'}`}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3"><MiniPill invert={open}>{orderLabel[order.status] || order.status}</MiniPill><MiniPill invert={open}>{money(order.revenue)}</MiniPill><MiniPill invert={open}>+{money(order.profit)}</MiniPill></div>
                </div>
              </button>
              {open && (
                <div className="bg-slate-50 p-3 md:p-4">
                  <div className="hidden 2xl:grid grid-cols-[130px_minmax(220px,1fr)_120px_90px_90px_90px_110px] gap-3 px-3 py-2 text-[11px] font-black uppercase text-slate-400">
                    <span>Артикул</span><span>Назва</span><span>Постачальник</span><span>К-сть</span><span>Закупка</span><span>Продаж</span><span>Дія</span>
                  </div>
                  <div className="space-y-2">{parts.map((part) => <PartLine key={`${order.id}-${part.id}`} p={{ ...part, order_id: order.id }} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busy={busyRepeat === `${order.id}-${part.id}`} onCopy={onCopy} />)}{!parts.length && <Empty text="У замовленні немає товарів" />}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cars({ cars, onCopy, compact = false }) {
  const safeCars = arr(cars);
  if (!safeCars.length) return <Empty text="Авто не вказані" />;
  return (
    <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-2'} gap-3`}>
      {safeCars.map((car, idx) => {
        const title = [car.brand, car.model].filter(Boolean).join(' ') || car.name || car.car || 'Авто клієнта';
        return (
          <div key={`${car.plate || car.vin_code || idx}`} className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-sm min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-slate-900 flex items-center gap-2 min-w-0"><Car size={16} className="text-blue-600 shrink-0" /><span className="truncate">{car.plate || 'Без номера'}</span></p>
                <p className="text-sm font-bold text-slate-600 mt-2 break-words">{title}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {car.plate && <button type="button" onClick={() => onCopy?.(car.plate, 'Номер авто скопійовано.')} className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-slate-500 hover:text-blue-600" title="Копіювати номер авто"><Copy size={15}/></button>}
                {car.vin_code && <button type="button" onClick={() => onCopy?.(car.vin_code, 'VIN скопійовано.')} className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-slate-500 hover:text-blue-600" title="Копіювати VIN"><Copy size={15}/></button>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Mini label="VIN" value={car.vin_code || '—'} />
              {(car.mileage || car.odometer) && <Mini label="Пробіг" value={`${car.mileage || car.odometer}`} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Debts({ debts, onCloseDebt, debtBusy }) {
  if (!debts.length) return <Empty text="Боргів немає" />;
  return (
    <div className="space-y-3">
      {debts.map((order) => (
        <div key={order.id} className="bg-rose-50 border border-rose-100 rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-slate-900">Замовлення №{order.id}</p>
            <p className="text-xs font-bold text-slate-500 mt-1">{fmtDate(order.scheduled_datetime || order.created_at)} • {payLabel[order.payment_status] || order.payment_status} • {orderLabel[order.status] || order.status}</p>
          </div>
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <p className="font-black text-rose-600 text-xl">{money(order.debt_amount || order.revenue)}</p>
            <button type="button" disabled={debtBusy} onClick={() => onCloseDebt?.({ orders: [order], debt_amount: orderDebtAmount(order), key: order.client_key })} className="rounded-2xl bg-emerald-600 disabled:bg-slate-300 text-white px-4 py-3 text-xs font-black uppercase inline-flex items-center gap-2"><CreditCard size={15}/> {debtBusy ? 'Закриваємо...' : 'Закрити борг'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Returns({ returns, onCopy }) {
  if (!returns.length) return <Empty text="Повернень немає" />;
  return <div className="space-y-2">{returns.map((part) => <PartLine key={`${part.order_id}-${part.id}`} p={part} returnMode onCopy={onCopy} />)}</div>;
}

function PartLine({ p, returnMode, onSearchPart, onRepeatPart, busy, onCopy }) {
  const article = `${p.brand || ''} ${p.article || ''}`.trim() || p.article || 'Артикул';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSearchPart?.(p)}
              className="max-w-full font-black text-blue-700 hover:text-blue-900 underline decoration-dashed underline-offset-4 inline-flex items-center gap-1 text-left"
            >
              <span className="break-words">{article}</span>
              <ExternalLink size={13} className="shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onCopy?.(p.article || article, 'Артикул скопійовано.')}
              className="rounded-lg bg-blue-50 border border-blue-100 p-1.5 text-blue-600 hover:bg-blue-100"
              title="Копіювати артикул"
            >
              <Copy size={13} />
            </button>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-600 break-words">{p.name || 'Товар без назви'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{p.supplier || '—'}</span>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{p.quantity || 0} шт</span>
            {returnMode && (
              <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black uppercase text-rose-600">
                {p.stock_status === 'defective' ? 'Брак' : 'Повернено'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[90px_90px_110px] gap-2 lg:w-[310px] shrink-0">
          <ValuePill label="Закупка" value={money(p.buy_price)} />
          <ValuePill label="Продаж" value={money(p.revenue)} />
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-2 min-w-0">
            <p className="text-[10px] font-black uppercase text-emerald-600">Прибуток</p>
            <p className="mt-1 text-sm font-black text-emerald-700 truncate">+{money(p.profit)}</p>
          </div>
        </div>
      </div>

      {onRepeatPart && (
        <div className="mt-3 flex justify-end">
          <button
            disabled={busy}
            type="button"
            onClick={() => onRepeatPart(p)}
            className="w-full sm:w-auto bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-[11px] font-black uppercase inline-flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Repeat2 size={13} />
            {busy ? 'Додаємо...' : 'Повторити'}
          </button>
        </div>
      )}
    </div>
  );
}

function ValuePill({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-2 min-w-0">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900 truncate">{value}</p>
    </div>
  );
}

function EditClientModal({ form, setForm, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <form onSubmit={onSubmit} className="bg-white rounded-[30px] w-full max-w-3xl mx-auto my-4 sm:my-8 shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-slate-950 to-blue-700 text-white flex justify-between items-start gap-3">
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100 mb-1">CRM</p><h2 className="text-2xl md:text-3xl font-black uppercase">Картка покупця</h2><p className="text-sm font-bold text-blue-100 mt-1">Контакт і базове авто без сирих списків.</p></div>
          <button type="button" onClick={onClose} className="bg-white/10 border border-white/15 rounded-2xl p-2 text-white hover:bg-white/20"><X size={18}/></button>
        </div>
        <div className="p-5 md:p-6 space-y-4">
          <FormSection title="Покупець" desc="Контактні дані для продажів, боргів і повторних замовлень.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="ПІБ клієнта" value={form.client} onChange={(value) => setForm({ ...form, client: value })} required /><Field label="Телефон" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} required /></div>
          </FormSection>
          <FormSection title="Авто" desc="Номер і VIN можна оновити в активній картці або в усіх замовленнях клієнта.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Номер авто" value={form.plate} onChange={(value) => setForm({ ...form, plate: value.toUpperCase() })} />
              <Field label="VIN" value={form.vin_code} onChange={(value) => setForm({ ...form, vin_code: value.toUpperCase() })} />
            </div>
          </FormSection>
          <label className={`flex items-start gap-3 rounded-3xl border p-4 cursor-pointer transition ${form.overwrite_car ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`mt-0.5 h-6 w-6 rounded-lg border flex items-center justify-center ${form.overwrite_car ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-300'}`}>{form.overwrite_car ? '✓' : ''}</span>
            <input type="checkbox" checked={form.overwrite_car} onChange={(event) => setForm({ ...form, overwrite_car: event.target.checked })} className="sr-only" />
            <span><span className="block font-black text-slate-900">Оновити авто/VIN у всіх замовленнях</span><span className="block text-xs font-semibold text-slate-500 mt-1">Використовуйте тільки якщо потрібно змінити авто в історії старих замовлень.</span></span>
          </label>
        </div>
        <div className="p-5 md:p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black uppercase text-xs text-slate-700">Скасувати</button>
          <button className="bg-blue-600 text-white rounded-2xl px-5 py-3 font-black uppercase text-xs shadow-lg shadow-blue-100">Зберегти покупця</button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, desc, children }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-4"><div><h3 className="font-black uppercase tracking-[0.12em] text-sm text-slate-950">{title}</h3>{desc && <p className="text-sm font-bold text-slate-500 mt-1 leading-snug">{desc}</p>}</div>{children}</section>;
}

function Field({ label, value, onChange, required, placeholder }) {
  return <label className="block min-w-0"><span className="block text-[11px] font-black uppercase text-slate-500 mb-1.5">{label}</span><input required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full min-h-[46px] rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition" /></label>;
}

function Stat({ label, value, good, bad, dark }) {
  return <div className={`${dark ? 'bg-white/10 border-white/15' : 'bg-white border-slate-200'} border rounded-2xl p-3 shadow-sm min-w-0`}><p className={`${dark ? 'text-slate-300' : 'text-slate-400'} text-[11px] font-black uppercase`}>{label}</p><p className={`text-lg font-black mt-1 truncate ${good ? 'text-emerald-500' : bad ? 'text-rose-500' : dark ? 'text-white' : 'text-slate-900'}`}>{value}</p></div>;
}

function Mini({ label, value, bad }) {
  return <div className="bg-white border border-slate-100 rounded-xl p-2 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className={`text-xs font-black truncate ${bad ? 'text-rose-600' : 'text-slate-800'}`}>{value}</p></div>;
}

function MiniPill({ children, invert }) {
  return <span className={`${invert ? 'bg-white/15 text-white border-white/20' : 'bg-white text-slate-600 border-slate-200'} border rounded-lg px-2 py-1 text-[11px] font-black uppercase`}>{children}</span>;
}

function StatusChip({ status, invert }) {
  return <span className={`inline-flex w-fit px-3 py-1 rounded-xl border text-[11px] font-black uppercase ${invert ? 'bg-white/15 text-white border-white/20' : orderTone[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{orderLabel[status] || status}</span>;
}

function Badge({ status, dark }) {
  return <span className={`px-3 py-1 rounded-xl border text-[11px] font-black uppercase whitespace-nowrap ${dark ? 'bg-white/10 text-white border-white/15' : statusTone[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{status || 'Новий'}</span>;
}

function Insight({ text }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-bold text-slate-600 mb-2">{text}</div>;
}

function Empty({ text }) {
  return <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-black uppercase text-xs">{text}</div>;
}

function EmptyProfile() {
  return <div className="bg-white border border-slate-200 rounded-[34px] p-10 text-center shadow-sm"><UserRound className="mx-auto text-slate-300 mb-3" size={54}/><h3 className="font-black text-slate-800 uppercase">Оберіть покупця</h3><p className="text-sm font-bold text-slate-400 mt-2 max-w-md mx-auto">Тут буде професійна картка: історія покупок, авто, VIN, борги, оплата та повторний продаж.</p></div>;
}
