import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  Send,
  Smartphone,
  Truck,
  WalletCards,
} from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/ui/useToast';
import NotificationAutomationSettings from '../components/notifications/NotificationAutomationSettings';

const DEFAULT_PREFERENCES = {
  visit_reminders: true,
  status_updates: true,
  payments: true,
  inventory: true,
  delivery: true,
  crm: true,
};

const NOTIFICATION_CATEGORIES = [
  {
    key: 'visit_reminders',
    title: 'Записи та нагадування',
    description: 'Нагадування перед запланованим приїздом авто та важливі події по графіку.',
    icon: CalendarClock,
  },
  {
    key: 'status_updates',
    title: 'Статус авто та робіт',
    description: 'Миттєво, коли змінюється статус візиту, авто або виконуваної роботи.',
    icon: CarFront,
  },
  {
    key: 'payments',
    title: 'Борги та оплати',
    description: 'Зведення по боргах за вашим розкладом та важливі зміни статусу оплати.',
    icon: WalletCards,
  },
  {
    key: 'inventory',
    title: 'Запчастини та склад',
    description: 'Миттєві зміни статусу запчастин та події, які потребують уваги.',
    icon: PackageSearch,
  },
  {
    key: 'delivery',
    title: 'Доставка',
    description: 'Зміни статусу доставки, прибуття, повернення та ТТН.',
    icon: Truck,
  },
  {
    key: 'crm',
    title: 'CRM, задачі та рекомендації',
    description: 'Задачі, сервісні нагадування і рекомендації по авто до потрібної дати.',
    icon: ClipboardCheck,
  },
];

const isPushSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
);

