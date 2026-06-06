import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Car, ChevronDown, ChevronUp, CreditCard, Edit3, ExternalLink, History, Phone, RefreshCcw, Repeat2, Search, Star, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const arr = (v) => Array.isArray(v) ? v : [];
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const statusTone = { 'VIP': 'bg-violet-50 text-violet-700 border-violet-100', 'Борг': 'bg-rose-50 text-rose-700 border-rose-100', 'Проблемний': 'bg-amber-50 text-amber-700 border-amber-100', 'Постійний': 'bg-blue-50 text-blue-700 border-blue-100', 'Новий': 'bg-emerald-50 text-emerald-700 border-emerald-100' };
const payLabel = { unpaid: 'Не оплачено', prepaid: 'Передплата', paid: 'Оплачено', cod: 'Післяплата', debt: 'Борг' };
const orderLabel = { SELECTION: 'В обробці', ORDERED: 'Очікує товар', DONE: 'Готове', SHIPPED: 'Відправлено', COMPLETED: 'Виконано', CANCELLED: 'Скасовано' };
const orderTone = {
  SELECTION: 'bg-amber-50 text-amber-700 border-amber-100',
  ORDERED: 'bg-blue-50 text-blue-700 border-blue-100',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SHIPPED: 'bg-violet-50 text-violet-700 border-violet-100',
  COMPLETED: 'bg-green-50 text-green-700 border-green-100',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-100',
};

