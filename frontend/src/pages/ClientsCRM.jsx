import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Car, CreditCard, History, PackageSearch, Phone, RefreshCcw, Search, ShoppingBag, Star, UserRound, X } from 'lucide-react';
import api from '../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const arr = (v) => Array.isArray(v) ? v : [];
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const statusTone = { 'VIP': 'bg-violet-50 text-violet-700 border-violet-100', 'Борг': 'bg-rose-50 text-rose-700 border-rose-100', 'Проблемний': 'bg-amber-50 text-amber-700 border-amber-100', 'Постійний': 'bg-blue-50 text-blue-700 border-blue-100', 'Новий': 'bg-emerald-50 text-emerald-700 border-emerald-100' };
const payLabel = { unpaid: 'Не оплачено', prepaid: 'Передплата', paid: 'Оплачено', cod: 'Післяплата', debt: 'Борг' };
const orderLabel = { SELECTION: 'В обробці', ORDERED: 'Очікує товар', DONE: 'Готове', SHIPPED: 'Відправлено', COMPLETED: 'Виконано', CANCELLED: 'Скасовано' };

export default function ClientsCRM() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async (query = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/store-clients/${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setClients(arr(res.data?.results));
    } catch (error) {
      setMessage('Не вдалося завантажити клієнтів.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const totals = useMemo(() => clients.reduce((a, c) => {
    a.count += 1;
    a.revenue += Number(c.total_revenue || 0);
    a.profit += Number(c.total_profit || 0);
    a.debt += Number(c.debt_amount || 0);
    return a;
  }, { count: 0, revenue: 0, profit: 0, debt: 0 }), [clients]);

  const openClient = async (client) => {
    setSelected(client);
    setTab('overview');
    try {
      const res = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      setSelected(res.data);
    } catch {
      setMessage('Не вдалося відкрити картку клієнта.');
    }
  };

  const submitSearch = (e) => { e.preventDefault(); load(search); };

  return <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><UserRound className="text-blue-600"/> Клієнти</h1>
        <p className="text-slate-500 font-semibold text-sm mt-1">Міні-CRM магазину: історія покупок, авто, борги, повернення та прибуток.</p>
      </div>
      <button onClick={() => load(search)} className="bg-white border border-blue-100 text-blue-700 rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center justify-center gap-2"><RefreshCcw size={16}/> Оновити</button>
    </div>

    {message && <div className="mb-5 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl p-3 font-bold text-sm flex justify-between"><span>{message}</span><button onClick={()=>setMessage('')}><X size={16}/></button></div>}

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <Stat label="Клієнтів" value={totals.count}/><Stat label="Покупок" value={money(totals.revenue)}/><Stat label="Прибуток" value={money(totals.profit)} good/><Stat label="Борги" value={money(totals.debt)} bad={totals.debt > 0}/>
    </div>

    <form onSubmit={submitSearch} className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm mb-5 flex flex-col md:flex-row gap-3">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Пошук: телефон, ПІБ, номер авто, VIN, артикул або товар..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"/></div>
      <button className="bg-blue-600 text-white rounded-xl px-6 py-3 text-xs font-black uppercase">Знайти</button>
    </form>

    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
      <section className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm h-fit">
        <h2 className="font-black uppercase text-slate-900 mb-3">Список клієнтів</h2>
        <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {loading ? <Empty text="Завантаження..."/> : clients.map((c) => <ClientCard key={c.key} client={c} active={selected?.key === c.key} onClick={() => openClient(c)}/>) }
          {!loading && !clients.length && <Empty text="Клієнтів не знайдено"/>}
        </div>
      </section>
      <section className="min-w-0">
        {selected ? <ClientDrawer client={selected} tab={tab} setTab={setTab}/> : <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm"><UserRound className="mx-auto text-slate-300 mb-3" size={48}/><h3 className="font-black text-slate-800 uppercase">Оберіть клієнта</h3><p className="text-sm font-bold text-slate-400 mt-2">Тут буде історія замовлень, товари, авто, борги та повернення.</p></div>}
      </section>
    </div>
  </div>;
}