const platformState = () => {
  if (typeof window === 'undefined') return { isIos: false, standalone: false };
  const ua = window.navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/i.test(ua)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  return { isIos, standalone };
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const getPushRegistration = async () => {
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
};

const permissionLabel = (permission) => ({
  granted: 'Дозволено',
  denied: 'Заблоковано',
  default: 'Не запитували',
}[permission] || permission);

export default function PushNotifications() {
  const toast = useToast();
  const supported = isPushSupported();
  const platform = useMemo(() => platformState(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [savingPreference, setSavingPreference] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [server, setServer] = useState({ server_ready: false, public_key: '', active_subscriptions: 0 });
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'unsupported'));

  const syncSubscription = async (currentSubscription) => {
    if (!currentSubscription) return;
    await api.post('/api/push/subscribe/', { subscription: currentSubscription.toJSON() });
  };

  const applyServerState = (data) => {
    const next = data || {};
    setServer(next);
    if (next.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...next.preferences });
  };

  const refresh = async ({ syncExisting = false } = {}) => {
    setLoading(true);
    try {
      const response = await api.get('/api/push/status/');
      applyServerState(response.data);
      if (!supported) return;

      setPermission(Notification.permission);
      const registration = await getPushRegistration();
      const currentSubscription = await registration.pushManager.getSubscription();
      setSubscription(currentSubscription);

      if (syncExisting && currentSubscription && Notification.permission === 'granted') {
        await syncSubscription(currentSubscription);
        const refreshed = await api.get('/api/push/status/');
        applyServerState(refreshed.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося завантажити налаштування сповіщень.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh({ syncExisting: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enableNotifications = async () => {
    if (!supported) return toast.error('Цей браузер не підтримує системні сповіщення.');
    if (platform.isIos && !platform.standalone) {
      return toast.warning('На iPhone відкрийте VIN Matrix з іконки на початковому екрані.');
    }

    setBusy('enable');
    try {
      let nextPermission = Notification.permission;
      if (nextPermission === 'default') nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        toast.warning('Дозвіл на сповіщення не надано.');
        return;
      }

      let publicKey = server.public_key;
      if (!publicKey) {
        const response = await api.get('/api/push/status/');
        publicKey = response.data?.public_key || '';
        applyServerState(response.data);
      }
      if (!publicKey) throw new Error('VAPID public key is missing');

      const registration = await getPushRegistration();
      let currentSubscription = await registration.pushManager.getSubscription();
      if (!currentSubscription) {
        currentSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      await syncSubscription(currentSubscription);
      setSubscription(currentSubscription);
      toast.success('Сповіщення VIN Matrix увімкнено.');
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося увімкнути сповіщення.');
    } finally {
      setBusy('');
    }
  };

  const disableNotifications = async () => {
    if (!subscription) return;
    setBusy('disable');
    const endpoint = subscription.endpoint;
    try {
      await api.post('/api/push/unsubscribe/', { endpoint }).catch(() => null);
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success('Сповіщення на цьому пристрої вимкнено.');
      await refresh();
    } catch {
      toast.error('Не вдалося вимкнути сповіщення.');
    } finally {
      setBusy('');
    }
  };

  const togglePreference = async (key) => {
    const previous = preferences[key];
    const next = !previous;
    setSavingPreference(key);
    setPreferences((current) => ({ ...current, [key]: next }));
    try {
      const response = await api.patch('/api/push/preferences/', { preferences: { [key]: next } });
      if (response.data?.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...response.data.preferences });
    } catch (error) {
      setPreferences((current) => ({ ...current, [key]: previous }));
      toast.error(error.response?.data?.error || 'Не вдалося зберегти налаштування.');
    } finally {
      setSavingPreference('');
    }
  };

  const sendDiagnostic = async () => {
    if (!subscription) return toast.warning('Спочатку увімкніть сповіщення.');
    setBusy('test');
    try {
      await syncSubscription(subscription);
      const response = await api.post('/api/push/test/', { endpoint: subscription.endpoint });
      toast.success(response.data?.message || 'Перевірочне сповіщення відправлено.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося відправити перевірочне сповіщення.');
      if ([404, 409].includes(error.response?.status)) await refresh();
    } finally {
      setBusy('');
    }
  };

  const enabled = Boolean(subscription) && permission === 'granted';
  const selectedCount = NOTIFICATION_CATEGORIES.filter(({ key }) => Boolean(preferences[key])).length;

  return (
    <div className="mx-auto max-w-[1120px] space-y-5 px-3 py-5 md:px-6 md:py-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-900 p-6 text-white md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100 ring-1 ring-white/10"><BellRing size={27} /></span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">VIN Matrix</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-4xl">Сповіщення</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-slate-300 md:text-base">Отримуйте важливі події по роботі навіть коли VIN Matrix закрита. Ви самі обираєте що і коли отримувати.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              {enabled ? <CheckCircle2 size={15} /> : <Bell size={15} />}
              {enabled ? 'Сповіщення активні' : 'Сповіщення вимкнені'}
            </div>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
              {enabled ? `На цьому пристрої все налаштовано. Обрано ${selectedCount} із ${NOTIFICATION_CATEGORIES.length} категорій.` : 'Увімкніть сповіщення на цьому пристрої, щоб не пропускати важливі події.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            {!enabled ? (
              <ActionButton onClick={enableNotifications} disabled={loading || Boolean(busy)} primary>
                {busy === 'enable' ? <Loader2 className="animate-spin" size={17} /> : <BellRing size={17} />}
                Увімкнути сповіщення
              </ActionButton>
            ) : (
              <ActionButton onClick={disableNotifications} disabled={Boolean(busy)}>
                {busy === 'disable' ? <Loader2 className="animate-spin" size={17} /> : <BellOff size={17} />}
                Вимкнути на цьому пристрої
              </ActionButton>
            )}
          </div>
        </div>
      </section>

      {platform.isIos && !platform.standalone && (
        <InfoPanel tone="amber" icon={<Smartphone size={21} />} title="На iPhone відкрийте VIN Matrix з іконки">Для системних сповіщень iPhone програма має бути додана на початковий екран і запущена саме звідти.</InfoPanel>
      )}

      {permission === 'denied' && (
        <InfoPanel tone="rose" icon={<AlertTriangle size={21} />} title="Сповіщення заблоковані в налаштуваннях пристрою">Дозвольте сповіщення для VIN Matrix у системних налаштуваннях, після чого поверніться на цю сторінку.</InfoPanel>
      )}

      <section className={`rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-6 ${!enabled ? 'opacity-60' : ''}`}>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-black text-slate-950 md:text-xl">Що надсилати</h2><p className="mt-1 text-sm font-semibold text-slate-500">Зміни зберігаються автоматично для вашого акаунта.</p></div>
          <span className="text-xs font-black text-slate-400">{selectedCount}/{NOTIFICATION_CATEGORIES.length} увімкнено</span>
        </div>

        <div className="divide-y divide-slate-100">
          {NOTIFICATION_CATEGORIES.map(({ key, title, description, icon: Icon }) => (
            <div key={key} className="flex items-center gap-4 py-4 md:py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Icon size={21} /></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-black text-slate-950 md:text-base">{title}</h3><p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 md:text-sm">{description}</p></div>
              <PreferenceSwitch checked={Boolean(preferences[key])} disabled={!enabled || loading || Boolean(savingPreference)} loading={savingPreference === key} onChange={() => togglePreference(key)} label={title} />
            </div>
          ))}
        </div>
      </section>

      <NotificationAutomationSettings enabled={enabled} />

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setShowDiagnostics((current) => !current)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
          <div><p className="text-sm font-black text-slate-800">Діагностика сповіщень</p><p className="mt-0.5 text-xs font-semibold text-slate-400">Перевірка дозволу та доставки на цьому пристрої</p></div>
          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${showDiagnostics ? 'rotate-180' : ''}`} />
        </button>

        {showDiagnostics && (
          <div className="border-t border-slate-100 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusBox label="Браузер" value={supported ? 'Підтримується' : 'Недоступно'} />
              <StatusBox label="Дозвіл" value={permissionLabel(permission)} />
              <StatusBox label="Активні пристрої" value={String(server.active_subscriptions || 0)} />
            </div>
            {enabled && <div className="mt-4"><ActionButton onClick={sendDiagnostic} disabled={Boolean(busy)}>{busy === 'test' ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}Надіслати перевірочне повідомлення</ActionButton></div>}
          </div>
        )}
      </section>
    </div>
  );
}

function PreferenceSwitch({ checked, disabled, loading, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-all ${checked ? 'left-6' : 'left-1'}`}>{loading && <Loader2 size={11} className="animate-spin text-slate-500" />}</span>
    </button>
  );
}

function StatusBox({ label, value }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value}</p></div>;
}

function ActionButton({ children, onClick, disabled, primary = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{children}</button>;
}

function InfoPanel({ tone, icon, title, children }) {
  const classes = { amber: 'border-amber-200 bg-amber-50 text-amber-950', rose: 'border-rose-200 bg-rose-50 text-rose-900' }[tone] || 'border-slate-200 bg-white text-slate-900';
  return <section className={`rounded-[24px] border p-5 shadow-sm ${classes}`}><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0">{icon}</span><div><h2 className="text-sm font-black">{title}</h2><p className="mt-1.5 text-sm font-semibold leading-relaxed opacity-80">{children}</p></div></div></section>;
}