export default function ClientsCRM() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editClient, setEditClient] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [busyRepeat, setBusyRepeat] = useState(null);

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
    setTab('history');
    setExpandedOrders(new Set());
    try {
      const res = await api.get(`/api/store-clients/detail/?key=${encodeURIComponent(client.key)}`);
      setSelected(res.data);
      const firstOrder = arr(res.data?.orders)[0];
      if (firstOrder?.id) setExpandedOrders(new Set([firstOrder.id]));
    } catch {
      setMessage('Не вдалося відкрити картку клієнта.');
    }
  };

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

  const saveClient = async (e) => {
    e.preventDefault();
    if (!editClient) return;
    try {
      const res = await api.patch('/api/store-clients/update/', editClient);
      if (res.data?.client) {
        setSelected(res.data.client);
        setClients((prev) => prev.map((c) => c.key === editClient.key ? {
          ...c,
          key: res.data.client.key,
          client: res.data.client.client,
          phone: res.data.client.phone,
          orders_count: res.data.client.orders_count,
          total_revenue: res.data.client.total_revenue,
          total_profit: res.data.client.total_profit,
          debt_amount: res.data.client.debt_amount,
          cars: res.data.client.cars,
          status: res.data.client.status,
          last_order_date: res.data.client.last_order_date,
        } : c));
      }
      setEditClient(null);
      setMessage(`Картку клієнта оновлено. Змінено замовлень: ${res.data?.updated ?? 0}.`);
      load(search);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося оновити клієнта.');
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
      setMessage(res.data?.message || 'Товар додано в замовлення.');
      navigate(`/visits?visit_id=${res.data?.visit_id || ''}`);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося повторити продаж.');
    } finally {
      setBusyRepeat(null);
    }
  };

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitSearch = (e) => { e.preventDefault(); load(search); };

  return <div className="w-full max-w-none mx-auto p-4 md:p-6 2xl:p-8 md:pl-64 xl:pl-72 min-h-screen bg-slate-50/40">
    <div className="max-w-[1800px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><UserRound className="text-blue-600"/> Клієнти</h1>
          <p className="text-slate-500 font-semibold text-sm mt-1">Міні-CRM магазину: швидка історія покупок, повторний продаж, авто, борги та прибуток.</p>
        </div>
        <button onClick={() => load(search)} className="bg-white border border-blue-100 text-blue-700 rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-sm"><RefreshCcw size={16}/> Оновити</button>
      </div>

      {message && <div className="mb-5 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl p-3 font-bold text-sm flex justify-between gap-3 shadow-sm"><span>{message}</span><button onClick={()=>setMessage('')}><X size={16}/></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Клієнтів" value={totals.count}/><Stat label="Покупок" value={money(totals.revenue)}/><Stat label="Прибуток" value={money(totals.profit)} good/><Stat label="Борги" value={money(totals.debt)} bad={totals.debt > 0}/>
      </div>

      <form onSubmit={submitSearch} className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm mb-5 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Пошук: № замовлення, телефон, ПІБ, авто, VIN, артикул або товар..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"/></div>
        <button className="bg-blue-600 text-white rounded-xl px-6 py-3 text-xs font-black uppercase shadow-md shadow-blue-100">Знайти</button>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)] gap-5 items-start">
        <section className="bg-white border border-slate-200 rounded-3xl p-3 md:p-4 shadow-sm h-fit xl:sticky xl:top-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black uppercase text-slate-900">Список клієнтів</h2>
            <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{clients.length}</span>
          </div>
          <div className="space-y-3 max-h-none xl:max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {loading ? <Empty text="Завантаження..."/> : clients.map((c) => <ClientCard key={c.key} client={c} active={selected?.key === c.key} onClick={() => openClient(c)}/>) }
            {!loading && !clients.length && <Empty text="Клієнтів не знайдено"/>}
          </div>
        </section>

        <section className="hidden xl:block min-w-0 w-full">
          {selected ? <ClientDrawer client={selected} tab={tab} setTab={setTab} onEdit={() => openEdit(selected)} expandedOrders={expandedOrders} toggleOrder={toggleOrder} onSearchPart={openSearchByPart} onRepeatPart={repeatPart} busyRepeat={busyRepeat}/> : <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm"><UserRound className="mx-auto text-slate-300 mb-3" size={48}/><h3 className="font-black text-slate-800 uppercase">Оберіть клієнта</h3><p className="text-sm font-bold text-slate-400 mt-2">Тут буде історія покупок, товари, авто, борги та повернення.</p></div>}
        </section>
      </div>
    </div>

    {selected && <div className="xl:hidden fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm p-0 block">
      <div className="bg-white w-full h-screen overflow-hidden shadow-2xl rounded-none">
        <ClientDrawer client={selected} tab={tab} setTab={setTab} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} expandedOrders={expandedOrders} toggleOrder={toggleOrder} onSearchPart={openSearchByPart} onRepeatPart={repeatPart} busyRepeat={busyRepeat}/>
      </div>
    </div>}

    {editClient && <EditClientModal form={editClient} setForm={setEditClient} onClose={() => setEditClient(null)} onSubmit={saveClient}/>} 
  </div>;
}

