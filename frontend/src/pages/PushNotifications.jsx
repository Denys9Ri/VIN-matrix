import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import api from '../api/axios';
import useToast from '../components/ui/useToast';

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
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  await navigator.serviceWorker.ready;
  return registration;
};

const permissionLabel = (permission) => ({
  granted: 'Дозволено',
  denied: 'Заблоковано',
  default: 'Ще не запитували',
}[permission] || permission);

export default function PushNotifications() {
  const toast = useToast();
  const supported = isPushSupported();
  const platform = useMemo(() => platformState(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [server, setServer] = useState({ server_ready: false, public_key: '', active_subscriptions: 0 });
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(() => (
    supported ? Notification.permission : 'unsupported'
  ));

  const syncSubscription = async (currentSubscription) => {
    if (!currentSubscription) return;
    await api.post('/api/push/subscribe/', {
      subscription: currentSubscription.toJSON(),
    });
  };

  const refresh = async ({ syncExisting = false } = {}) => {
    setLoading(true);
    try {
      const response = await api.get('/api/push/status/');
      setServer(response.data || {});

      if (!supported) return;
      setPermission(Notification.permission);
      const registration = await getPushRegistration();
      const currentSubscription = await registration.pushManager.getSubscription();
      setSubscription(currentSubscription);

      if (syncExisting && currentSubscription && Notification.permission === 'granted') {
        await syncSubscription(currentSubscription);
        const refreshed = await api.get('/api/push/status/');
        setServer(refreshed.data || {});
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося перевірити push-сповіщення.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh({ syncExisting: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enableNotifications = async () => {
    if (!supported) return toast.error('Цей браузер не підтримує Web Push.');
    if (platform.isIos && !platform.standalone) {
      return toast.warning('На iPhone відкрийте VIN Matrix з іконки на робочому столі.');
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
        setServer(response.data || {});
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
      const message = error.response?.data?.error || 'Не вдалося увімкнути сповіщення.';
      toast.error(message);
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

  const sendTest = async () => {
    if (!subscription) return toast.warning('Спочатку увімкніть сповіщення.');
    setBusy('test');
    try {
      await syncSubscription(subscription);
      const response = await api.post('/api/push/test/', { endpoint: subscription.endpoint });
      toast.success(response.data?.message || 'Тестове сповіщення відправлено.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не вдалося відправити тестове сповіщення.');
      if ([404, 409].includes(error.response?.status)) await refresh();
    } finally {
      setBusy('');
    }
  };

  const enabled = Boolean(subscription) && permission === 'granted';
  const statusTone = !supported
    ? 'rose'
    : platform.isIos && !platform.standalone
      ? 'amber'
      : permission === 'denied'
        ? 'rose'
        : enabled
          ? 'emerald'
          : 'blue';

  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  }[statusTone];

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 px-3 py-5 md:px-6 md:py-8">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-950 via-blue-900 to-blue-600 p-6 text-white md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100">
              <BellRing size={28} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">PWA · Web Push</p>
              <h1 className="mt-1 text-2xl font-black uppercase tracking-tight md:text-4xl">Сповіщення</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-blue-100 md:text-base">
                Увімкніть системні push-сповіщення VIN Matrix на цьому пристрої. Вони можуть приходити навіть коли програма закрита.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${toneClasses}`}>
              {enabled ? <CheckCircle2 size={15} /> : <Bell size={15} />}
              {enabled ? 'Увімкнено на цьому пристрої' : 'Потрібне налаштування'}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatusBox label="Браузер" value={supported ? 'Підтримує Push' : 'Push недоступний'} />
              <StatusBox label="Дозвіл" value={permissionLabel(permission)} />
              <StatusBox label="Пристрої акаунта" value={String(server.active_subscriptions || 0)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            {!enabled && (
              <ActionButton onClick={enableNotifications} disabled={loading || Boolean(busy)} primary>
                {busy === 'enable' ? <Loader2 className="animate-spin" size={17} /> : <BellRing size={17} />}
                Увімкнути сповіщення
              </ActionButton>
            )}
            {enabled && (
              <>
                <ActionButton onClick={sendTest} disabled={Boolean(busy)} primary>
                  {busy === 'test' ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                  Тестове повідомлення
                </ActionButton>
                <ActionButton onClick={disableNotifications} disabled={Boolean(busy)}>
                  {busy === 'disable' ? <Loader2 className="animate-spin" size={17} /> : <BellOff size={17} />}
                  Вимкнути
                </ActionButton>
              </>
            )}
          </div>
        </div>
      </section>

      {platform.isIos && !platform.standalone && (
        <InfoPanel tone="amber" icon={<Smartphone size={21} />} title="На iPhone потрібна встановлена PWA">
          Відкрийте VIN Matrix у Safari → «Поділитися» → «На початковий екран», а потім запускайте програму саме з іконки на робочому столі.
        </InfoPanel>
      )}

      {permission === 'denied' && (
        <InfoPanel tone="rose" icon={<AlertTriangle size={21} />} title="Сповіщення заблоковані системою">
          Дозвіл уже був відхилений. Відкрийте налаштування сповіщень iPhone для VIN Matrix і дозвольте повідомлення, після чого поверніться сюди.
        </InfoPanel>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <InfoPanel tone="blue" icon={<ShieldCheck size={21} />} title="Безпечна підписка">
          Push-підписка прив'язується до вашого акаунта і конкретного пристрою. VIN Matrix не просить Apple Developer Account і не зберігає пароль від Apple ID.
        </InfoPanel>
        <InfoPanel tone="slate" icon={<Bell size={21} />} title="Що буде далі">
          Після перевірки тестового push ми підключимо реальні події: записи, готовність авто, борги та статуси замовлень. На цьому етапі бізнес-логіку ще не змінюємо.
        </InfoPanel>
      </section>
    </div>
  );
}

function StatusBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-5 text-xs font-black uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function InfoPanel({ tone, icon, title, children }) {
  const classes = {
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  }[tone] || 'border-slate-200 bg-white text-slate-900';

  return (
    <section className={`rounded-[28px] border p-5 shadow-sm ${classes}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed opacity-80">{children}</p>
        </div>
      </div>
    </section>
  );
}