function ClientCard({ client, active, onClick }) {
  return <button onClick={onClick} className={`w-full text-left rounded-2xl p-4 border transition ${active ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 hover:border-blue-100'}`}>
    <div className="flex justify-between gap-3"><div><p className="font-black text-slate-900">{client.client || 'Без імені'}</p><p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1"><Phone size={12}/>{client.phone || '-'}</p></div><Badge status={client.status}/></div>
    <div className="grid grid-cols-3 gap-2 mt-3"><Mini label="Зам." value={client.orders_count}/><Mini label="Сума" value={money(client.total_revenue)}/><Mini label="Борг" value={money(client.debt_amount)} bad={client.debt_amount > 0}/></div>
    <p className="text-[11px] font-bold text-slate-400 mt-3">Останнє: {fmtDate(client.last_order_date)}</p>
  </button>;
}

function ClientDrawer({ client, tab, setTab }) {
  const parts = arr(client.parts);
  const orders = arr(client.orders);
  const debts = orders.filter((o) => Number(o.debt_amount || 0) > 0 || ['unpaid', 'debt', 'cod'].includes(o.payment_status));
  const returns = parts.filter((p) => ['returned', 'defective'].includes(p.stock_status));
  return <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
    <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div><h2 className="text-2xl font-black text-slate-900 uppercase">{client.client || 'Без імені'}</h2><p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2"><Phone size={15}/>{client.phone || '-'}</p></div>
        <Badge status={client.status}/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><Stat label="Замовлень" value={client.orders_count}/><Stat label="Покупки" value={money(client.total_revenue)}/><Stat label="Прибуток" value={money(client.total_profit)} good/><Stat label="Борг" value={money(client.debt_amount)} bad={client.debt_amount > 0}/></div>
    </div>
    <Tabs active={tab} setActive={setTab}/>
    <div className="p-4 md:p-5">
      {tab === 'overview' && <Overview client={client} parts={parts} debts={debts} returns={returns}/>} 
      {tab === 'orders' && <Orders orders={orders}/>} 
      {tab === 'parts' && <Parts parts={parts}/>} 
      {tab === 'cars' && <Cars cars={arr(client.cars)}/>} 
      {tab === 'debts' && <Debts debts={debts}/>} 
      {tab === 'returns' && <Returns returns={returns}/>} 
    </div>
  </div>;
}

function Tabs({ active, setActive }) {
  const tabs = [['overview', Star, 'Огляд'], ['orders', History, 'Замовлення'], ['parts', PackageSearch, 'Товари'], ['cars', Car, 'Авто'], ['debts', CreditCard, 'Борги'], ['returns', AlertTriangle, 'Повернення']];
  return <div className="bg-slate-100 p-1 grid grid-cols-2 md:grid-cols-6 gap-1 sticky top-0 z-10">{tabs.map(([key, Icon, label]) => <button key={key} onClick={()=>setActive(key)} className={`rounded-xl p-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 ${active === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white'}`}><Icon size={14}/>{label}</button>)}</div>;
}