function ClientCard({ client, active, onClick }) {
  const debt = Number(client.debt_amount || 0) > 0;
  return <button onClick={onClick} className={`w-full text-left rounded-2xl p-4 border transition relative overflow-hidden ${active ? 'bg-blue-50 border-blue-200 shadow-md shadow-blue-100' : 'bg-slate-50 border-slate-100 hover:border-blue-100 hover:bg-white'}`}>
    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${debt ? 'bg-rose-400' : active ? 'bg-blue-500' : 'bg-emerald-400'}`}/>
    <div className="flex justify-between gap-3 pl-1"><div><p className="font-black text-slate-900 leading-tight">{client.client || 'Без імені'}</p><p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1"><Phone size={12}/>{client.phone || '-'}</p></div><Badge status={client.status}/></div>
    <div className="grid grid-cols-3 gap-2 mt-3 pl-1"><Mini label="Зам." value={client.orders_count}/><Mini label="Сума" value={money(client.total_revenue)}/><Mini label="Борг" value={money(client.debt_amount)} bad={debt}/></div>
    <p className="text-[11px] font-bold text-slate-400 mt-3 pl-1">Останнє: {fmtDate(client.last_order_date)}</p>
  </button>;
}

function ClientDrawer({ client, tab, setTab, onClose, onEdit, expandedOrders, toggleOrder, onSearchPart, onRepeatPart, busyRepeat }) {
  const orders = arr(client.orders);
  const parts = arr(client.parts);
  const debts = orders.filter((o) => Number(o.debt_amount || 0) > 0 || ['unpaid', 'debt', 'cod'].includes(o.payment_status));
  const returns = parts.filter((p) => ['returned', 'defective'].includes(p.stock_status));
  return <div className="bg-white xl:border xl:border-slate-200 xl:rounded-3xl xl:shadow-sm overflow-hidden h-full xl:h-auto xl:max-h-none flex flex-col">
    <div className="h-2 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 shrink-0"/>
    <div className="p-4 md:p-5 border-b border-slate-100 bg-gradient-to-br from-white to-blue-50/40 shrink-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase leading-tight">{client.client || 'Без імені'}</h2>
            <button onClick={onEdit} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl p-2 shadow-sm" title="Редагувати клієнта"><Edit3 size={16}/></button>
          </div>
          <p className="text-sm font-bold text-slate-500 mt-1 flex items-center gap-2"><Phone size={15}/>{client.phone || '-'}</p>
        </div>
        <div className="flex items-center gap-2"><Badge status={client.status}/>{onClose && <button onClick={onClose} className="bg-slate-100 text-slate-500 rounded-xl p-2"><X size={18}/></button>}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><Stat label="Замовлень" value={client.orders_count}/><Stat label="Покупки" value={money(client.total_revenue)}/><Stat label="Прибуток" value={money(client.total_profit)} good/><Stat label="Борг" value={money(client.debt_amount)} bad={client.debt_amount > 0}/></div>
    </div>
    <Tabs active={tab} setActive={setTab}/>
    <div className="p-4 md:p-5 overflow-y-auto bg-slate-50/50 flex-1 xl:flex-none">
      {tab === 'overview' && <Overview client={client} orders={orders} parts={parts} debts={debts} returns={returns} onRepeatPart={onRepeatPart} onSearchPart={onSearchPart} busyRepeat={busyRepeat}/>} 
      {tab === 'history' && <PurchaseHistory orders={orders} expandedOrders={expandedOrders} toggleOrder={toggleOrder} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busyRepeat={busyRepeat}/>} 
      {tab === 'cars' && <Cars cars={arr(client.cars)}/>} 
      {tab === 'debts' && <Debts debts={debts}/>} 
      {tab === 'returns' && <Returns returns={returns}/>} 
    </div>
  </div>;
}

function EditClientModal({ form, setForm, onClose, onSubmit }) {
  return <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
    <form onSubmit={onSubmit} className="bg-white rounded-3xl w-full max-w-xl mx-auto my-8 p-5 md:p-6 shadow-2xl">
      <div className="flex justify-between items-start gap-3 mb-5"><div><h2 className="text-2xl font-black uppercase text-slate-900">Картка покупця</h2><p className="text-sm font-bold text-slate-500 mt-1">Заповніть ПІБ, телефон, авто та VIN для постійного клієнта.</p></div><button type="button" onClick={onClose} className="bg-slate-100 rounded-xl p-2 text-slate-500"><X size={18}/></button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="ПІБ клієнта" value={form.client} onChange={(v)=>setForm({...form, client:v})} required/>
        <Field label="Телефон" value={form.phone} onChange={(v)=>setForm({...form, phone:v})} required/>
        <Field label="Номер авто" value={form.plate} onChange={(v)=>setForm({...form, plate:v.toUpperCase()})}/>
        <Field label="VIN" value={form.vin_code} onChange={(v)=>setForm({...form, vin_code:v.toUpperCase()})}/>
      </div>
      <label className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3 text-sm font-bold text-amber-800"><input type="checkbox" checked={form.overwrite_car} onChange={(e)=>setForm({...form, overwrite_car:e.target.checked})} className="mt-1"/> Оновити авто/VIN у всіх замовленнях цього клієнта. Якщо не вмикати — авто заміниться тільки там, де був технічний номер ORDER/Sale або порожній VIN.</label>
      <button className="mt-5 w-full bg-blue-600 text-white rounded-xl p-4 font-black uppercase text-xs">Зберегти клієнта</button>
    </form>
  </div>;
}

function Field({ label, value, onChange, required }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">{label}</span><input required={required} value={value || ''} onChange={(e)=>onChange(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"/></label>; }

function Tabs({ active, setActive }) {
  const tabs = [['overview', Star, 'Огляд'], ['history', History, 'Історія покупок'], ['cars', Car, 'Авто'], ['debts', CreditCard, 'Борги'], ['returns', AlertTriangle, 'Повернення']];
  return <div className="bg-white border-b border-slate-100 p-2 grid grid-cols-2 md:grid-cols-5 gap-2 sticky top-0 z-10 shrink-0 overflow-x-auto">{tabs.map(([key, Icon, label]) => <button key={key} onClick={()=>setActive(key)} className={`rounded-2xl p-3 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition ${active === key ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}><Icon size={14}/>{label}</button>)}</div>;
}

