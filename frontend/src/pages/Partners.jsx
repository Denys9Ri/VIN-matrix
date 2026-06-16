import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, BadgeX, CreditCard, Eye, Loader2, Power, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserCog, Users, X } from 'lucide-react';
import api from '../api/axios';
import CopyButton from '../components/common/CopyButton';

const statusLabel = {
  pending: 'Очікує оплату',
  trial: 'Пробний період',
  active: 'Активний',
  inactive: 'Неактивний',
  payment_due_soon: 'Скоро оплата',
  grace: 'Мʼякий доступ',
  blocked: 'Заблоковано',
  manual_free: 'Ручний доступ',
};

const paymentStatusLabel = {
  pending: 'Очікує підтвердження',
  confirmed: 'Підтверджено',
  rejected: 'Відхилено',
  covered: 'Закрито автоматично',
};

const defaultPaymentLink = {
  title: 'VIN-matrix підписка',
  monthly_value: 2000,
  public_url: '',
  public_note: '',
  instruction: 'Вкажіть код клієнта. Наприклад: C6003',
  is_active: true,
};

const currentMonth = () => new Date().toISOString().slice(0, 7);
const money = (value, currency = 'UAH') => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ${currency === 'UAH' ? 'грн' : currency}`;
const niceDate = (value) => value ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  return data?.details || data?.error || data?.detail || error?.message || 'Невідома помилка';
};

const subscriptionClass = (client) => {
  const status = client.billing_status || client.payment_status;
  if (client.subscription_expired || !client.is_access_enabled || status === 'blocked') return 'bg-rose-50 text-rose-700';
  if (client.subscription_warning || ['payment_due_soon', 'grace'].includes(status)) return 'bg-orange-50 text-orange-700';
  if (status === 'trial') return 'bg-blue-50 text-blue-700';
  return 'bg-emerald-50 text-emerald-700';
};

const clientName = (client) => client.full_name || client.username || `ID ${client.user_id || client.id}`;
const partnerName = (partner) => partner.full_name || partner.username || `ID ${partner.user_id || partner.id}`;

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState(null);
  const [payoutMonth, setPayoutMonth] = useState(currentMonth());
  const [payoutAmounts, setPayoutAmounts] = useState({});
  const [alerts, setAlerts] = useState({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
  const [paymentLink, setPaymentLink] = useState(defaultPaymentLink);
  const [paymentLinkSaving, setPaymentLinkSaving] = useState(false);
  const [paymentLinkNotice, setPaymentLinkNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPartnerIdByClient, setSelectedPartnerIdByClient] = useState({});
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await api.get('/api/billing/admin/payments/?limit=120');
      setPayments(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPayouts = async (month = payoutMonth) => {
    setPayoutsLoading(true);
    try {
      const res = await api.get(`/api/billing/admin/partner-payouts/?month=${encodeURIComponent(month)}`);
      setPayouts(res.data || null);
    } catch {
      setPayouts(null);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    const [partnersRes, clientsRes, alertsRes, paymentLinkRes] = await Promise.allSettled([
      api.get('/api/partners/'),
      api.get('/api/platform-clients/'),
      api.get('/api/platform-clients/subscription-alerts/'),
      api.get('/api/billing/admin/client-link/'),
    ]);

    const errors = [];
    if (partnersRes.status === 'fulfilled') setPartners(Array.isArray(partnersRes.value.data) ? partnersRes.value.data : []);
    else errors.push(`Партнери: ${getErrorMessage(partnersRes.reason)}`);

    if (clientsRes.status === 'fulfilled') setClients(Array.isArray(clientsRes.value.data) ? clientsRes.value.data : []);
    else errors.push(`Клієнти: ${getErrorMessage(clientsRes.reason)}`);

    if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
    else setAlerts({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });

    if (paymentLinkRes.status === 'fulfilled' && paymentLinkRes.value.data?.client_link_settings) {
      setPaymentLink({ ...defaultPaymentLink, ...paymentLinkRes.value.data.client_link_settings });
    } else if (paymentLinkRes.status === 'rejected') {
      errors.push(`Оплата: ${getErrorMessage(paymentLinkRes.reason)}`);
    }

    if (errors.length) setLoadError(errors.join(' | '));
    setLoading(false);
    await Promise.all([loadPayments(), loadPayouts(payoutMonth)]);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadPayouts(payoutMonth); }, [payoutMonth]);

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((partner) => [partner.full_name, partner.username, partner.partner_code, partner.email, partner.user_id]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [partners, search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => [client.client_code_display, client.client_code, client.full_name, client.username, client.phone, client.email, client.assigned_to, client.assigned_partner_code, client.user_id]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [clients, search]);

  const pendingPayments = useMemo(() => payments.filter((payment) => payment.status === 'pending'), [payments]);
  const totalActiveClients = clients.filter((client) => client.is_access_enabled).length;
  const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);

  const savePaymentLink = async (e) => {
    e.preventDefault();
    setPaymentLinkSaving(true);
    setPaymentLinkNotice(null);
    try {
      const res = await api.patch('/api/billing/admin/client-link/', paymentLink);
      setPaymentLink({ ...defaultPaymentLink, ...(res.data?.client_link_settings || paymentLink) });
      setPaymentLinkNotice({ type: 'success', text: res.data?.message || 'Налаштування оплати збережено. Клієнти побачать оновлене посилання у своєму тарифі.' });
    } catch (error) {
      setPaymentLinkNotice({ type: 'error', text: `Не вдалося зберегти: ${getErrorMessage(error)}` });
    } finally {
      setPaymentLinkSaving(false);
    }
  };

  const runAction = async (key, request, successMessage, errorPrefix) => {
    setBusyKey(key);
    setNotice(null);
    try {
      await request();
      setNotice({ type: 'success', text: successMessage });
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', text: `${errorPrefix}: ${getErrorMessage(error)}` });
    } finally {
      setBusyKey('');
      setConfirmAction(null);
    }
  };

  const confirmPayment = (payment) => setConfirmAction({
    title: 'Підтвердити оплату?',
    text: `${payment.client_name} · ${money(payment.amount, payment.currency)}. Доступ стане активним на 30 днів.`,
    confirmText: 'Підтвердити',
    onConfirm: () => runAction(`pay-${payment.id}`, () => api.post('/api/billing/admin/confirm/', { payment_id: payment.id }), 'Оплату підтверджено. Доступ клієнта активний.', 'Не вдалося підтвердити оплату'),
  });

  const rejectPayment = (payment) => setConfirmAction({
    title: 'Відхилити заявку?',
    text: `${payment.client_name} · ${money(payment.amount, payment.currency)} буде відхилено.`,
    confirmText: 'Відхилити',
    tone: 'danger',
    onConfirm: () => runAction(`reject-${payment.id}`, () => api.post('/api/billing/admin/reject/', { payment_id: payment.id, reason: 'Оплату не підтверджено' }), 'Заявку відхилено.', 'Не вдалося відхилити заявку'),
  });

  const markPartnerPayout = (row) => {
    const amount = Number(payoutAmounts[row.partner_id] || row.due || 0);
    if (!row.partner_id || amount <= 0) return setNotice({ type: 'error', text: 'Вкажіть суму виплати партнеру.' });
    runAction(
      `payout-${row.partner_id}`,
      () => api.post('/api/billing/admin/partner-payouts/', { partner_id: row.partner_id, period: payoutMonth, amount, note: `Виплата за ${payoutMonth}` }),
      'Виплату партнеру зафіксовано.',
      'Не вдалося зафіксувати виплату'
    );
  };

  const togglePartner = (partner) => runAction(`partner-${partner.id}`, () => api.patch(`/api/partners/${partner.id}/`, { is_active: !partner.is_active }), partner.is_active ? 'Партнера вимкнено.' : 'Партнера увімкнено.', 'Не вдалося змінити статус партнера');
  const toggleClientAccess = (client) => runAction(`client-access-${client.id}`, () => api.patch(`/api/platform-clients/${client.id}/`, { is_access_enabled: !client.is_access_enabled, payment_status: !client.is_access_enabled ? 'active' : 'inactive' }), client.is_access_enabled ? 'Доступ клієнта вимкнено.' : 'Доступ клієнта увімкнено.', 'Не вдалося змінити доступ');
  const assignClientOwner = (client, ownerId) => {
    if (!ownerId) return setNotice({ type: 'error', text: 'Спочатку оберіть партнера для клієнта.' });
    return runAction(`assign-${client.id}`, () => api.patch(`/api/platform-clients/${client.id}/`, { assigned_owner_id: ownerId }), 'Партнера клієнта змінено.', 'Не вдалося змінити партнера');
  };
  const askMakePartnerClient = (partner) => setConfirmAction({ title: 'Перевести партнера у клієнти?', text: `Партнер ${partnerName(partner)} стане звичайним клієнтом. Його клієнти перейдуть до адміна.`, confirmText: 'Перевести', onConfirm: () => runAction(`make-client-${partner.id}`, () => api.post(`/api/partners/${partner.id}/make-client/`), 'Партнера переведено у клієнти.', 'Не вдалося перевести партнера у клієнти') });
  const askPromoteClient = (client) => setConfirmAction({ title: 'Зробити клієнта партнером?', text: `${clientName(client)} отримає статус партнера.`, confirmText: 'Зробити партнером', onConfirm: () => runAction(`promote-${client.id}`, () => api.post('/api/partners/promote-user/', { user_id: client.user_id }), 'Клієнта зроблено партнером.', 'Не вдалося зробити партнером') });
  const askRenewClient = (client) => setConfirmAction({ title: 'Оновити підписку?', text: `Додати або оновити 30 днів для ${clientName(client)}?`, confirmText: '+30 днів', onConfirm: () => runAction(`renew-${client.id}`, () => api.post(`/api/platform-clients/${client.id}/renew-30/`), 'Підписку оновлено на 30 днів.', 'Не вдалося оновити підписку') });
  const askDeleteClient = (client) => setConfirmAction({ title: 'Видалити акаунт?', text: `Акаунт ${clientName(client)} буде видалено повністю з сайту і бази.`, confirmText: 'Видалити', tone: 'danger', onConfirm: () => runAction(`delete-${client.id}`, async () => { await api.delete(`/api/platform-clients/${client.id}/`); setClients((prev) => prev.filter((item) => item.id !== client.id)); }, 'Акаунт видалено.', 'Не вдалося видалити акаунт') });

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen">
      <div className="mb-6"><h1 className="text-2xl md:text-3xl font-black italic uppercase text-slate-800">Акаунти / Партнери</h1><p className="text-slate-500 font-semibold mt-1">Клієнти, партнери, підтвердження оплат і контроль партнерських виплат.</p></div>
      {loadError && <Notice type="warning" onClose={() => setLoadError('')}>Частину даних не вдалося завантажити: {loadError}</Notice>}
      {notice && <Notice type={notice.type} onClose={() => setNotice(null)}>{notice.text}</Notice>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5"><Stat label="Усього клієнтів" value={clients.length} /><Stat label="Партнерів" value={partners.length} color="text-blue-600" /><Stat label="Активних клієнтів" value={totalActiveClients} color="text-emerald-600" /><Stat label="Заявок на підтвердження" value={pendingPayments.length} color="text-amber-600" border="border-amber-200" labelColor="text-amber-500" /></div>

      <PaymentLinkSettingsCard form={paymentLink} setForm={setPaymentLink} onSubmit={savePaymentLink} saving={paymentLinkSaving} notice={paymentLinkNotice} />
      <PaymentRequestsCard payments={pendingPayments} loading={paymentsLoading} busyKey={busyKey} onRefresh={loadPayments} onConfirm={confirmPayment} onReject={rejectPayment} />
      <PartnerPayoutCard data={payouts} loading={payoutsLoading} month={payoutMonth} setMonth={setPayoutMonth} payoutAmounts={payoutAmounts} setPayoutAmounts={setPayoutAmounts} busyKey={busyKey} onPay={markPartnerPayout} />

      {alertList.length > 0 && <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="text-orange-600" size={20} /><h3 className="font-black text-orange-800">Клієнти, у яких скоро закінчиться або вже закінчилась підписка</h3></div><div className="grid md:grid-cols-2 gap-2">{alertList.map((item) => <div key={item.id} className="bg-white/70 rounded-xl px-3 py-2 text-sm font-bold text-slate-700">{item.client_code_display} · {item.full_name} · до {item.subscription_end_display || '—'}</div>)}</div></div>}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по ПІБ, телефону, логіну, ID, коду або партнеру" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500" /></div></div>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6"><SectionHead icon={<ShieldCheck className="text-blue-600" size={20} />} title="Партнери" text="Тут тільки акаунти зі статусом партнера. Адмін A6000 сюди не входить." />{loading ? <Loading /> : filteredPartners.length === 0 ? <Empty text="Партнерів немає." /> : <PartnersTable partners={filteredPartners} busyKey={busyKey} onToggle={togglePartner} onMakeClient={askMakePartnerClient} />}</section>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><SectionHead icon={<UserCheck className="text-emerald-600" size={20} />} title="Всі клієнти" text="Клієнтів можна активувати, видалити, зробити партнером або перенести до іншого партнера." />{loading ? <Loading /> : filteredClients.length === 0 ? <Empty text="Клієнтів немає." /> : <ClientsTable clients={filteredClients} partners={partners} selectedPartnerIdByClient={selectedPartnerIdByClient} setSelectedPartnerIdByClient={setSelectedPartnerIdByClient} busyKey={busyKey} onDetails={setSelectedClient} onRenew={askRenewClient} onToggleAccess={toggleClientAccess} onPromote={askPromoteClient} onDelete={askDeleteClient} onAssign={assignClientOwner} />}</section>
      {selectedClient && <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
      {confirmAction && <ConfirmModal data={confirmAction} busy={Boolean(busyKey)} onClose={() => setConfirmAction(null)} />}
    </div>
  );
};

function Stat({ label, value, color = 'text-slate-900', border = 'border-slate-200', labelColor = 'text-slate-400' }) { return <div className={`bg-white rounded-2xl border ${border} p-4 shadow-sm`}><p className={`text-xs font-black uppercase ${labelColor}`}>{label}</p><p className={`text-3xl font-black mt-1 ${color}`}>{value}</p></div>; }
function Notice({ type = 'success', children, onClose }) { const styles = type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800'; return <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-between gap-3 ${styles}`}><span>{children}</span><button type="button" onClick={onClose} className="opacity-70 hover:opacity-100"><X size={16}/></button></div>; }
function SectionHead({ icon, title, text }) { return <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2"><div className="flex items-center gap-2">{icon}<h2 className="font-black text-slate-800 uppercase">{title}</h2></div><p className="text-xs text-slate-500 font-bold">{text}</p></div>; }
function Loading() { return <div className="p-6 text-slate-500 font-semibold flex items-center gap-2"><Loader2 className="animate-spin" size={17}/> Завантаження...</div>; }
function Empty({ text }) { return <div className="p-8 text-center text-slate-500 font-semibold"><Users className="mx-auto mb-3 text-slate-300" size={36} />{text}</div>; }

function PaymentRequestsCard({ payments, loading, busyKey, onRefresh, onConfirm, onReject }) {
  return <section className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden mb-5"><SectionHead icon={<CreditCard className="text-amber-600" size={20} />} title="Заявки на підтвердження" text="Клієнт натискає оплатити — тут зʼявляється заявка, адмін підтверджує доступ." /><div className="p-4">{loading ? <Loading /> : payments.length === 0 ? <Empty text="Немає активних заявок на підтвердження." /> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{payments.map((payment) => <div key={payment.id} className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-amber-600">{payment.client_code ? `C${payment.client_code}` : 'Клієнт'}</p><h3 className="text-lg font-black text-slate-900">{payment.client_name}</h3><p className="text-xs font-bold text-slate-500 mt-1">{payment.method_label} · {niceDate(payment.created_at)}</p></div><span className="bg-white text-amber-700 border border-amber-100 rounded-full px-3 py-1 text-[10px] font-black uppercase">{paymentStatusLabel[payment.status] || payment.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><MiniMetric label="Сума" value={money(payment.amount, payment.currency)} /><MiniMetric label="Метод" value={payment.method_label} /></div>{payment.comment && <p className="mt-3 text-xs font-semibold text-slate-500 bg-white rounded-2xl px-3 py-2">{payment.comment}</p>}<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2"><button disabled={busyKey === `pay-${payment.id}`} onClick={() => onConfirm(payment)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-3 py-3 text-xs font-black uppercase disabled:opacity-60">Підтвердити</button><button disabled={busyKey === `reject-${payment.id}`} onClick={() => onReject(payment)} className="bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl px-3 py-3 text-xs font-black uppercase disabled:opacity-60">Відхилити</button></div></div>)}</div>}<button type="button" onClick={onRefresh} className="mt-3 text-xs font-black text-blue-700 hover:underline inline-flex items-center gap-1"><RefreshCw size={14}/> Оновити заявки</button></div></section>;
}

