import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import api from '../api/axios';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import useToast from '../components/ui/useToast';

const ACCESS_OPTIONS = [
  { key: 'can_view_all_visits', label: 'Усі візити', description: 'Бачить записи всієї компанії.' },
  { key: 'can_view_client_phone', label: 'Телефони клієнтів', description: 'Бачить контактні номери у відповідях.' },
  { key: 'can_create_visits', label: 'Створення записів', description: 'Може готувати нові записи.' },
  { key: 'can_update_visits', label: 'Зміна записів', description: 'Може готувати зміни існуючих записів.' },
  { key: 'can_search_parts', label: 'Пошук запчастин', description: 'Може запускати пошук за артикулом.' },
  { key: 'can_add_parts', label: 'Додавання запчастин', description: 'Може готувати додавання у замовлення.' },
  { key: 'can_view_finances', label: 'Фінансові дані', description: 'Бачить суми та фінансові показники.' },
];

const ACTION_LABELS = {
  connection_code_created: 'Створено код підключення',
  channel_linked: 'Підключено Telegram',
  daily_schedule: 'Запит розкладу',
  find_visit: 'Пошук візиту',
  help: 'Відкрито підказку Agent',
  unsupported_message: 'Непідтримуване повідомлення',
  internal_error: 'Технічна помилка',
  agent_settings_updated: 'Оновлено налаштування Agent',
  agent_member_access_updated: 'Оновлено доступ працівника',
  pending_action_created: 'Створено дію для підтвердження',
  pending_action_confirmed: 'Підтверджено дію',
  pending_action_cancelled: 'Скасовано дію',
};

const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.message === 'string') return data.message;
  return fallback;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const formatRemaining = (value) => {
  if (!value) return '';
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'код уже неактивний';
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `діє ще ${minutes} хв`;
};

const actionLabel = (entry) => ACTION_LABELS[entry?.recognized_intent]
  || entry?.tool_name
  || 'Дія VIN-matrix Agent';

