import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, CreditCard, History, LogOut, RefreshCcw, ShieldCheck, Sparkles, Wallet, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const money = (value, currency = 'UAH') => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ${currency === 'UAH' ? 'грн' : currency}`;
const fmt = (value) => value ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const toneByStatus = (status) => {
  if (status === 'blocked') return { gradient: 'from-rose-600 via-red-600 to-orange-500', badge: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle, action: 'Оплатити і відновити доступ' };
  if (status === 'grace') return { gradient: 'from-amber-500 via-orange-500 to-yellow-500', badge: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock3, action: 'Оплатити зараз' };
  if (status === 'payment_due_soon') return { gradient: 'from-blue-600 via-indigo-600 to-cyan-500', badge: 'bg-blue-50 text-blue-700 border-blue-100', icon: AlertTriangle, action: 'Продовжити доступ' };
  if (status === 'trial') return { gradient: 'from-blue-600 via-sky-600 to-cyan-500', badge: 'bg-blue-50 text-blue-700 border-blue-100', icon: CalendarDays, action: 'Оплатити тариф' };
  if (status === 'manual_free') return { gradient: 'from-violet-600 via-purple-600 to-fuchsia-500', badge: 'bg-violet-50 text-violet-700 border-violet-100', icon: ShieldCheck, action: 'Створити заявку' };
  return { gradient: 'from-emerald-600 via-teal-600 to-cyan-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2, action: 'Продовжити тариф' };
};

const paymentStatus = {
  pending: { label: 'Очікує підтвердження', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  confirmed: { label: 'Підтверджено', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  rejected: { label: 'Відхилено', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  covered: { label: 'Доступ уже продовжено', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

const hasActiveAccess = (billing) => {
  const status = billing?.billing_status || billing?.status;
  return billing?.access_allowed !== false && ['active', 'payment_due_soon', 'manual_free'].includes(status);
};

export default function Billing() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/billing/me/');
      setData(res.data || {});
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося завантажити billing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const billing = data?.billing || {};
  const plan = data?.plan || {};
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const activeAccess = hasActiveAccess(billing);
  const pendingCount = activeAccess ? 0 : payments.filter((payment) => payment.status === 'pending').length;
  const tone = toneByStatus(billing.billing_status || billing.status);
  const Icon = tone.icon;
  const accessAllowed = billing.access_allowed !== false;

  const createPaymentRequest = async (method = 'monobank_jar') => {
    setBusy(method);
    setNotice('');
    try {
      const res = await api.post('/api/billing/payment-request/', {
        method,
        amount: billing.price || plan.price,
        comment: method === 'cash' ? 'Клієнт планує оплату готівкою' : 'Клієнт натиснув “Я оплатив” на сторінці тарифу',
      });
      setNotice(res.data?.message || 'Заявку створено. Після перевірки адміністратор підтвердить доступ.');
      await load();
    } catch (error) {
      setNotice(error.response?.data?.error || 'Не вдалося створити заявку на оплату.');
    } finally {
      setBusy('');
    }
  };

  const mainDate = billing.subscription_end_display || billing.trial_until_display || billing.grace_until_display || '—';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><div className="rounded-[30px] bg-white border border-slate-100 p-8 text-center shadow-sm"><RefreshCcw className="mx-auto mb-3 animate-spin text-blue-600"/><p className="font-black uppercase text-slate-900">Завантаження тарифу...</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">VIN-matrix SaaS</p>
            <h1 className="mt-2 text-3xl md:text-5xl font-black uppercase italic text-slate-950">Тариф і доступ</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base font-bold text-slate-500">Керуйте підпискою, оплатою і доступом до системи. Якщо доступ заблоковано, оплатіть тариф і створіть заявку на підтвердження.</p>
          </div>
          <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-xs font-black uppercase text-rose-600 hover:bg-rose-100"><LogOut size={16}/> Вийти</button>
        </div>

        {notice && <div className="rounded-[24px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{notice}</div>}
        {activeAccess && payments.some((payment) => payment.status === 'pending') && <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Доступ активний. Старі заявки “очікує” залишені тільки в історії й не блокують роботу.</div>}

        <section className={`overflow-hidden rounded-[38px] bg-gradient-to-r ${tone.gradient} text-white shadow-2xl shadow-slate-200`}>
          <div className="p-5 md:p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_420px] gap-6 items-stretch">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/90"><Icon size={16}/> {billing.label || 'Активний'}</div>
              <h2 className="mt-5 text-3xl md:text-5xl font-black uppercase leading-tight">{plan.name || billing.plan_name || 'VIN-matrix Full'}</h2>
              <p className="mt-4 max-w-2xl text-sm md:text-base font-bold text-white/85 leading-relaxed">{billing.message || 'Усі функції VIN-matrix в одному тарифі: CRM, склад, документи, аналітика, Нова пошта, магазин і СТО.'}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {(plan.features || []).map((feature) => <span key={feature} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase text-white/85">{feature}</span>)}
              </div>
            </div>
            <div className="rounded-[30px] border border-white/20 bg-white/15 p-4 md:p-5 backdrop-blur-sm">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Ціна" value={money(billing.price || plan.price || 2000, billing.currency || plan.currency || 'UAH')} icon={<Wallet size={16}/>} />
                <Metric label="Статус" value={billing.label || 'Активний'} icon={<ShieldCheck size={16}/>} />
                <Metric label="До дати" value={mainDate} icon={<CalendarDays size={16}/>} />
                <Metric label="Днів" value={billing.days_left !== null && billing.days_left !== undefined ? `${billing.days_left} дн.` : billing.grace_days_left ? `${billing.grace_days_left} дн.` : '—'} icon={<Clock3 size={16}/>} />
              </div>
              <div className="mt-4 rounded-2xl bg-white/15 border border-white/15 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Доступ</p>
                <p className="mt-1 text-xl font-black">{accessAllowed ? 'Дозволено' : 'Заблоковано'}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/15 bg-white/10 p-4 md:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <p className="text-xs md:text-sm font-bold text-white/80">Оплата підтверджується вручну адміністратором. Після підтвердження доступ продовжується на 30 днів.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
              <button disabled={Boolean(busy)} onClick={() => createPaymentRequest('monobank_jar')} className="rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase text-slate-950 shadow-lg hover:bg-slate-50 disabled:opacity-60">{busy === 'monobank_jar' ? 'Створюємо...' : tone.action}</button>
              <button disabled={Boolean(busy)} onClick={() => createPaymentRequest('cash')} className="rounded-2xl border border-white/20 bg-slate-950/25 px-5 py-3 text-xs font-black uppercase text-white hover:bg-slate-950/35 disabled:opacity-60">{busy === 'cash' ? 'Створюємо...' : 'Оплата готівкою'}</button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SmallCard icon={<CreditCard size={18}/>} label="Активних заявок" value={pendingCount} tone={pendingCount ? 'amber' : 'emerald'} />
          <SmallCard icon={<History size={18}/>} label="Історія заявок" value={payments.length} />
          <SmallCard icon={<Sparkles size={18}/>} label="Період тарифу" value="30 днів" />
        </div>

        <section className="rounded-[34px] border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Історія</p>
              <h3 className="text-2xl font-black uppercase text-slate-950">Заявки на оплату</h3>
            </div>
            <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"><RefreshCcw size={15}/> Оновити</button>
          </div>
          {payments.length ? <div className="space-y-3">{payments.map((payment) => <PaymentRow key={payment.id} payment={payment} activeAccess={activeAccess} />)}</div> : <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Заявок на оплату ще немає.</div>}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 p-3 min-w-0"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/70">{icon}{label}</div><p className="mt-2 truncate text-lg font-black text-white">{value}</p></div>;
}

function SmallCard({ icon, label, value, tone = 'blue' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100';
  return <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${cls}`}>{icon}</div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>;
}

function PaymentRow({ payment, activeAccess }) {
  const effectiveStatus = payment.status === 'pending' && activeAccess ? 'covered' : payment.status;
  const meta = paymentStatus[effectiveStatus] || { label: payment.status || 'Статус', cls: 'bg-slate-50 text-slate-600 border-slate-100' };
  return <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950">{money(payment.amount, payment.currency)}</p><span className={`rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${meta.cls}`}>{meta.label}</span></div><p className="mt-1 text-sm font-bold text-slate-500">{payment.method_label} · {payment.comment || 'Заявка на оплату'}</p>{payment.rejected_reason && <p className="mt-1 text-xs font-bold text-rose-600">Причина: {payment.rejected_reason}</p>}</div><div className="text-left md:text-right text-xs font-bold text-slate-400"><p>Створено: {fmt(payment.created_at)}</p>{payment.confirmed_at && <p>Підтверджено: {fmt(payment.confirmed_at)}</p>}</div></div>;
}