function PartnerPayoutCard({ data, loading, month, setMonth, payoutAmounts, setPayoutAmounts, busyKey, onPay }) {
  const rows = data?.results || [];
  const summary = data?.summary || {};
  return <section className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden mb-5"><SectionHead icon={<CreditCard className="text-emerald-600" size={20} />} title="Партнерські виплати" text="Фіксована оплата 2000 грн: партнеру 1500, адміну 500. Прямі клієнти адміна = 2000 адміну." /><div className="p-4 space-y-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-1"><MiniMetric label="Оплат" value={summary.payments_count || 0} /><MiniMetric label="Виручка" value={money(summary.revenue)} /><MiniMetric label="Партнерам" value={money(summary.partner_earned)} /><MiniMetric label="Виплачено" value={money(summary.paid_to_partners)} /><MiniMetric label="Борг" value={money(summary.partner_due)} /></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black" /></div>{loading ? <Loading /> : rows.length === 0 ? <Empty text="За цей місяць підтверджених оплат ще немає." /> : <div className="space-y-2">{rows.map((row) => <div key={row.partner_id || 'admin'} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-3 xl:items-center"><div><p className="font-black text-slate-900">{row.partner_name}</p><p className="text-xs font-bold text-slate-500">Оплат: {row.payments_count} · виручка {money(row.revenue)} · партнеру {money(row.partner_earned)} · адміну {money(row.admin_earned)}</p><p className="mt-1 text-xs font-black text-emerald-700">Виплачено: {money(row.paid)} · залишилось: {money(row.due)}</p></div>{row.partner_id ? <div className="grid grid-cols-[1fr_auto] gap-2"><input type="number" value={payoutAmounts[row.partner_id] ?? row.due ?? ''} onChange={(e) => setPayoutAmounts({ ...payoutAmounts, [row.partner_id]: e.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black" placeholder="Сума виплати" /><button type="button" disabled={busyKey === `payout-${row.partner_id}`} onClick={() => onPay(row)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-60">Виплачено</button></div> : <div className="text-xs font-bold text-slate-400">Прямі клієнти адміна — виплата партнеру не потрібна.</div>}</div>)}</div>}</div></section>;
}

function PartnersTable({ partners, busyKey, onToggle, onMakeClient }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Партнер</th><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнтів</th><th className="text-left px-4 py-3">Активних</th><th className="text-left px-4 py-3">Статус</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">{partners.map((partner) => <tr key={partner.id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-black text-slate-800">{partner.full_name}</p><p className="text-xs text-slate-500">{partner.username} · ID {partner.user_id}</p></td><td className="px-4 py-3"><CopyButton value={partner.partner_code} label={partner.partner_code || '—'} compact /></td><td className="px-4 py-3 font-black text-slate-800">{partner.clients_count}</td><td className="px-4 py-3 font-black text-emerald-600">{partner.active_clients_count}</td><td className="px-4 py-3"><StatusBadge active={partner.is_active} /></td><td className="px-4 py-3"><div className="flex flex-wrap items-center justify-end gap-2"><ActionButton disabled={busyKey === `partner-${partner.id}`} onClick={() => onToggle(partner)}><Power size={15} /> {partner.is_active ? 'Вимкнути' : 'Увімкнути'}</ActionButton><ActionButton onClick={() => onMakeClient(partner)} muted><UserCog size={15} /> Зробити клієнтом</ActionButton></div></td></tr>)}</tbody></table></div>; }
function ClientsTable({ clients, partners, selectedPartnerIdByClient, setSelectedPartnerIdByClient, busyKey, onDetails, onRenew, onToggleAccess, onPromote, onDelete, onAssign }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнт</th><th className="text-left px-4 py-3">Телефон</th><th className="text-left px-4 py-3">Підписка</th><th className="text-left px-4 py-3">Прикріплений</th><th className="text-left px-4 py-3">Доступ</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">{clients.map((client) => <tr key={client.id} className="hover:bg-slate-50"><td className="px-4 py-3"><CopyButton value={client.client_code_display || `C${client.client_code}`} label={client.client_code_display || `C${client.client_code}`} compact /></td><td className="px-4 py-3"><p className="font-black text-slate-800">{client.full_name || '—'}</p><p className="text-xs text-slate-500">{client.username} · ID {client.user_id}</p>{client.email && <p className="text-xs text-slate-400">{client.email}</p>}</td><td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{client.phone || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg font-bold text-xs ${subscriptionClass(client)}`}>{client.subscription_label || statusLabel[client.billing_status] || statusLabel[client.payment_status] || client.payment_status || '—'}{client.subscription_end_display ? ` · до ${client.subscription_end_display}` : ''}</span></td><td className="px-4 py-3 min-w-[220px]"><p className="font-bold text-slate-700 mb-2">{client.assigned_partner_code || 'A6000'} · {client.assigned_to || 'Адмін'}</p><select value={selectedPartnerIdByClient[client.id] || client.assigned_owner_id || ''} onChange={(e) => setSelectedPartnerIdByClient({ ...selectedPartnerIdByClient, [client.id]: e.target.value })} className="border rounded-lg px-2 py-1.5 text-xs font-bold w-full"><option value="">Обрати партнера</option>{partners.map((partner) => <option key={partner.user_id} value={partner.user_id}>{partner.partner_code} · {partner.full_name || partner.username}</option>)}</select><button onClick={() => onAssign(client, selectedPartnerIdByClient[client.id])} className="mt-2 text-xs font-black text-blue-700 hover:underline">Змінити партнера</button></td><td className="px-4 py-3"><StatusBadge active={client.is_access_enabled} /></td><td className="px-4 py-3"><div className="flex flex-wrap items-center justify-end gap-2"><ActionButton onClick={() => onDetails(client)} muted><Eye size={15} /> Деталі</ActionButton><ActionButton disabled={busyKey === `renew-${client.id}`} onClick={() => onRenew(client)} success><RefreshCw size={15} /> +30 днів</ActionButton><ActionButton disabled={busyKey === `client-access-${client.id}`} onClick={() => onToggleAccess(client)}><Power size={15} /> {client.is_access_enabled ? 'Вимкнути' : 'Увімкнути'}</ActionButton><ActionButton onClick={() => onPromote(client)} success><ShieldCheck size={15} /> Зробити партнером</ActionButton><ActionButton onClick={() => onDelete(client)} danger><Trash2 size={15} /> Видалити</ActionButton></div></td></tr>)}</tbody></table></div>; }
function StatusBadge({ active }) { return active ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16} /> Увімкнено</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><BadgeX size={16} /> Вимкнено</span>; }
function ActionButton({ children, onClick, disabled, muted = false, success = false, danger = false }) { const cls = danger ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' : success ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : muted ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'; return <button type="button" disabled={disabled} onClick={onClick} className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 disabled:opacity-50 ${cls}`}>{children}</button>; }
function ClientModal({ client, onClose }) { return <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="font-black text-xl text-slate-800">Деталі акаунта</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-black">×</button></div><div className="space-y-3 text-sm"><p><span className="font-black text-slate-500">Код:</span> {client.client_code_display || `C${client.client_code}`}</p><p><span className="font-black text-slate-500">User ID:</span> {client.user_id}</p><p><span className="font-black text-slate-500">Логін:</span> {client.username}</p><p><span className="font-black text-slate-500">ПІБ:</span> {client.full_name || '—'}</p><p><span className="font-black text-slate-500">Телефон:</span> {client.phone || '—'}</p><p><span className="font-black text-slate-500">Email:</span> {client.email || '—'}</p><p><span className="font-black text-slate-500">Прикріплений:</span> {client.assigned_partner_code || 'A6000'} · {client.assigned_to || 'Адмін'}</p><p><span className="font-black text-slate-500">Підписка:</span> {client.subscription_label || statusLabel[client.payment_status] || '—'} {client.subscription_end_display ? `до ${client.subscription_end_display}` : ''}</p><p><span className="font-black text-slate-500">Доступ:</span> {client.is_access_enabled ? 'Увімкнено' : 'Вимкнено'}</p></div></div></div>; }
function ConfirmModal({ data, busy, onClose }) { const danger = data.tone === 'danger'; return <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[28px] shadow-2xl max-w-md w-full overflow-hidden"><div className={`${danger ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'} p-5 border-b flex items-start gap-3`}><div className={`${danger ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'} w-12 h-12 rounded-2xl flex items-center justify-center shrink-0`}><AlertTriangle size={22}/></div><div><h3 className="text-xl font-black uppercase text-slate-900">{data.title}</h3><p className="text-sm font-bold text-slate-600 mt-1">{data.text}</p></div></div><div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button><button type="button" disabled={busy} onClick={data.onConfirm} className={`${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-2xl text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60`}>{busy ? 'Виконується...' : data.confirmText || 'Підтвердити'}</button></div></div></div>; }
function PaymentLinkSettingsCard({ form, setForm, onSubmit, saving, notice }) { return <form onSubmit={onSubmit} className="bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 rounded-[30px] shadow-xl shadow-blue-100 overflow-hidden text-white mb-6"><div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-white/10"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest"><CreditCard size={15}/> Налаштування оплати</div><h2 className="text-2xl md:text-3xl font-black uppercase italic mt-2">Посилання для клієнтів</h2><p className="text-sm font-semibold text-blue-50/90 mt-2">Це посилання та реквізити клієнт бачить на сторінці “Тариф”.</p></div><label className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-xs font-black uppercase w-fit"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Активно</label></div><div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-3"><Input label="Назва оплати" value={form.title || ''} onChange={(value) => setForm({ ...form, title: value })} placeholder="VIN-matrix підписка" /><Input label="Сума за місяць" type="number" value={form.monthly_value || 2000} onChange={(value) => setForm({ ...form, monthly_value: value })} placeholder="2000" /><Input className="lg:col-span-2" label="Посилання для оплати" value={form.public_url || ''} onChange={(value) => setForm({ ...form, public_url: value })} placeholder="Вставте посилання на оплату" /><TextArea className="lg:col-span-2" label="Реквізити / примітка" value={form.public_note || ''} onChange={(value) => setForm({ ...form, public_note: value })} placeholder="Наприклад: картка, банка або коротка примітка" /><TextArea className="lg:col-span-2" label="Інструкція для клієнта" value={form.instruction || ''} onChange={(value) => setForm({ ...form, instruction: value })} placeholder="Наприклад: Вкажіть код клієнта при оплаті" /></div><div className="px-5 md:px-6 pb-5 md:pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">{notice ? <p className={`text-sm font-bold rounded-2xl px-4 py-3 ${notice.type === 'error' ? 'bg-rose-500/20 border border-rose-200/20 text-rose-50' : 'bg-white/10 border border-white/15'}`}>{notice.text}</p> : <p className="text-xs font-bold text-blue-50/80">Після збереження клієнти побачать реквізити у своєму тарифі.</p>}<button disabled={saving} className="bg-white text-slate-900 hover:bg-blue-50 rounded-2xl px-6 py-3 text-xs font-black uppercase disabled:opacity-60">{saving ? 'Зберігаю...' : 'Зберегти налаштування'}</button></div></form>; }
function Input({ label, value, onChange, placeholder, type = 'text', className = '' }) { return <label className={className}><span className="block text-[10px] font-black uppercase tracking-widest text-blue-100 mb-2">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-blue-100/50 font-bold outline-none focus:bg-white/15 focus:border-white/40" /></label>; }
function TextArea({ label, value, onChange, placeholder, className = '' }) { return <label className={className}><span className="block text-[10px] font-black uppercase tracking-widest text-blue-100 mb-2">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-h-[82px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-blue-100/50 font-bold outline-none focus:bg-white/15 focus:border-white/40" /></label>; }
function MiniMetric({ label, value }) { return <div className="bg-white rounded-2xl border border-slate-100 px-3 py-2"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-900 truncate">{value}</p></div>; }

export default Partners;
