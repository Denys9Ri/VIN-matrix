import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, ExternalLink, Package, Phone, RefreshCcw, Truck, UserRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const arr = (v) => Array.isArray(v) ? v : [];
const num = (v) => Number(v || 0) || 0;
const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const pay = { unpaid: 'Не оплачено', prepaid: 'Передплата', paid: 'Оплачено', cod: 'Післяплата', debt: 'Борг' };
const status = { SELECTION: 'В обробці', ORDERED: 'Очікує товар', IN_PROGRESS: 'Очікує товар', DONE: 'Готове', SHIPPED: 'Відправлено', COMPLETED: 'Виконано', CANCELLED: 'Скасовано' };

function calcOrder(order) {
  const partsTotal = arr(order?.parts).reduce((s, p) => s + num(p.sell_price) * (num(p.quantity) || 1), 0);
  const servicesTotal = arr(order?.services).reduce((s, srv) => s + num(srv.price) * (num(srv.quantity) || 1), 0);
  const total = partsTotal + servicesTotal;
  const paid = order?.payment_status === 'paid' ? total : num(order?.prepayment_amount);
  return { total, paid, left: Math.max(total - paid, 0) };
}

export default function AttentionAction() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const visitId = params.get('visit_id');
  const type = params.get('type') || 'order';
  const tab = params.get('tab') || '';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => calcOrder(order), [order]);

  const load = async () => {
    if (!visitId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/visits/${visitId}/`);
      setOrder(res.data || null);
    } catch {
      setMessage('Не вдалося завантажити замовлення.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visitId]);

  const markPaid = async () => {
    if (!order?.id) return;
    setBusy(true);
    try {
      await api.patch(`/api/visits/${order.id}/`, { payment_status: 'paid', prepayment_amount: totals.total });
      setMessage('Оплату закрито. Борг більше не буде показуватись у повідомленнях.');
      await load();
    } catch {
      setMessage('Не вдалося закрити оплату.');
    } finally {
      setBusy(false);
    }
  };

  const openOrder = () => navigate(`/visits?visit_id=${order?.id || visitId}${tab ? `&tab=${tab}` : ''}`);
  const openClient = () => navigate(`/clients?search=${encodeURIComponent(order?.phone || order?.client || '')}&order_id=${order?.id || visitId}&tab=debts`);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-blue-600 font-black"><RefreshCcw className="animate-spin mr-2"/> Завантаження...</div>;
  if (!order) return <div className="max-w-3xl mx-auto p-6"><EmptyState message={message || 'Замовлення не знайдено.'} onBack={() => navigate(-1)} /></div>;

  const isDebt = type === 'debt' || type === 'payment';
  const Icon = isDebt ? CreditCard : type === 'part_delay' ? Truck : AlertTriangle;
  const parts = arr(order.parts);

  return <div className="max-w-5xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen bg-slate-50/40">
    <button onClick={() => navigate(-1)} className="mb-4 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-black text-slate-600 flex items-center gap-2 shadow-sm"><ArrowLeft size={17}/> Назад</button>

    {message && <div className="mb-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 p-4 font-bold text-sm">{message}</div>}

    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <div className={`p-5 md:p-7 border-b ${isDebt ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 ${isDebt ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}><Icon size={26}/></div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Центр повідомлень</p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase mt-1">Замовлення №{order.id}</h1>
              <p className="text-sm font-bold text-slate-600 mt-1">{order.client || 'Покупець'} • {order.phone || 'без телефону'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{status[order.status] || order.status}</Badge>
            <Badge>{pay[order.payment_status] || order.payment_status}</Badge>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-4">
          <Panel title="Клієнт">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Info icon={UserRound} label="Клієнт" value={order.client || '—'} />
              <Info icon={Phone} label="Телефон" value={order.phone || '—'} />
              <Info icon={Package} label="Авто / VIN" value={`${order.plate || '—'} ${order.vin_code || ''}`} />
              <Info icon={Truck} label="Доставка" value={order.delivery_type || '—'} />
            </div>
          </Panel>

          <Panel title="Товари в замовленні">
            {parts.length ? <div className="space-y-2">{parts.map((p) => <div key={p.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900">{p.brand} {p.article}</p>
                  <p className="text-sm font-bold text-slate-500">{p.name}</p>
                  <p className="text-xs font-black text-slate-400 uppercase mt-1">{p.supplier || p.source_label || 'Постачальник не вказаний'}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-black text-slate-900">{p.quantity || 1} шт</p>
                  <p className="text-sm font-black text-emerald-600">{money(num(p.sell_price) * (num(p.quantity) || 1))}</p>
                </div>
              </div>
            </div>)}</div> : <Empty text="Товарів немає" />}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Оплата">
            <div className="grid grid-cols-1 gap-2">
              <PayLine label="Сума" value={money(totals.total)} />
              <PayLine label="Внесено" value={money(totals.paid)} />
              <PayLine label="Залишилось" value={money(totals.left)} danger={totals.left > 0 && order.payment_status !== 'paid'} />
            </div>
            {order.payment_status !== 'paid' && <button onClick={markPaid} disabled={busy} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-4 py-4 text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 size={17}/>{busy ? 'Закриваю...' : 'Оплачено / закрити борг'}</button>}
          </Panel>

          <button onClick={openOrder} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-4 text-xs font-black uppercase flex items-center justify-center gap-2 shadow-md shadow-blue-100"><ExternalLink size={17}/> Відкрити замовлення</button>
          <button onClick={openClient} className="w-full bg-white border border-blue-100 text-blue-700 rounded-2xl px-4 py-4 text-xs font-black uppercase flex items-center justify-center gap-2"><UserRound size={17}/> Відкрити клієнта</button>
        </aside>
      </div>
    </section>
  </div>;
}

function Panel({ title, children }) { return <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"><h2 className="text-sm font-black uppercase text-slate-900 mb-3">{title}</h2>{children}</div>; }
function Badge({ children }) { return <span className="bg-white/80 border border-white rounded-xl px-3 py-2 text-xs font-black text-slate-700 uppercase">{children}</span>; }
function Info({ icon: Icon, label, value }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Icon size={13}/>{label}</p><p className="font-black text-slate-800 mt-1 break-all">{value}</p></div>; }
function PayLine({ label, value, danger }) { return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex justify-between gap-3"><span className="text-xs font-black uppercase text-slate-400">{label}</span><span className={`font-black ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span></div>; }
function Empty({ text }) { return <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-400 font-black uppercase text-xs">{text}</div>; }
function EmptyState({ message, onBack }) { return <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center"><AlertTriangle className="mx-auto text-amber-500 mb-3" size={42}/><p className="font-black text-slate-900">{message}</p><button onClick={onBack} className="mt-4 bg-blue-600 text-white rounded-xl px-5 py-3 text-xs font-black uppercase">Назад</button></div>; }
