import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, PackageCheck, Plus, Printer, Search, Send, Truck, X, XCircle } from 'lucide-react';
import api from '../api/axios';

const emptyOrder = {
  client: '',
  phone: '',
  plate: '',
  vin_code: '',
  source: 'Телефон',
  delivery_type: 'pickup',
  city: '',
  warehouse: '',
  recipient: '',
  recipient_phone: '',
  ttn: '',
  payment_status: 'unpaid',
  comment: '',
};

const emptyPart = { name: '', brand: '', article: '', supplier: '', buy_price: '', sell_price: '', quantity: 1, status: 'WAITING' };
const arr = (value) => Array.isArray(value) ? value : [];
const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const qty = (value) => Number(value || 1).toLocaleString('uk-UA', { maximumFractionDigits: 2 }).replace(',00', '');
const dateISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const humanDate = (value) => {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? 'Сьогодні' : d.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'long' });
};
const shiftDate = (value, days) => {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateISO(d);
};

const parseDelivery = (order) => {
  if (!order?.delivery_data || typeof order.delivery_data !== 'string' || !order.delivery_data.trim().startsWith('{')) return {};
  try { return JSON.parse(order.delivery_data) || {}; } catch { return {}; }
};

const orderDateText = (order) => {
  const d = new Date(order.scheduled_datetime || order.created_at || order.updated_at || Date.now());
  return Number.isNaN(d.getTime()) ? 'Без дати' : d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const paymentLabel = {
  unpaid: 'Не оплачено',
  prepaid: 'Передплата',
  paid: 'Оплачено',
  cod: 'Післяплата',
  debt: 'Борг',
};

const boardColumns = [
  { key: 'processing', title: 'В обробці', icon: Clock, tone: 'amber', match: (o) => ['SELECTION', 'PENDING', 'DRAFT'].includes(o.status) },
  { key: 'waiting', title: 'Очікує товар', icon: Truck, tone: 'blue', match: (o) => ['IN_PROGRESS', 'ORDERED'].includes(o.status) },
  { key: 'ready', title: 'Готове / Відправлено', icon: Send, tone: 'indigo', match: (o) => o.status === 'DONE' },
  { key: 'completed', title: 'Виконано', icon: CheckCircle2, tone: 'emerald', match: (o) => o.status === 'COMPLETED' },
];

const columnStyle = {
  amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
  blue: 'border-blue-200 bg-blue-50/70 text-blue-700',
  indigo: 'border-indigo-200 bg-indigo-50/70 text-indigo-700',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
};

const iconStyle = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

const nextStatus = (order) => {
  const parts = arr(order.parts);
  if (!parts.length) return 'SELECTION';
  const active = parts.filter((p) => (p.status || 'WAITING') !== 'UNAVAILABLE');
  if (active.length && active.every((p) => (p.status || 'WAITING') === 'ARRIVED')) return 'DONE';
  if (parts.some((p) => ['WAITING', 'IN_TRANSIT'].includes(p.status || 'WAITING'))) return 'ORDERED';
  return order.status || 'SELECTION';
};

export default function StoreOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState(dateISO());
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [orderForm, setOrderForm] = useState({ ...emptyOrder });
  const [partForm, setPartForm] = useState({ ...emptyPart });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/visits/?date=${filterDate}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMessage('Не вдалося завантажити замовлення.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterDate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((order) => {
      const d = parseDelivery(order);
      const text = [`№${order.id}`, String(order.id), order.client, order.phone, order.plate, order.vin_code, order.comment, d.source, d.city, d.warehouse, d.ttn, ...arr(order.parts).flatMap((p) => [p.brand, p.article, p.name, p.supplier])]
        .filter(Boolean).join(' ').toLowerCase();
      return !q || text.includes(q.replace('№', '')) || text.includes(q);
    });
  }, [orders, search]);

  const groups = useMemo(() => boardColumns.map((column) => ({ ...column, orders: filtered.filter(column.match) })), [filtered]);
  const totalOrders = filtered.length;

  const openNewOrder = () => {
    setOrderForm({ ...emptyOrder });
    setModal('order');
  };

  const createOrder = async (e) => {
    e.preventDefault();
    setBusy(true);
    const delivery = {
      source: orderForm.source,
      city: orderForm.city,
      warehouse: orderForm.warehouse,
      recipient: orderForm.recipient,
      recipient_phone: orderForm.recipient_phone,
      ttn: orderForm.ttn,
      mode: 'store',
    };
    const payload = {
      client: orderForm.client.trim(),
      phone: orderForm.phone.trim(),
      plate: (orderForm.plate || `ORDER-${Date.now()}`).trim().toUpperCase(),
      vin_code: orderForm.vin_code.trim().toUpperCase() || null,
      status: 'SELECTION',
      delivery_type: orderForm.delivery_type,
      delivery_data: JSON.stringify(delivery),
      payment_status: orderForm.payment_status,
      prepayment_amount: 0,
      comment: orderForm.comment,
      scheduled_datetime: new Date(`${filterDate}T12:00:00`).toISOString(),
    };
    try {
      const res = await api.post('/api/visits/', payload);
      setOrders((prev) => [res.data, ...prev]);
      setSelected(res.data);
      setModal(null);
      setMessage('Замовлення створено. Додайте товари.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося створити замовлення.');
    } finally {
      setBusy(false);
    }
  };

  const refreshSelected = async (id = selected?.id) => {
    if (!id) return;
    try {
      const res = await api.get(`/api/visits/${id}/`);
      setSelected(res.data);
      setOrders((prev) => prev.map((o) => o.id === res.data.id ? res.data : o));
    } catch {
      load();
    }
  };

  const addPart = async (e) => {
    e.preventDefault();
    if (!selected?.id) return;
    setBusy(true);
    try {
      await api.post('/api/order-parts/', {
        visit: selected.id,
        name: partForm.name.trim(),
        brand: (partForm.brand || 'Без бренду').trim(),
        article: (partForm.article || 'manual').trim(),
        supplier: (partForm.supplier || 'Ручне додавання').trim(),
        buy_price: Number(String(partForm.buy_price || 0).replace(',', '.')) || 0,
        sell_price: Number(String(partForm.sell_price || 0).replace(',', '.')) || 0,
        quantity: Number(String(partForm.quantity || 1).replace(',', '.')) || 1,
        status: partForm.status || 'WAITING',
      });
      setPartForm({ ...emptyPart });
      await refreshSelected();
      setMessage('Товар додано до замовлення.');
    } catch {
      setMessage('Не вдалося додати товар.');
    } finally {
      setBusy(false);
    }
  };

  const patchOrder = async (payload) => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      const res = await api.patch(`/api/visits/${selected.id}/`, payload);
      setSelected(res.data);
      setOrders((prev) => prev.map((o) => o.id === res.data.id ? res.data : o));
    } catch {
      setMessage('Не вдалося оновити замовлення.');
    } finally {
      setBusy(false);
    }
  };

  const updatePartStatus = async (part, status) => {
    setBusy(true);
    try {
      await api.patch(`/api/order-parts/${part.id}/`, { status });
      await refreshSelected();
    } catch {
      setMessage('Не вдалося змінити статус товару.');
    } finally {
      setBusy(false);
    }
  };

  const autoMove = async () => {
    if (!selected) return;
    const status = nextStatus(selected);
    await patchOrder({ status });
    setMessage(status === 'DONE' ? 'Усі товари отримано. Замовлення готове до видачі.' : 'Статус замовлення оновлено.');
  };

  const printReceipt = (order) => {
    const delivery = parseDelivery(order);
    const parts = arr(order.parts);
    const total = parts.reduce((s, p) => s + Number(p.sell_price || 0) * Number(p.quantity || 1), 0);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><meta charset="utf-8"><title>Товарний чек №${order.id}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{margin:0 0 8px}.muted{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f3f4f6}.right{text-align:right}.total{font-size:20px;font-weight:700;text-align:right;margin-top:18px}.footer{margin-top:40px;text-align:center;color:#777;font-size:12px}</style>
      </head><body onload="window.print()"><h1>Товарний чек №${order.id}</h1><div class="muted">Дата: ${new Date().toLocaleString('uk-UA')}</div>
      <div class="grid"><div><b>Покупець:</b> ${order.client || '-'}<br><b>Телефон:</b> ${order.phone || '-'}</div><div><b>Доставка:</b> ${order.delivery_type === 'nova_poshta' ? 'Нова пошта' : 'Самовивіз'}<br><b>ТТН:</b> ${delivery.ttn || '-'}<br><b>Оплата:</b> ${paymentLabel[order.payment_status] || order.payment_status || '-'}</div></div>
      <table><thead><tr><th>Бренд</th><th>Артикул</th><th>Назва</th><th>К-сть</th><th class="right">Ціна</th><th class="right">Сума</th></tr></thead><tbody>
      ${parts.map((p) => `<tr><td>${p.brand || ''}</td><td>${p.article || ''}</td><td>${p.name || ''}</td><td>${qty(p.quantity)}</td><td class="right">${money(p.sell_price)}</td><td class="right">${money(Number(p.sell_price || 0) * Number(p.quantity || 1))}</td></tr>`).join('') || '<tr><td colspan="6" class="right">Товари не додані</td></tr>'}
      </tbody></table><div class="total">Разом: ${money(total)}</div><div class="footer">Дякуємо за покупку!</div></body></html>
    `);
    w.document.close();
  };

  const copyTtn = async () => {
    const ttn = parseDelivery(selected).ttn;
    if (!ttn) return;
    try { await navigator.clipboard.writeText(ttn); setMessage('ТТН скопійовано.'); } catch { window.prompt('Скопіюйте ТТН:', ttn); }
  };

  return <div className="max-w-[1600px] mx-auto p-3 md:p-8 md:pl-72 min-h-screen overflow-x-hidden pb-24">
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3"><PackageCheck className="text-blue-600"/> Дошка замовлень</h1>
        <p className="text-slate-500 font-semibold mt-1 text-sm md:text-base">Магазин автозапчастин: замовлення за день, товари, склад, доставка та чек.</p>
      </div>
      <button onClick={openNewOrder} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-100"><Plus size={16}/> Нове замовлення</button>
    </div>

    {message && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between gap-3"><span>{message}</span><button onClick={() => setMessage('')}><XCircle size={16}/></button></div>}

    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-3 sm:p-4 mb-5 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по № замовлення, клієнту, телефону, ТТН, артикулу, бренду..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-bold text-slate-800 placeholder:text-slate-400" /></div>
      <div className="flex items-center justify-between xl:justify-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2">
        <button onClick={() => setFilterDate(shiftDate(filterDate, -1))} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50"><ChevronLeft size={16}/></button>
        <button onClick={() => setFilterDate(dateISO())} className="px-3 py-2 bg-white border border-slate-200 rounded-lg font-black text-xs uppercase flex items-center gap-2 min-w-[190px] justify-center"><CalendarDays size={15} className="text-blue-600"/> {humanDate(filterDate)} • {totalOrders}</button>
        <button onClick={() => setFilterDate(shiftDate(filterDate, 1))} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50"><ChevronRight size={16}/></button>
      </div>
    </div>

    {loading ? <Empty text="Завантаження замовлень..."/> : <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
      {groups.map((column) => <OrderColumn key={column.key} column={column} onOpen={setSelected} />)}
    </div>}

    {modal === 'order' && <Modal title="Нове замовлення" onClose={() => setModal(null)}><OrderForm form={orderForm} setForm={setOrderForm} onSubmit={createOrder} busy={busy}/></Modal>}
    {selected && <OrderDrawer order={selected} setOrder={setSelected} busy={busy} onPatch={patchOrder} onAutoMove={autoMove} partForm={partForm} setPartForm={setPartForm} onAddPart={addPart} onPartStatus={updatePartStatus} onPrint={printReceipt} onCopyTtn={copyTtn}/>} 
  </div>;
}

function OrderColumn({ column, onOpen }) {
  const Icon = column.icon;
  return <div className={`rounded-3xl border shadow-sm p-4 min-h-[280px] ${columnStyle[column.tone]}`}>
    <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4"><span className={`w-9 h-9 rounded-2xl flex items-center justify-center ${iconStyle[column.tone]}`}><Icon size={18}/></span>{column.title}<span className="ml-auto bg-white/80 px-3 py-1 rounded-xl text-slate-700">{column.orders.length}</span></h3>
    <div className="space-y-3">{column.orders.map((order) => <OrderCard key={order.id} order={order} onOpen={() => onOpen(order)} />)}{!column.orders.length && <Empty text="Пусто"/>}</div>
  </div>;
}

function OrderCard({ order, onOpen }) {
  const delivery = parseDelivery(order);
  const parts = arr(order.parts);
  const total = parts.reduce((s, p) => s + Number(p.sell_price || 0) * Number(p.quantity || 1), 0);
  const waiting = parts.filter((p) => ['WAITING', 'IN_TRANSIT'].includes(p.status || 'WAITING')).length;
  return <button onClick={onOpen} className="w-full text-left bg-white/90 hover:bg-white border border-white/80 hover:border-blue-200 rounded-2xl p-4 transition-all shadow-sm">
    <div className="flex justify-between gap-3"><div><p className="font-black text-slate-900">№{order.id} • {order.client || 'Покупець'}</p><p className="text-xs font-bold text-slate-500 mt-1">{order.phone || '-'} • {order.plate || 'Без авто'}</p></div><span className="text-[10px] font-black uppercase text-slate-400 text-right">{orderDateText(order)}</span></div>
    <div className="mt-3 flex flex-wrap gap-2"><Badge>{parts.length} поз.</Badge><Badge>{money(total)}</Badge>{waiting > 0 && <Badge accent>{waiting} очікує</Badge>}{delivery.ttn && <Badge>ТТН</Badge>}</div>
  </button>;
}

function OrderDrawer({ order, setOrder, busy, onPatch, onAutoMove, partForm, setPartForm, onAddPart, onPartStatus, onPrint, onCopyTtn }) {
  const delivery = parseDelivery(order);
  const parts = arr(order.parts);
  const total = parts.reduce((s, p) => s + Number(p.sell_price || 0) * Number(p.quantity || 1), 0);
  const updateDelivery = (patch) => onPatch({ delivery_data: JSON.stringify({ ...delivery, ...patch, mode: 'store' }) });
  return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end"><div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl p-5 md:p-7">
    <div className="flex items-start justify-between gap-3 mb-5"><div><h2 className="text-2xl font-black uppercase text-slate-900">Замовлення №{order.id}</h2><p className="text-sm font-bold text-slate-500">{order.client} • {order.phone}</p></div><button onClick={() => setOrder(null)} className="p-2 bg-slate-100 rounded-xl"><X size={18}/></button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5"><StatusButton disabled={busy} label="В обробці" onClick={() => onPatch({ status: 'SELECTION' })}/><StatusButton disabled={busy} label="Очікує товар" onClick={() => onPatch({ status: 'ORDERED' })}/><StatusButton disabled={busy} label="Готове" onClick={() => onPatch({ status: 'DONE' })}/><StatusButton disabled={busy} label="Виконано" onClick={() => onPatch({ status: 'COMPLETED' })}/></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <Panel title="Покупець"><Info label="Клієнт" value={order.client}/><Info label="Телефон" value={order.phone}/><Info label="Авто / VIN" value={`${order.plate || '-'} ${order.vin_code || ''}`}/><Info label="Джерело" value={delivery.source || '-'}/></Panel>
      <Panel title="Доставка та оплата"><Select label="Оплата" value={order.payment_status || 'unpaid'} onChange={(v) => onPatch({ payment_status: v })} options={[['unpaid','Не оплачено'],['prepaid','Передплата'],['paid','Оплачено'],['cod','Післяплата'],['debt','Борг']]}/><Select label="Доставка" value={order.delivery_type || 'pickup'} onChange={(v) => onPatch({ delivery_type: v })} options={[['pickup','Самовивіз'],['nova_poshta','Нова пошта'],['courier','Курʼєр']]}/><Labeled label="ТТН" value={delivery.ttn || ''} onBlur={(v) => updateDelivery({ ttn: v })}/><button onClick={onCopyTtn} className="w-full bg-slate-100 text-slate-700 rounded-xl p-3 font-black uppercase text-xs flex items-center justify-center gap-2"><Copy size={15}/> Скопіювати ТТН</button></Panel>
    </div>
    <Panel title="Товари"><form onSubmit={onAddPart} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4"><FormInput required placeholder="Назва" value={partForm.name} onChange={(v)=>setPartForm({...partForm,name:v})}/><FormInput placeholder="Бренд" value={partForm.brand} onChange={(v)=>setPartForm({...partForm,brand:v})}/><FormInput placeholder="Артикул" value={partForm.article} onChange={(v)=>setPartForm({...partForm,article:v})}/><FormInput placeholder="Постачальник" value={partForm.supplier} onChange={(v)=>setPartForm({...partForm,supplier:v})}/><FormInput placeholder="Закупка" value={partForm.buy_price} onChange={(v)=>setPartForm({...partForm,buy_price:v})}/><FormInput required placeholder="Продаж" value={partForm.sell_price} onChange={(v)=>setPartForm({...partForm,sell_price:v})}/><FormInput placeholder="К-сть" value={partForm.quantity} onChange={(v)=>setPartForm({...partForm,quantity:v})}/><button disabled={busy} className="bg-blue-600 text-white rounded-xl font-black uppercase text-xs min-h-[46px]">Додати</button></form>
      <div className="space-y-2">{parts.map((p)=><div key={p.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p className="font-black text-slate-800">{p.brand} {p.article}</p><p className="text-sm font-bold text-slate-500">{p.name} • {qty(p.quantity)} шт • {money(p.sell_price)}</p></div><select value={p.status || 'WAITING'} onChange={(e)=>onPartStatus(p,e.target.value)} className="field md:w-44"><option value="WAITING">До замовлення</option><option value="IN_TRANSIT">В дорозі</option><option value="ARRIVED">Отримано</option><option value="UNAVAILABLE">Відмова</option></select></div></div>)}{!parts.length && <Empty text="Товари ще не додані"/>}</div>
      <div className="flex flex-col md:flex-row gap-2 justify-between mt-5"><div className="text-xl font-black">Разом: {money(total)}</div><div className="flex gap-2"><button onClick={onAutoMove} className="bg-emerald-600 text-white rounded-xl px-4 py-3 font-black uppercase text-xs">Авто-статус</button><button onClick={()=>onPrint(order)} className="bg-slate-900 text-white rounded-xl px-4 py-3 font-black uppercase text-xs flex items-center gap-2"><Printer size={15}/> Чек</button></div></div>
    </Panel>
  </div></div>;
}

function OrderForm({ form, setForm, onSubmit, busy }) { return <form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input required label="Покупець" placeholder="ПІБ клієнта" value={form.client} onChange={(v)=>setForm({...form,client:v})}/><Input required label="Телефон" placeholder="+380..." value={form.phone} onChange={(v)=>setForm({...form,phone:v})}/><Input label="Номер авто" placeholder="АА1234ВС або залишити пустим" value={form.plate} onChange={(v)=>setForm({...form,plate:v.toUpperCase()})}/><Input label="VIN" placeholder="VIN, якщо є" value={form.vin_code} onChange={(v)=>setForm({...form,vin_code:v.toUpperCase()})}/><Select label="Джерело" value={form.source} onChange={(v)=>setForm({...form,source:v})} options={['Телефон','Сайт','Telegram','Instagram','OLX','Магазин'].map(v=>[v,v])}/><Select label="Доставка" value={form.delivery_type} onChange={(v)=>setForm({...form,delivery_type:v})} options={[['pickup','Самовивіз'],['nova_poshta','Нова пошта'],['courier','Курʼєр']]}/><Input label="Місто" placeholder="Наприклад: Київ" value={form.city} onChange={(v)=>setForm({...form,city:v})}/><Input label="Відділення / адреса" placeholder="№ відділення або адреса" value={form.warehouse} onChange={(v)=>setForm({...form,warehouse:v})}/></div><textarea placeholder="Коментар до замовлення" value={form.comment} onChange={(e)=>setForm({...form,comment:e.target.value})} className="field min-h-[100px] resize-none"/><button disabled={busy} className="w-full bg-blue-600 text-white rounded-xl p-4 font-black uppercase text-xs">{busy ? 'Збереження...' : 'Створити замовлення'}</button></form>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4"><div className="bg-white rounded-3xl w-full max-w-2xl mx-auto my-8 p-5 md:p-6 relative shadow-2xl"><button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-xl"><X size={18}/></button><h2 className="text-2xl font-black uppercase mb-5">{title}</h2>{children}</div></div>; }
function Panel({ title, children }) { return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"><h3 className="font-black uppercase text-slate-800 mb-3 text-sm">{title}</h3>{children}</div>; }
function Empty({ text }) { return <div className="text-center text-slate-400 text-xs font-black uppercase py-8 bg-white/60 rounded-2xl">{text}</div>; }
function Badge({ children, accent }) { return <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${accent ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-600 border border-slate-200'}`}>{children}</span>; }
function StatusButton({ label, ...props }) { return <button {...props} className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl p-3 font-black uppercase text-[10px] disabled:opacity-50">{label}</button>; }
function Info({ label, value }) { return <p className="text-sm mb-2"><span className="font-black text-slate-400 uppercase text-[10px] block">{label}</span><span className="font-bold text-slate-800">{value || '-'}</span></p>; }
function FormInput({ value, onChange, placeholder, required }) { return <input required={required} placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} className="field"/>; }
function Input({ label, value, onChange, required, placeholder }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">{label}</span><input required={required} placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} className="field"/></label>; }
function Labeled({ label, value, onBlur }) { const [v,setV]=useState(value); useEffect(()=>setV(value),[value]); return <label className="block mb-2"><span className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">{label}</span><input value={v} onChange={(e)=>setV(e.target.value)} onBlur={()=>onBlur(v)} className="field"/></label>; }
function Select({ label, value, onChange, options }) { return <label className="block mb-2"><span className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="field">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>; }