function Overview({ client, parts, debts, returns }) {
  const topParts = parts.slice(0, 5);
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Panel title="Швидкі висновки"><Insight text={`Клієнт має ${client.orders_count || 0} замовлень.`}/><Insight text={`Останнє замовлення: ${fmtDate(client.last_order_date)}.`}/><Insight text={client.debt_amount > 0 ? `Є борг: ${money(client.debt_amount)}.` : 'Боргів немає.'}/><Insight text={returns.length ? `Повернень: ${returns.length}.` : 'Повернень немає.'}/></Panel>
    <Panel title="Останні товари">{topParts.map((p) => <PartLine key={`${p.order_id}-${p.id}`} p={p}/>)}{!topParts.length && <Empty text="Товарів ще немає"/>}</Panel>
    <Panel title="Авто / VIN">{arr(client.cars).map((c, i)=><div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-2"><p className="font-black text-slate-900">{c.plate || 'Без номера'}</p><p className="text-xs font-bold text-slate-500 break-all">{c.vin_code || 'VIN не вказано'}</p></div>)}{!arr(client.cars).length && <Empty text="Авто не вказані"/>}</Panel>
    <Panel title="Борги">{debts.slice(0, 5).map((o)=><OrderLine key={o.id} order={o}/>)}{!debts.length && <Empty text="Боргів немає"/>}</Panel>
  </div>;
}
function Orders({ orders }) { return <Table headers={['Дата', '№', 'Статус', 'Сума', 'Прибуток', 'Оплата']} rows={orders.map(o=>[fmtDate(o.scheduled_datetime || o.created_at), `№${o.id}`, orderLabel[o.status] || o.status, money(o.revenue), money(o.profit), payLabel[o.payment_status] || o.payment_status])}/>; }
function Parts({ parts }) { return <div className="space-y-2">{parts.map((p)=><PartLine key={`${p.order_id}-${p.id}`} p={p}/>)}{!parts.length && <Empty text="Товарів немає"/>}</div>; }
function Cars({ cars }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{cars.map((c,i)=><div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="font-black text-slate-900 flex items-center gap-2"><Car size={16}/>{c.plate || 'Без номера'}</p><p className="text-xs font-bold text-slate-500 mt-2 break-all">VIN: {c.vin_code || '-'}</p></div>)}{!cars.length && <Empty text="Авто не вказані"/>}</div>; }
function Debts({ debts }) { return <Table headers={['Дата', '№', 'Сума', 'Оплата', 'Статус']} rows={debts.map(o=>[fmtDate(o.scheduled_datetime || o.created_at), `№${o.id}`, money(o.debt_amount || o.revenue), payLabel[o.payment_status] || o.payment_status, orderLabel[o.status] || o.status])}/>; }
function Returns({ returns }) { return <div className="space-y-2">{returns.map((p)=><PartLine key={`${p.order_id}-${p.id}`} p={p} returnMode/>)}{!returns.length && <Empty text="Повернень немає"/>}</div>; }

function PartLine({ p, returnMode }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p className="font-black text-slate-900">{p.brand} {p.article}</p><p className="text-xs font-bold text-slate-500">{p.name} • {p.quantity} шт • Замовлення №{p.order_id}</p>{returnMode && <p className="text-[10px] font-black uppercase text-rose-600 mt-1">{p.stock_status === 'defective' ? 'Брак / не повернуто на склад' : 'Повернено на склад'}</p>}</div><div className="text-right"><p className="font-black text-slate-900">{money(p.revenue)}</p><p className="text-xs font-black text-emerald-600">+{money(p.profit)}</p></div></div>; }
function OrderLine({ order }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex justify-between gap-3"><div><p className="font-black text-slate-900">Замовлення №{order.id}</p><p className="text-xs font-bold text-slate-500">{fmtDate(order.scheduled_datetime || order.created_at)} • {payLabel[order.payment_status] || order.payment_status}</p></div><p className="font-black text-rose-600">{money(order.debt_amount || order.revenue)}</p></div>; }
function Table({ headers, rows }) { if (!rows.length) return <Empty text="Даних немає"/>; return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-[10px] font-black uppercase text-slate-400 border-b">{headers.map(h=><th key={h} className="py-3 px-2">{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-b border-slate-100 hover:bg-slate-50">{r.map((c,j)=><td key={j} className="py-3 px-2 font-bold text-slate-700">{c}</td>)}</tr>)}</tbody></table></div>; }
function Stat({ label, value, good, bad }) { return <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className={`text-lg font-black mt-1 ${good ? 'text-emerald-600' : bad ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>; }
function Mini({ label, value, bad }) { return <div className="bg-white border border-slate-100 rounded-xl p-2"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`text-xs font-black ${bad ? 'text-rose-600' : 'text-slate-800'}`}>{value}</p></div>; }
function Panel({ title, children }) { return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"><h3 className="font-black uppercase text-sm text-slate-900 mb-3">{title}</h3>{children}</div>; }
function Badge({ status }) { return <span className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase whitespace-nowrap ${statusTone[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{status || 'Новий'}</span>; }
function Insight({ text }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-bold text-slate-600 mb-2">{text}</div>; }
function Empty({ text }) { return <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-black uppercase text-xs">{text}</div>; }
