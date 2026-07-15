import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  CheckCircle2,
  CreditCard,
  Headphones,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
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
};

const formatClientCode = (client) => client?.client_code_display || (client?.client_code ? `C${client.client_code}` : '—');
const money = (value, currency = 'UAH') => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 })} ${currency === 'UAH' ? 'грн' : currency}`;
const niceDate = (value) => value ? new Date(value).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const getClientName = (client) => client.full_name || client.username || formatClientCode(client);

const subscriptionClass = (client) => {
  const status = client.billing_status || client.payment_status;
  if (client.subscription_expired || !client.is_access_enabled || status === 'blocked') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (client.subscription_warning || ['payment_due_soon', 'grace'].includes(status)) return 'bg-orange-50 text-orange-700 border-orange-100';
  if (status === 'trial') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  return data?.details || data?.error || data?.detail || error?.message || 'Невідома помилка';
};

const PartnerClients = () => {
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [alerts, setAlerts] = useState({ expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState(null);
  const [busyClientId, setBusyClientId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [rejectPaymentTarget, setRejectPaymentTarget] = useState(null);
  const [supportTarget, setSupportTarget] = useState(null);
  const [supportBusy, setSupportBusy] = useState(false);
  const [passwordResult, setPasswordResult] = useState(null);

  const showNotice = (type, text) => setNotice({ type, text });
  const isPlatformAdmin = (settings?.actual_role || settings?.account_role) === 'admin' || Boolean(settings?.admin_code);

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

  const loadData = async ({ keepNotice = false } = {}) => {
    setLoading(true);
    if (!keepNotice) setNotice(null);
    try {
      const [clientsRes, statsRes, settingsRes, alertsRes] = await Promise.all([
        api.get('/api/platform-clients/'),
        api.get('/api/platform-clients/stats/'),
        api.get('/api/settings/'),
        api.get('/api/platform-clients/subscription-alerts/'),
      ]);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setStats(statsRes.data || null);
      setSettings(settingsRes.data || null);
      setAlerts(alertsRes.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });
      await loadPayments();
    } catch (error) {
      showNotice('error', `Не вдалося завантажити клієнтів: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const pendingPayments = useMemo(() => payments.filter((payment) => payment.status === 'pending'), [payments]);
  const confirmedPayments = useMemo(() => payments.filter((payment) => payment.status === 'confirmed').slice(0, 6), [payments]);
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => [formatClientCode(client), client.client_code, client.full_name, client.username, client.phone, client.email, client.payment_status, client.billing_status, client.assigned_to]
      .map((value) => String(value || '').toLowerCase()).some((value) => value.includes(q)));
  }, [clients, search]);

  const runClientAction = async (client, request, successMessage, errorPrefix) => {
    setBusyClientId(client.id);
    setNotice(null);
    try {
      await request();
      showNotice('success', successMessage);
      await loadData({ keepNotice: true });
    } catch (error) {
      showNotice('error', `${errorPrefix}: ${getErrorMessage(error)}`);
    } finally {
      setBusyClientId(null);
      setConfirmAction(null);
    }
  };

  const toggleAccess = (client) => runClientAction(
    client,
    () => api.patch(`/api/platform-clients/${client.id}/`, { is_access_enabled: !client.is_access_enabled }),
    client.is_access_enabled ? 'Доступ клієнта вимкнено.' : 'Доступ клієнта увімкнено.',
    'Не вдалося змінити доступ'
  );

  const renewClient = (client) => setConfirmAction({
    tone: 'success',
    title: 'Додати +1 місяць?',
    text: `Підписку для ${getClientName(client)} буде продовжено на місяць.`,
    confirmText: '+1 місяць',
    onConfirm: () => runClientAction(client, () => api.post(`/api/platform-clients/${client.id}/renew-30-days/`), 'Підписку продовжено на місяць.', 'Не вдалося оновити підписку'),
  });

  const resetPassword = (client) => setConfirmAction({
    tone: 'default',
    title: 'Скинути пароль?',
    text: `Для клієнта ${getClientName(client)} буде створено новий тимчасовий пароль. Старий пароль перестане працювати.`,
    confirmText: 'Згенерувати пароль',
    onConfirm: async () => {
      setBusyClientId(client.id);
      setNotice(null);
      try {
        const response = await api.post(`/api/platform-clients/${client.id}/reset-password/`);
        setPasswordResult({
          clientName: getClientName(client),
          username: response.data?.username || client.username || '',
          temporaryPassword: response.data?.temporary_password || '',
        });
      } catch (error) {
        showNotice('error', `Не вдалося скинути пароль: ${getErrorMessage(error)}`);
      } finally {
        setBusyClientId(null);
        setConfirmAction(null);
      }
    },
  });

  const deleteClient = (client) => setConfirmAction({
    tone: 'danger',
    title: 'Видалити клієнта?',
    text: `Клієнт ${getClientName(client)} буде видалений. Дію не варто робити, якщо по клієнту є історія оплат або замовлень.`,
    confirmText: 'Видалити',
    onConfirm: () => runClientAction(client, () => api.delete(`/api/platform-clients/${client.id}/`), 'Клієнта видалено.', 'Не вдалося видалити клієнта'),
  });

  const confirmPayment = (payment) => setConfirmAction({
    tone: 'success',
    title: 'Підтвердити оплату?',
    text: `${money(payment.amount, payment.currency)} для ${payment.client_name}. Після підтвердження доступ буде оновлено.`,
    confirmText: 'Підтвердити',
    onConfirm: async () => {
      setBusyPaymentId(payment.id);
      try {
        await api.post('/api/billing/admin/confirm-payment/', { payment_id: payment.id });
        showNotice('success', 'Оплату підтверджено.');
        await loadData({ keepNotice: true });
      } catch (error) {
        showNotice('error', `Не вдалося підтвердити оплату: ${getErrorMessage(error)}`);
      } finally {
        setBusyPaymentId(null);
        setConfirmAction(null);
      }
    },
  });

  const rejectPayment = async (payment, reason) => {
    setBusyPaymentId(payment.id);
    try {
      await api.post('/api/billing/admin/reject-payment/', { payment_id: payment.id, reason: reason?.trim() || 'Оплата не знайдена' });
      showNotice('success', 'Оплату відхилено.');
      setRejectPaymentTarget(null);
      await loadData({ keepNotice: true });
    } catch (error) {
      showNotice('error', `Не вдалося відхилити оплату: ${getErrorMessage(error)}`);
    } finally {
      setBusyPaymentId(null);
    }
  };

  const startSupportSession = async (client, reason) => {
    setSupportBusy(true);
    try {
      const res = await api.post('/api/support/start/', { client_id: client.id, reason: reason?.trim() || 'Технічна підтримка' });
      const alreadyInSupport = localStorage.getItem('support_mode') === 'true';
      if (!alreadyInSupport) {
        const currentAccess = localStorage.getItem('access_token');
        const currentRefresh = localStorage.getItem('refresh_token');
        if (currentAccess) localStorage.setItem('support_original_access_token', currentAccess);
        if (currentRefresh) localStorage.setItem('support_original_refresh_token', currentRefresh);
      }
      localStorage.setItem('support_mode', 'true');
      localStorage.setItem('support_session_id', res.data.support_session_id || '');
      localStorage.setItem('support_client_name', res.data.client_name || getClientName(client));
      localStorage.setItem('support_company_name', res.data.company_name || '');
      localStorage.setItem('support_expires_at', res.data.expires_at || '');
      localStorage.setItem('access_token', res.data.access);
      localStorage.removeItem('refresh_token');
      window.location.assign('/');
    } catch (error) {
      showNotice('error', `Не вдалося увійти в режим підтримки: ${getErrorMessage(error)}`);
      setSupportBusy(false);
    }
  };

  const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black italic uppercase text-slate-900">Адмін-панель оплат</h1>
          <p className="text-slate-500 font-semibold mt-1">Клієнти, доступ, оплати, підтримка та відновлення пароля.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
          <div><p className="text-[10px] uppercase font-black text-slate-400">Партнерський код</p><p className="text-lg font-black text-blue-700">{settings?.partner_code || settings?.admin_code || '—'}</p></div>
          <CopyButton value={settings?.partner_code || settings?.admin_code} label="Копіювати" copiedLabel="Скопійовано" title="Скопіювати код" showLabel={false} className="p-2 rounded-xl" />
        </div>
      </div>

      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <StatCard label="Клієнтів" value={stats?.my_clients ?? clients.length} />
        <StatCard label="Активних" value={stats?.active_clients ?? clients.filter((c) => c.is_access_enabled).length} tone="emerald" />
        <StatCard label="Заблоковано" value={clients.filter((c) => !c.is_access_enabled || c.billing_status === 'blocked').length} tone="rose" />
        <StatCard label="Очікують оплати" value={pendingPayments.length} tone="amber" />
        <StatCard label="Скоро / минуло" value={(alerts.expiring_count || 0) + (alerts.expired_count || 0)} tone="orange" />
      </div>

      <section className="bg-gradient-to-r from-slate-900 via-blue-800 to-cyan-600 rounded-[30px] shadow-xl shadow-blue-100 overflow-hidden text-white">
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10">
          <div><div className="inline-flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest"><CreditCard size={15}/> Очікують підтвердження</div><h2 className="text-2xl font-black uppercase italic mt-2">Заявки на оплату</h2></div>
          <button type="button" onClick={loadPayments} disabled={paymentsLoading} className="bg-white/15 border border-white/20 hover:bg-white/20 px-4 py-2 rounded-2xl text-xs font-black uppercase inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={15}/> {paymentsLoading ? 'Оновлюємо...' : 'Оновити'}</button>
        </div>
        {paymentsLoading ? <div className="p-6 font-bold text-blue-100">Завантаження оплат...</div> : pendingPayments.length === 0 ? <div className="p-6 text-blue-100 font-bold">Немає заявок, які очікують підтвердження.</div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 md:p-6">{pendingPayments.map((payment) => <PaymentCard key={payment.id} payment={payment} busy={busyPaymentId === payment.id} onConfirm={confirmPayment} onReject={setRejectPaymentTarget} />)}</div>
        )}
      </section>

      {alertList.length > 0 && <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4"><div className="flex items-center gap-2 mb-3"><AlertTriangle className="text-orange-600" size={20}/><h3 className="font-black text-orange-800">Оплата скоро закінчиться або вже прострочена</h3></div><div className="grid md:grid-cols-2 gap-2">{alertList.map((item) => <div key={item.id} className="bg-white/70 rounded-xl px-3 py-2 text-sm font-bold text-slate-700">{item.client_code_display} · {item.full_name} · до {item.subscription_end_display || '—'}</div>)}</div></div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук по коду, ПІБ, телефону або логіну" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm outline-none focus:border-blue-500" /></div></div>

      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <div className="p-6 text-slate-500 font-semibold flex items-center gap-2"><Loader2 className="animate-spin" size={17}/> Завантаження...</div> : filteredClients.length === 0 ? <div className="p-8 text-center text-slate-500 font-semibold"><Users className="mx-auto mb-3 text-slate-300" size={36}/>Клієнтів ще немає.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black"><tr><th className="text-left px-4 py-3">Код</th><th className="text-left px-4 py-3">Клієнт</th><th className="text-left px-4 py-3">Телефон</th><th className="text-left px-4 py-3">Логін</th><th className="text-left px-4 py-3">Статус / дата</th><th className="text-left px-4 py-3">Доступ</th><th className="text-right px-4 py-3">Дії</th></tr></thead><tbody className="divide-y divide-slate-100">
            {filteredClients.map((client) => {
              const code = formatClientCode(client);
              const busy = busyClientId === client.id;
              return <tr key={client.id} className="hover:bg-slate-50"><td className="px-4 py-3"><CopyButton value={code} label={code} compact /></td><td className="px-4 py-3"><p className="font-bold text-slate-800">{client.full_name || '—'}</p>{client.email && <p className="text-xs text-slate-400">{client.email}</p>}</td><td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{client.phone || '—'}</td><td className="px-4 py-3 text-slate-600">{client.username || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded-lg border font-bold text-xs ${subscriptionClass(client)}`}>{client.subscription_label || statusLabel[client.billing_status] || statusLabel[client.payment_status] || client.payment_status || '—'}{client.subscription_end_display ? ` · до ${client.subscription_end_display}` : ''}</span></td><td className="px-4 py-3">{client.is_access_enabled ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><BadgeCheck size={16}/> Увімкнено</span> : <span className="inline-flex items-center gap-1 text-rose-700 font-bold"><BadgeX size={16}/> Вимкнено</span>}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-2 flex-wrap">
                {isPlatformAdmin && <button disabled={busy || supportBusy} onClick={() => setSupportTarget(client)} className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 font-bold text-blue-700 inline-flex items-center gap-1 disabled:opacity-60"><Headphones size={15}/> Підтримка</button>}
                <button disabled={busy} onClick={() => resetPassword(client)} className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 font-bold text-amber-700 inline-flex items-center gap-1 disabled:opacity-60"><KeyRound size={15}/> Скинути пароль</button>
                <button disabled={busy} onClick={() => renewClient(client)} className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-700 inline-flex items-center gap-1 disabled:opacity-60"><RefreshCw size={15}/> +1 місяць</button>
                <button disabled={busy} onClick={() => toggleAccess(client)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 inline-flex items-center gap-1 disabled:opacity-60"><Power size={15}/> {client.is_access_enabled ? 'Вимкнути' : 'Увімкнути'}</button>
                <button disabled={busy} onClick={() => deleteClient(client)} className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 font-bold text-rose-700 inline-flex items-center gap-1 disabled:opacity-60"><Trash2 size={15}/> Видалити</button>
              </div></td></tr>;
            })}
          </tbody></table></div>
        )}
      </div>

      {confirmedPayments.length > 0 && <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-5"><h3 className="font-black uppercase text-slate-900 mb-3">Останні підтверджені оплати</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{confirmedPayments.map((payment) => <div key={payment.id} className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm font-bold text-emerald-800">{payment.client_name} · {money(payment.amount, payment.currency)} · до {payment.period_end ? niceDate(payment.period_end) : '—'}</div>)}</div></div>}

      {confirmAction && <ConfirmDialog action={confirmAction} busy={Boolean(busyClientId || busyPaymentId)} onClose={() => setConfirmAction(null)} />}
      {rejectPaymentTarget && <RejectPaymentDialog payment={rejectPaymentTarget} busy={busyPaymentId === rejectPaymentTarget.id} onClose={() => setRejectPaymentTarget(null)} onConfirm={rejectPayment} />}
      {supportTarget && <SupportConfirmDialog client={supportTarget} busy={supportBusy} onClose={() => setSupportTarget(null)} onConfirm={startSupportSession} />}
      {passwordResult && <PasswordResultDialog result={passwordResult} onClose={() => setPasswordResult(null)} />}
    </div>
  );
};

function Notice({ notice, onClose }) {
  const isError = notice.type === 'error';
  return <div className={`${isError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-blue-100 bg-blue-50 text-blue-800'} rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-between gap-3`}><span>{notice.text}</span><button type="button" onClick={onClose} className="opacity-70 hover:opacity-100"><X size={16}/></button></div>;
}

function PaymentCard({ payment, busy, onConfirm, onReject }) {
  return <div className="bg-white text-slate-900 rounded-3xl p-4 shadow-lg"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-slate-400">{payment.client_code ? `C${payment.client_code}` : 'Клієнт'}</p><h3 className="text-lg font-black text-slate-900">{payment.client_name}</h3><p className="text-xs font-bold text-slate-500 mt-1">{payment.method_label} · {niceDate(payment.created_at)}</p></div><span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-3 py-1 text-[10px] font-black uppercase">{paymentStatusLabel[payment.status] || payment.status}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><MiniMetric label="Сума" value={money(payment.amount, payment.currency)} /><MiniMetric label="Метод" value={payment.method_label} /></div>{payment.comment && <p className="mt-3 text-xs font-semibold text-slate-500 bg-slate-50 rounded-2xl px-3 py-2">{payment.comment}</p>}<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2"><button disabled={busy} onClick={() => onConfirm(payment)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-3 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60"><CheckCircle2 size={16}/> Підтвердити</button><button disabled={busy} onClick={() => onReject(payment)} className="bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl px-3 py-3 text-xs font-black uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60"><XCircle size={16}/> Відхилити</button></div></div>;
}

function ConfirmDialog({ action, busy, onClose }) {
  const isDanger = action.tone === 'danger';
  const isSuccess = action.tone === 'success';
  return <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden"><div className={`${isDanger ? 'bg-rose-50 border-rose-100' : isSuccess ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} p-5 border-b flex items-start gap-3`}><div className={`${isDanger ? 'bg-rose-100 text-rose-700' : isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} w-12 h-12 rounded-2xl flex items-center justify-center shrink-0`}><AlertTriangle size={22}/></div><div><h3 className="text-xl font-black uppercase text-slate-900">{action.title}</h3><p className="text-sm font-bold text-slate-600 mt-1">{action.text}</p></div></div><div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button><button type="button" disabled={busy} onClick={action.onConfirm} className={`${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-2xl text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60`}>{busy ? 'Виконується...' : action.confirmText || 'Підтвердити'}</button></div></div></div>;
}

function PasswordResultDialog({ result, onClose }) {
  return <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden"><div className="p-5 bg-amber-50 border-b border-amber-100 flex items-start gap-3"><div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"><KeyRound size={22}/></div><div><h3 className="text-xl font-black uppercase text-slate-900">Новий пароль створено</h3><p className="text-sm font-bold text-slate-600 mt-1">{result.clientName}</p></div></div><div className="p-5 space-y-4"><div className="bg-slate-50 rounded-2xl p-4"><p className="text-[10px] font-black uppercase text-slate-400">Логін</p><div className="mt-1 flex items-center justify-between gap-2"><code className="font-black text-slate-900 break-all">{result.username}</code><CopyButton value={result.username} label="Копіювати" compact /></div></div><div className="bg-slate-900 rounded-2xl p-4 text-white"><p className="text-[10px] font-black uppercase text-slate-400">Тимчасовий пароль</p><div className="mt-2 flex items-center justify-between gap-2"><code className="font-black text-lg break-all">{result.temporaryPassword}</code><CopyButton value={result.temporaryPassword} label="Копіювати" compact /></div></div><p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">Пароль показується лише зараз. Передайте його клієнту безпечним способом. Після входу клієнт зможе змінити пароль у налаштуваннях.</p><button type="button" onClick={onClose} className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-xs font-black uppercase">Готово</button></div></div></div>;
}

function RejectPaymentDialog({ payment, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('Оплата не знайдена');
  return <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={(event) => { event.preventDefault(); onConfirm(payment, reason); }} className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden"><div className="p-5 bg-rose-50 border-b border-rose-100"><h3 className="text-xl font-black uppercase text-slate-900">Відхилити оплату?</h3><p className="text-sm font-bold text-slate-600 mt-1">{payment.client_name} · {money(payment.amount, payment.currency)}</p></div><div className="p-5 space-y-4"><label className="block"><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Причина відхилення</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="w-full min-h-[92px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 resize-none" /></label><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button><button disabled={busy} className="rounded-2xl bg-rose-600 text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60">{busy ? 'Виконується...' : 'Відхилити'}</button></div></div></form></div>;
}

function SupportConfirmDialog({ client, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('Технічна підтримка');
  return <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={(event) => { event.preventDefault(); onConfirm(client, reason); }} className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden"><div className="p-5 bg-blue-50 border-b border-blue-100 flex items-start gap-3"><div className="bg-blue-100 text-blue-700 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"><Headphones size={22}/></div><div><h3 className="text-xl font-black uppercase text-slate-900">Увійти в режим підтримки?</h3><p className="text-sm font-bold text-slate-600 mt-1">{formatClientCode(client)} · {getClientName(client)} · {client.company_name || client.company || 'Компанія клієнта'}</p></div></div><div className="p-5 space-y-4"><label className="block"><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Причина звернення</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="w-full min-h-[96px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 resize-none" /></label><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button><button disabled={busy} className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60">{busy ? 'Входимо...' : 'Підтвердити'}</button></div></div></form></div>;
}

function StatCard({ label, value, tone = 'slate' }) {
  const color = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'orange' ? 'text-orange-600' : 'text-slate-900';
  return <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-400">{label}</p><p className={`text-3xl font-black mt-1 ${color}`}>{value}</p></div>;
}

function MiniMetric({ label, value }) {
  return <div className="bg-slate-50 rounded-2xl px-3 py-2"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className="font-black text-slate-900 truncate">{value}</p></div>;
}

export default PartnerClients;