function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900">{label}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${checked ? 'bg-blue-600' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed opacity-55' : 'hover:brightness-95'}`}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function EmptyState({ icon, title, text, children }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
      <div className="mb-3 rounded-2xl bg-white p-3 text-slate-400 shadow-sm">{icon}</div>
      <p className="text-sm font-black text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function Agent() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditScope, setAuditScope] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [savingSetting, setSavingSetting] = useState('');
  const [limitDraft, setLimitDraft] = useState('0');
  const [connectionCode, setConnectionCode] = useState(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberDraft, setMemberDraft] = useState({});
  const [savingMember, setSavingMember] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  const loadData = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setPageError('');

    try {
      const statusResponse = await api.get('/api/agent/status/');
      const nextStatus = statusResponse.data || {};
      setStatus(nextStatus);

      const [settingsResult, membersResult, pendingResult, auditResult] = await Promise.allSettled([
        api.get('/api/agent/settings/'),
        api.get('/api/agent/member-access/'),
        api.get('/api/agent/pending-actions/'),
        api.get('/api/agent/audit-log/?limit=50'),
      ]);

      if (settingsResult.status === 'fulfilled') {
        const nextSettings = settingsResult.value.data || {};
        setSettings(nextSettings);
        setLimitDraft(String(nextSettings.monthly_action_limit ?? 0));
      } else {
        setSettings(null);
      }

      setMembers(membersResult.status === 'fulfilled' && Array.isArray(membersResult.value.data)
        ? membersResult.value.data : []);
      setPendingActions(pendingResult.status === 'fulfilled' && Array.isArray(pendingResult.value.data)
        ? pendingResult.value.data : []);

      if (auditResult.status === 'fulfilled') {
        const data = auditResult.value.data || {};
        setAudit(Array.isArray(data.items) ? data.items : []);
        setAuditScope(data.scope || 'personal');
      } else {
        setAudit([]);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Не вдалося завантажити дані VIN-matrix Agent.');
      setPageError(message);
      if (!silent) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isOwner = Boolean(settings);
  const agentEnabled = settings?.is_enabled ?? status?.agent_enabled ?? false;
  const telegramEnabled = settings?.telegram_enabled ?? status?.capabilities?.telegram ?? false;
  const hasTelegram = (status?.channels || []).some((channel) => channel.channel_type === 'telegram');
  const canGenerateCode = agentEnabled && telegramEnabled;

  const updateSettings = async (patch) => {
    if (!settings) return;
    const settingKey = Object.keys(patch)[0] || 'settings';
    setSavingSetting(settingKey);
    try {
      await api.patch('/api/agent/settings/', patch);
      setSettings((previous) => ({ ...previous, ...patch }));
      setStatus((previous) => ({
        ...previous,
        agent_enabled: patch.is_enabled ?? previous?.agent_enabled,
        capabilities: {
          ...(previous?.capabilities || {}),
          telegram: patch.telegram_enabled ?? previous?.capabilities?.telegram,
          viber: patch.viber_enabled ?? previous?.capabilities?.viber,
          voice: patch.allow_voice ?? previous?.capabilities?.voice,
          images: patch.allow_images ?? previous?.capabilities?.images,
          write_confirmation_required: patch.require_confirmation_for_writes
            ?? previous?.capabilities?.write_confirmation_required,
        },
      }));
      toast.success('Налаштування Agent збережено.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не вдалося зберегти налаштування Agent.'));
    } finally {
      setSavingSetting('');
    }
  };

  const saveLimit = async () => {
    const numericLimit = Math.max(0, Number.parseInt(limitDraft, 10) || 0);
    setLimitDraft(String(numericLimit));
    await updateSettings({ monthly_action_limit: numericLimit });
  };

  const createTelegramCode = async () => {
    if (!canGenerateCode) {
      toast.warning('Спочатку увімкніть VIN-matrix Agent і Telegram у налаштуваннях.');
      return;
    }
    setCreatingCode(true);
    try {
      const response = await api.post('/api/agent/connect-code/', { channel_type: 'telegram' });
      setConnectionCode(response.data || null);
      toast.success('Одноразовий код Telegram створено.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не вдалося створити код підключення.'));
    } finally {
      setCreatingCode(false);
    }
  };

  const copyConnectionCode = async () => {
    if (!connectionCode?.code) return;
    try {
      await navigator.clipboard.writeText(`/start ${connectionCode.code}`);
      toast.success('Команду скопійовано. Надішліть її боту у Telegram.');
    } catch {
      toast.warning('Не вдалося скопіювати автоматично. Скопіюйте код вручну.');
    }
  };

  const openMemberEditor = (member) => {
    if (member.is_owner) return;
    setEditingMember(member);
    setMemberDraft({
      is_enabled: Boolean(member.is_enabled),
      ...(member.access || {}),
    });
  };

  const saveMember = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      await api.patch('/api/agent/member-access/', {
        user_id: editingMember.user_id,
        ...memberDraft,
      });
      setMembers((previous) => previous.map((member) => (
        member.user_id === editingMember.user_id
          ? {
            ...member,
            is_enabled: Boolean(memberDraft.is_enabled),
            access: ACCESS_OPTIONS.reduce((result, option) => ({
              ...result,
              [option.key]: Boolean(memberDraft[option.key]),
            }), {}),
          }
          : member
      )));
      setEditingMember(null);
      toast.success('Доступ працівника оновлено.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не вдалося оновити доступ працівника.'));
    } finally {
      setSavingMember(false);
    }
  };

  const decidePendingAction = async (action, decision) => {
    if (decision === 'confirm' && !window.confirm(`Підтвердити дію?\n\n${action.summary_text}`)) return;
    setActionInProgress(action.id);
    try {
      const response = await api.post(`/api/agent/pending-actions/${action.id}/decision/`, { decision });
      setPendingActions((previous) => previous.filter((item) => item.id !== action.id));
      toast.success(response.data?.detail || (decision === 'confirm' ? 'Дію підтверджено.' : 'Дію скасовано.'));
      await loadData({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не вдалося обробити дію.'));
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Завантажуємо VIN-matrix Agent…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
              <Sparkles size={14} /> VIN-matrix Agent
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Робочий центр Agent</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Керуйте Telegram, доступами команди, підтвердженнями дій та журналом роботи — без втрати контролю над даними компанії.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <div className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${agentEnabled ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/25 bg-amber-400/10 text-amber-100'}`}>
              {agentEnabled ? <CheckCircle2 size={18} /> : <Power size={18} />}
              {agentEnabled ? 'Agent увімкнений' : 'Agent вимкнений'}
            </div>
            <Button
              variant="secondary"
              size="md"
              loading={refreshing}
              icon={<RefreshCw size={16} />}
              onClick={() => loadData({ silent: true })}
              className="border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white"
            >
              Оновити дані
            </Button>
          </div>
        </div>
      </section>

      {pageError && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div><strong className="font-black">Не вдалося оновити Agent.</strong><p className="mt-1">{pageError}</p></div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card padding="md" className="relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Стан сервісу</p>
              <p className="mt-2 text-lg font-black text-slate-950">{agentEnabled ? 'Готовий до роботи' : 'Потребує увімкнення'}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{agentEnabled ? 'Команди та підтвердження доступні згідно з правами працівника.' : 'Увімкніть Agent, щоб користуватися Telegram та діями.'}</p>
            </div>
            <div className={`rounded-2xl p-3 ${agentEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {agentEnabled ? <CheckCircle2 size={23} /> : <Power size={23} />}
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Telegram</p>
              <p className="mt-2 text-lg font-black text-slate-950">{hasTelegram ? 'Підключено' : telegramEnabled ? 'Готовий до підключення' : 'Вимкнений'}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{hasTelegram ? 'Ваш акаунт прив’язаний до VIN-matrix.' : 'Створіть одноразовий код та надішліть його боту.'}</p>
            </div>
            <div className={`rounded-2xl p-3 ${hasTelegram ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
              <MessageCircle size={23} />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Підтвердження</p>
              <p className="mt-2 text-lg font-black text-slate-950">{pendingActions.length ? `${pendingActions.length} очікує` : 'Чернеток немає'}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{status?.capabilities?.write_confirmation_required ? 'Записи та зміни залишаються під вашим контролем.' : 'Автопідтвердження увімкнене у налаштуваннях.'}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3 text-violet-600"><ShieldCheck size={23} /></div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-950"><MessageCircle className="text-blue-600" size={21} /><h2 className="text-xl font-black">Telegram</h2></div>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">Підключайте особистий Telegram до свого профілю VIN-matrix одноразовим кодом.</p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={creatingCode}
              disabled={!canGenerateCode}
              icon={<Send size={16} />}
              onClick={createTelegramCode}
              fullWidthMobile
            >
              Створити код
            </Button>
          </div>

          {connectionCode?.code ? (
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">Одноразове підключення</p>
                  <p className="mt-2 font-mono text-2xl font-black tracking-[0.18em] text-slate-950 sm:text-3xl">{connectionCode.code}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">Надішліть боту команду <span className="font-mono text-slate-800">/start {connectionCode.code}</span> · {formatRemaining(connectionCode.expires_at)}</p>
                </div>
                <Button variant="secondary" size="md" icon={<Copy size={16} />} onClick={copyConnectionCode}>Скопіювати</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
              {[
                ['1', 'Створіть код', 'Він активний 15 хвилин та працює лише один раз.'],
                ['2', 'Відкрийте бота', 'У Telegram надішліть команду /start КОД.'],
                ['3', 'Починайте роботу', 'Напишіть «розклад» або «знайди номер».'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3 rounded-xl bg-white p-3 shadow-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">{number}</span>
                  <div><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</p></div>
                </div>
              ))}
            </div>
          )}

          {(status?.channels || []).length ? (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Підключені канали</p>
              {status.channels.map((channel) => (
                <div key={`${channel.channel_type}-${channel.display_name}-${channel.linked_at}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-2xl bg-sky-50 p-3 text-sky-600"><Send size={19} /></div>
                    <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{channel.display_name || 'Telegram користувач'}</p><p className="mt-1 text-xs text-slate-500">Підключено {formatDateTime(channel.linked_at)}</p></div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700"><Check size={13} /> Активний</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card padding="lg" className="space-y-5">
          <div className="flex items-center gap-2 text-slate-950"><LockKeyhole className="text-violet-600" size={21} /><h2 className="text-xl font-black">Підтвердження дій</h2></div>
          {pendingActions.length ? (
            <div className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-amber-600" size={18} /><div className="min-w-0"><p className="text-sm font-black text-slate-900">{action.summary_text || action.action_type}</p><p className="mt-1 text-xs text-slate-500">Потрібно підтвердити до {formatDateTime(action.expires_at)}</p></div></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="success" loading={actionInProgress === action.id} icon={<Check size={15} />} onClick={() => decidePendingAction(action, 'confirm')}>Підтвердити</Button>
                    <Button size="sm" variant="secondary" disabled={actionInProgress === action.id} icon={<X size={15} />} onClick={() => decidePendingAction(action, 'cancel')}>Скасувати</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<LockKeyhole size={22} />} title="Немає дій на підтвердження" text="Коли Agent підготує зміну або створення запису, вона з’явиться тут до виконання." />
          )}
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs leading-relaxed text-violet-900"><strong className="font-black">Безпечний режим.</strong> Навіть із повним доступом Agent не виконує запис або зміну без окремого підтвердження, коли цей режим увімкнений.</div>
        </Card>
      </section>

      {isOwner && (
        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <Card padding="lg" className="space-y-5">
            <div className="flex items-center gap-2 text-slate-950"><Settings2 className="text-blue-600" size={21} /><h2 className="text-xl font-black">Налаштування Agent</h2></div>
            <div className="space-y-3">
              <ToggleRow label="Увімкнути VIN-matrix Agent" description="Відкриває функції Agent для вашої компанії." checked={Boolean(settings?.is_enabled)} disabled={Boolean(savingSetting)} onChange={(value) => updateSettings({ is_enabled: value })} />
              <ToggleRow label="Telegram" description="Дозволяє працівникам підключати Telegram та працювати з ботом." checked={Boolean(settings?.telegram_enabled)} disabled={Boolean(savingSetting)} onChange={(value) => updateSettings({ telegram_enabled: value })} />
              <ToggleRow label="Підтверджувати зміни" description="Залишає всі записи та зміни у статусі чернетки до ручного рішення." checked={Boolean(settings?.require_confirmation_for_writes)} disabled={Boolean(savingSetting)} onChange={(value) => updateSettings({ require_confirmation_for_writes: value })} />
              <ToggleRow label="Голосові повідомлення" description="Залишено вимкненими до підключення голосового модуля." checked={Boolean(settings?.allow_voice)} disabled={Boolean(savingSetting)} onChange={(value) => updateSettings({ allow_voice: value })} />
              <ToggleRow label="Фото та зображення" description="Залишено вимкненими до підключення обробки фото." checked={Boolean(settings?.allow_images)} disabled={Boolean(savingSetting)} onChange={(value) => updateSettings({ allow_images: value })} />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <label htmlFor="agent-action-limit" className="text-sm font-black text-slate-900">Ліміт дій на місяць</label>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">0 означає, що продуктового ліміту немає.</p>
              <div className="mt-3 flex gap-2"><input id="agent-action-limit" type="number" min="0" value={limitDraft} onChange={(event) => setLimitDraft(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><Button size="sm" loading={savingSetting === 'monthly_action_limit'} onClick={saveLimit}>Зберегти</Button></div>
            </div>
          </Card>

          <Card padding="lg" className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex items-center gap-2 text-slate-950"><Users className="text-blue-600" size={21} /><h2 className="text-xl font-black">Доступи команди</h2></div><p className="mt-1 text-sm leading-relaxed text-slate-500">Кожен працівник бачить у Telegram лише те, що ви дозволили.</p></div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{members.length} у команді</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400 sm:grid"><span>Працівник</span><span>Статус</span><span>Права</span></div>
              {members.map((member) => (
                <div key={member.user_id} className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{member.name || member.username}</p><p className="mt-1 text-xs text-slate-500">@{member.username}{member.is_owner ? ' · власник' : ''}</p></div>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${member.is_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${member.is_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />{member.is_enabled ? 'Увімкнений' : 'Вимкнений'}</span>
                  {member.is_owner ? <span className="text-xs font-bold text-slate-400">Повний доступ</span> : <Button size="sm" variant="secondary" onClick={() => openMemberEditor(member)}>Налаштувати</Button>}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex items-center gap-2 text-slate-950"><Bot className="text-blue-600" size={21} /><h2 className="text-xl font-black">Журнал Agent</h2></div><p className="mt-1 text-sm leading-relaxed text-slate-500">{auditScope === 'company' ? 'Останні дії всієї вашої команди в Agent.' : 'Ваші останні дії в Agent.'}</p></div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"><ShieldCheck size={14} /> {auditScope === 'company' ? 'Компанія' : 'Лише ваші дії'}</span>
        </div>
        {audit.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {audit.map((entry) => (
              <div key={entry.id} className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-900">{actionLabel(entry)}</p>{entry.success ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700"><Check size={11} /> Успішно</span> : <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700"><AlertTriangle size={11} /> Помилка</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{entry.request_text || entry.error_message || entry.actor || 'Системна дія'}</p></div>
                <div className="text-left md:text-right"><p className="text-xs font-bold text-slate-600">{entry.actor || 'Система'}</p><p className="mt-1 text-[11px] text-slate-400">{formatDateTime(entry.created_at)}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Bot size={22} />} title="Журнал поки порожній" text="Після підключення Telegram тут з’являться команди, пошук, підтвердження та зміни налаштувань." />
        )}
      </Card>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><ExternalLink size={15} className="text-slate-400" /><span>Webhook Agent працює через захищений API-домен VIN-matrix.</span></div>
        <div className="flex items-center gap-2 font-black text-slate-700"><ShieldCheck size={15} className="text-emerald-600" /> Дані доступні лише в межах вашої компанії</div>
      </section>

      {editingMember && (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="Налаштування доступу працівника">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">Доступ Agent</p><h3 className="mt-1 text-xl font-black text-slate-950">{editingMember.name || editingMember.username}</h3><p className="mt-1 text-sm text-slate-500">Вкажіть, що працівник може бачити та готувати через месенджер.</p></div><button type="button" onClick={() => setEditingMember(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Закрити"><X size={20} /></button></div>
            <div className="mt-6 space-y-3"><ToggleRow label="Доступ до Agent" description="Повністю вмикає або вимикає Agent для цього працівника." checked={Boolean(memberDraft.is_enabled)} onChange={(value) => setMemberDraft((previous) => ({ ...previous, is_enabled: value }))} />{ACCESS_OPTIONS.map((option) => <ToggleRow key={option.key} label={option.label} description={option.description} checked={Boolean(memberDraft[option.key])} onChange={(value) => setMemberDraft((previous) => ({ ...previous, [option.key]: value }))} />)}</div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={() => setEditingMember(null)}>Скасувати</Button><Button loading={savingMember} icon={<Check size={16} />} onClick={saveMember}>Зберегти доступ</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