function Overview({ client, orders, parts, debts, returns, onRepeatPart, onSearchPart, busyRepeat }) {
  const lastOrder = orders[0];
  const lastPart = parts[0];
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Panel title="Швидкі висновки"><Insight text={`Клієнт має ${client.orders_count || 0} замовлень.`}/><Insight text={`Останнє замовлення: ${fmtDate(client.last_order_date)}.`}/><Insight text={client.debt_amount > 0 ? `Є борг: ${money(client.debt_amount)}.` : 'Боргів немає.'}/><Insight text={returns.length ? `Повернень: ${returns.length}.` : 'Повернень немає.'}/></Panel>
    <Panel title="Швидкий повторний продаж">
      {lastPart ? <PartLine p={lastPart} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busy={busyRepeat === `${lastPart.order_id}-${lastPart.id}`}/> : <Empty text="Ще немає товарів для повтору"/>}
      {lastOrder && <button onClick={() => onRepeatPart(lastPart)} disabled={!lastPart || busyRepeat === `${lastPart?.order_id}-${lastPart?.id}`} className="mt-3 w-full bg-emerald-600 text-white rounded-xl p-3 text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-40"><Repeat2 size={16}/> Повторити останню покупку</button>}
    </Panel>
    <Panel title="Авто / VIN">{arr(client.cars).map((c, i)=><div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-2"><p className="font-black text-slate-900">{c.plate || 'Без номера'}</p><p className="text-xs font-bold text-slate-500 break-all">{c.vin_code || 'VIN не вказано'}</p></div>)}{!arr(client.cars).length && <Empty text="Авто не вказані"/>}</Panel>
    <Panel title="Борги">{debts.slice(0, 5).map((o)=><OrderLine key={o.id} order={o}/>)}{!debts.length && <Empty text="Боргів немає"/>}</Panel>
  </div>;
}

function PurchaseHistory({ orders, expandedOrders, toggleOrder, onSearchPart, onRepeatPart, busyRepeat }) {
  if (!orders.length) return <Empty text="Історії покупок ще немає"/>;
  return <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
    <div className="hidden md:grid grid-cols-[100px_72px_130px_minmax(160px,1fr)_100px_100px_42px] xl:grid-cols-[110px_90px_140px_minmax(220px,1fr)_120px_120px_46px] gap-3 px-4 py-3 bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wide">
      <span>Дата</span><span>№</span><span>Статус</span><span>Товари</span><span>Сума</span><span>Прибуток</span><span></span>
    </div>
    <div className="divide-y divide-slate-100">
      {orders.map((order) => {
        const open = expandedOrders.has(order.id);
        const parts = arr(order.parts);
        return <div key={order.id} className="bg-white">
          <button onClick={() => toggleOrder(order.id)} className={`w-full text-left transition ${open ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-slate-800'}`}>
            <div className="hidden md:grid grid-cols-[100px_72px_130px_minmax(160px,1fr)_100px_100px_42px] xl:grid-cols-[110px_90px_140px_minmax(220px,1fr)_120px_120px_46px] gap-3 items-center px-4 py-3">
              <span className="font-black text-sm">{fmtDate(order.scheduled_datetime || order.created_at)}</span>
              <span className="font-black">№{order.id}</span>
              <StatusChip status={order.status} invert={open}/>
              <span className={`text-xs font-bold truncate ${open ? 'text-blue-50' : 'text-slate-500'}`}>{parts.length ? parts.map((p)=>`${p.brand} ${p.article}`).join(', ') : 'Товарів немає'}</span>
              <span className="font-black">{money(order.revenue)}</span>
              <span className={`font-black ${open ? 'text-emerald-100' : 'text-emerald-600'}`}>{money(order.profit)}</span>
              <span className={`rounded-xl p-2 justify-self-end ${open ? 'bg-white/15' : 'bg-white border border-slate-200'}`}>{open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</span>
            </div>
            <div className="md:hidden p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-lg">№{order.id} • {fmtDate(order.scheduled_datetime || order.created_at)}</p>
                  <p className={`text-xs font-bold mt-1 ${open ? 'text-blue-50' : 'text-slate-500'}`}>{parts.length ? parts.map((p)=>`${p.brand} ${p.article}`).join(', ') : 'Товарів немає'}</p>
                </div>
                <span className={`rounded-xl p-2 ${open ? 'bg-white/15' : 'bg-white border border-slate-200'}`}>{open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3"><MiniPill invert={open}>{orderLabel[order.status] || order.status}</MiniPill><MiniPill invert={open}>{money(order.revenue)}</MiniPill><MiniPill invert={open}>+{money(order.profit)}</MiniPill></div>
            </div>
          </button>
          {open && <div className="bg-slate-50 p-3 md:p-4">
            <div className="hidden md:grid grid-cols-[120px_minmax(170px,1fr)_110px_70px_80px_90px_96px] xl:grid-cols-[130px_minmax(220px,1fr)_120px_90px_90px_90px_110px] gap-3 px-3 py-2 text-[10px] font-black uppercase text-slate-400">
              <span>Артикул</span><span>Назва</span><span>Постачальник</span><span>К-сть</span><span>Закупка</span><span>Продаж</span><span>Дія</span>
            </div>
            <div className="space-y-2">
              {parts.map((p) => <PartLine key={`${order.id}-${p.id}`} p={{...p, order_id: order.id}} onSearchPart={onSearchPart} onRepeatPart={onRepeatPart} busy={busyRepeat === `${order.id}-${p.id}`}/>) }
              {!parts.length && <Empty text="У замовленні немає товарів"/>}
            </div>
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function Cars({ cars }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{cars.map((c,i)=><div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"><p className="font-black text-slate-900 flex items-center gap-2"><Car size={16}/>{c.plate || 'Без номера'}</p><p className="text-xs font-bold text-slate-500 mt-2 break-all">VIN: {c.vin_code || '-'}</p></div>)}{!cars.length && <Empty text="Авто не вказані"/>}</div>; }
function Debts({ debts }) { return <Table headers={['Дата', '№', 'Сума', 'Оплата', 'Статус']} rows={debts.map(o=>[fmtDate(o.scheduled_datetime || o.created_at), `№${o.id}`, money(o.debt_amount || o.revenue), payLabel[o.payment_status] || o.payment_status, orderLabel[o.status] || o.status])}/>; }
function Returns({ returns }) { return <div className="space-y-2">{returns.map((p)=><PartLine key={`${p.order_id}-${p.id}`} p={p} returnMode/>)}{!returns.length && <Empty text="Повернень немає"/>}</div>; }

function PartLine({ p, returnMode, onSearchPart, onRepeatPart, busy }) { return <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm md:grid md:grid-cols-[120px_minmax(170px,1fr)_110px_70px_80px_90px_96px] xl:grid-cols-[130px_minmax(220px,1fr)_120px_90px_90px_90px_110px] md:items-center md:gap-3 flex flex-col gap-3"><div><button onClick={()=>onSearchPart?.(p)} className="font-black text-blue-700 hover:text-blue-900 underline decoration-dashed underline-offset-4 flex items-center gap-1 text-left"><span>{p.brand} {p.article}</span><ExternalLink size={13}/></button>{returnMode && <p className="text-[10px] font-black uppercase text-rose-600 mt-1">{p.stock_status === 'defective' ? 'Брак' : 'Повернено'}</p>}</div><p className="text-xs font-bold text-slate-600">{p.name}</p><p className="text-xs font-black text-slate-500 uppercase">{p.supplier || '-'}</p><p className="font-black text-slate-800">{p.quantity} шт</p><p className="font-black text-slate-700">{money(p.buy_price)}</p><div><p className="font-black text-slate-900">{money(p.revenue)}</p><p className="text-xs font-black text-emerald-600">+{money(p.profit)}</p></div>{onRepeatPart && <button disabled={busy} onClick={()=>onRepeatPart(p)} className="bg-emerald-600 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase flex items-center justify-center gap-1 disabled:opacity-40"><Repeat2 size={13}/>{busy ? '...' : 'Повторити'}</button>}</div>; }
function OrderLine({ order }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex justify-between gap-3"><div><p className="font-black text-slate-900">Замовлення №{order.id}</p><p className="text-xs font-bold text-slate-500">{fmtDate(order.scheduled_datetime || order.created_at)} • {payLabel[order.payment_status] || order.payment_status}</p></div><p className="font-black text-rose-600">{money(order.debt_amount || order.revenue)}</p></div>; }
function Table({ headers, rows }) { if (!rows.length) return <Empty text="Даних немає"/>; return <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl shadow-sm"><table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-[10px] font-black uppercase text-slate-400 border-b bg-slate-50">{headers.map(h=><th key={h} className="py-3 px-3">{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-b border-slate-100 hover:bg-slate-50">{r.map((c,j)=><td key={j} className="py-3 px-3 font-bold text-slate-700">{c}</td>)}</tr>)}</tbody></table></div>; }
function Stat({ label, value, good, bad }) { return <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className={`text-lg font-black mt-1 ${good ? 'text-emerald-600' : bad ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>; }
function Mini({ label, value, bad }) { return <div className="bg-white border border-slate-100 rounded-xl p-2"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`text-xs font-black ${bad ? 'text-rose-600' : 'text-slate-800'}`}>{value}</p></div>; }
function MiniPill({ children, invert }) { return <span className={`${invert ? 'bg-white/15 text-white border-white/20' : 'bg-white text-slate-600 border-slate-200'} border rounded-lg px-2 py-1 text-[10px] font-black uppercase`}>{children}</span>; }
function StatusChip({ status, invert }) { return <span className={`inline-flex w-fit px-3 py-1 rounded-xl border text-[10px] font-black uppercase ${invert ? 'bg-white/15 text-white border-white/20' : orderTone[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{orderLabel[status] || status}</span>; }
function Panel({ title, children }) { return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"><h3 className="font-black uppercase text-sm text-slate-900 mb-3">{title}</h3>{children}</div>; }
function Badge({ status }) { return <span className={`px-3 py-1 rounded-xl border text-[10px] font-black uppercase whitespace-nowrap ${statusTone[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{status || 'Новий'}</span>; }
function Insight({ text }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-bold text-slate-600 mb-2">{text}</div>; }
function Empty({ text }) { return <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-black uppercase text-xs">{text}</div>; }
