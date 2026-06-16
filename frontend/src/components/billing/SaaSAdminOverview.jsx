import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react';
import api from '../../api/axios';

const money = (value, currency = 'UAH') => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ${currency === 'UAH' ? 'грн' : currency}`;
const dateOnly = (value) => value ? new Date(value).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const statusMeta = {
  trial: { label: 'Trial', cls: 'bg-blue-50 text-blue-700 border-blue-100', icon: Clock3 },
  active: { label: 'Активні', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
  payment_due_soon: { label: 'Скоро оплата', cls: 'bg-amber-50 text-amber-700 border-amber-100', icon: AlertTriangle },
  grace: { label: 'Grace', cls: 'bg-orange-50 text-orange-700 border-orange-100', icon: AlertTriangle },
  blocked: { label: 'Blocked', cls: 'bg-rose-50 text-rose-700 border-rose-100', icon: XCircle },
  manual_free: { label: 'Free', cls: 'bg-violet-50 text-violet-700 border-violet-100', icon: ShieldCheck },
};

const paymentStatusLabel = {
  pending: 'Очікує',
  confirmed: 'Підтверджено',
  rejected: 'Відхилено',
};

export default function SaaSAdminOverview() {
  const [clients, setClients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [clientsRes, paymentsRes] = await Promise.allSettled([
        api.get('/api/billing/admin/clients/'),
        api.get('/api/billing/admin/payments/?limit=60'),
      ]);

      if (clientsRes.status === 'rejected') {
        if ([401, 403, 404].includes(clientsRes.reason?.response?.status)) {
          setHidden(true);
          return;
        }
        throw clientsRes.reason;
      }

      setHidden(false);
      setClients(Array.isArray(clientsRes.value.data?.results) ? clientsRes.value.data.results : []);
      setSummary(clientsRes.value.data?.summary || null);
      if (paymentsRes.status === 'fulfilled') {
        setPayments(Array.isArray(paymentsRes.value.data?.results) ? paymentsRes.value.data.results : []);
      } else {
        setPayments([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Не вдалося завантажити SaaS-billing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pendingPayments = useMemo(() => payments.filter((payment) => payment.status === 'pending'), [payments]);
  const blockedClients = useMemo(() => clients.filter((client) => client.billing_status === 'blocked' || client.access_allowed === false), [clients]);
  const warningClients = useMemo(() => clients.filter((client) => ['payment_due_soon', 'grace'].includes(client.billing_status)).slice(0, 6), [clients]);

  if (hidden) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 md:px-8 pt-4 md:pt-8">
      <div className="overflow-hidden rounded-[34px] bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 text-white shadow-xl shadow-blue-100">
        <div className="p-5 md:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
              <CreditCard size={14}/>
              SaaS billing control
            </div>
            <h2 className="mt-3 text-2xl md:text-4xl font-black uppercase italic leading-tight">Підписки, доступи і оплати</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold text-blue-50/90">
              Тут видно реальний SaaS-стан клієнтів: хто на trial, хто оплатив, хто в grace, кого заблоковано і які заявки чекають підтвердження.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black uppercase text-white hover:bg-white/15 disabled:opacity-60">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
              Оновити SaaS
            </button>
            <a href="/billing" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase text-slate-950 hover:bg-slate-50">
              <CreditCard size={15}/>
              Сторінка тарифу
            </a>
          </div>
        </div>

        {error && <div className="mx-5 md:mx-6 mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm font-bold text-rose-50">{error}</div>}

        <div className="p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Metric label="Усього" value={summary?.total ?? clients.length} icon={<Users size={16}/>} />
          <Metric label="Trial" value={summary?.trial ?? 0} />
          <Metric label="Активні" value={summary?.active ?? 0} tone="emerald" />
          <Metric label="Grace" value={summary?.grace ?? 0} tone="amber" />
          <Metric label="Blocked" value={summary?.blocked ?? blockedClients.length} tone="rose" />
          <Metric label="Оплатили" value={summary?.paid ?? 0} tone="emerald" />
          <Metric label="Заявки" value={pendingPayments.length} tone={pendingPayments.length ? 'amber' : 'slate'} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-5 md:p-6 pt-0">
          <Panel title="Заявки на оплату" empty="Немає заявок, які чекають підтвердження.">
            {pendingPayments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black truncate">{payment.client_name || payment.client_username || `C${payment.client_code}`} · {money(payment.amount, payment.currency)}</p>
                  <p className="text-xs font-bold text-blue-100/80">{payment.method_label} · {new Date(payment.created_at).toLocaleString('uk-UA')}</p>
                </div>
                <span className="w-fit rounded-xl bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">{paymentStatusLabel[payment.status] || payment.status}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Ризикові доступи" empty="Немає клієнтів у grace / blocked / скоро оплата.">
            {[...warningClients, ...blockedClients].slice(0, 5).map((client) => {
              const meta = statusMeta[client.billing_status] || statusMeta.active;
              const Icon = meta.icon;
              return (
                <div key={client.id} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-center">
                  <div className="min-w-0">
                    <p className="font-black truncate">{client.client_code_display} · {client.client_name}</p>
                    <p className="text-xs font-bold text-blue-100/80">{client.assigned_to || 'Без партнера'} · до {client.subscription_end_display || dateOnly(client.subscription_until || client.trial_until)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 w-fit rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase ${meta.cls}`}><Icon size={12}/>{meta.label}</span>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, icon, tone = 'blue' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-100' : tone === 'amber' ? 'text-amber-100' : tone === 'rose' ? 'text-rose-100' : 'text-blue-100';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 min-w-0">
      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${toneClass}`}>{icon}{label}</div>
      <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
    </div>
  );
}

function Panel({ title, empty, children }) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div className="rounded-[26px] border border-white/10 bg-slate-950/20 p-4">
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/80">{title}</h3>
      <div className="space-y-2">
        {hasChildren ? children : <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-blue-100/75">{empty}</div>}
      </div>
    </div>
  );
}
