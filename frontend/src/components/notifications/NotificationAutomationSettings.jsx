import React, { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Loader2, Moon, Plus, Trash2, WalletCards } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../ui/useToast';

const DEFAULT_AUTOMATION = {
  visit_reminder_minutes: 60,
  debt_schedule_days: 'weekdays',
  debt_notification_times: ['10:00'],
  crm_reminder_days_before: 1,
  crm_notification_time: '10:00',
  quiet_hours_enabled: true,
  quiet_hours_start: '20:00',
  quiet_hours_end: '08:00',
};

export default function NotificationAutomationSettings({ enabled }) {
  const toast = useToast();
  const [automation, setAutomation] = useState(DEFAULT_AUTOMATION);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/push/preferences/')
      .then((response) => {
        if (!cancelled) setAutomation({ ...DEFAULT_AUTOMATION, ...(response.data?.automation || {}) });
      })
      .catch(() => {
        if (!cancelled) toast.error('Не вдалося завантажити розклад сповіщень.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch, key) => {
    setSaving(key);
    const previous = automation;
    const next = { ...automation, ...patch };
    setAutomation(next);
    try {
      const response = await api.patch('/api/push/preferences/', { automation: patch });
      setAutomation({ ...DEFAULT_AUTOMATION, ...(response.data?.automation || next) });
    } catch (error) {
      setAutomation(previous);
      toast.error(error.response?.data?.error || 'Не вдалося зберегти розклад.');
    } finally {
      setSaving('');
    }
  };

  const updateDebtTimeLocal = (index, value) => {
    setAutomation((current) => {
      const times = [...(current.debt_notification_times || ['10:00'])];
      times[index] = value;
      return { ...current, debt_notification_times: times };
    });
  };

  const saveDebtTimes = () => save({ debt_notification_times: automation.debt_notification_times }, 'debt-times');

  const addDebtTime = () => {
    const current = automation.debt_notification_times || [];
    if (current.length >= 3) return;
    const next = [...current, current.length === 1 ? '17:00' : '13:00'];
    save({ debt_notification_times: next }, 'debt-times');
  };

  const removeDebtTime = (index) => {
    const current = automation.debt_notification_times || [];
    if (current.length <= 1) return;
    save({ debt_notification_times: current.filter((_, idx) => idx !== index) }, 'debt-times');
  };

  if (loading) {
    return <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={17}/> Завантаження розкладу…</div></section>;
  }

  return (
    <section className={`rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-6 ${!enabled ? 'opacity-60' : ''}`}>
      <div className="border-b border-slate-100 pb-5">
        <h2 className="text-lg font-black text-slate-950 md:text-xl">Коли надсилати</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">VIN Matrix автоматично перевіряє ці правила. Повторно одна й та сама подія не надсилається.</p>
      </div>

      <div className="grid gap-4 pt-5 lg:grid-cols-2">
        <SettingCard icon={CalendarClock} title="Записи / візити" description="Нагадати до запланованого приїзду авто.">
          <FieldLabel>Нагадати за</FieldLabel>
          <select
            value={automation.visit_reminder_minutes}
            disabled={!enabled || Boolean(saving)}
            onChange={(event) => save({ visit_reminder_minutes: Number(event.target.value) }, 'visit')}
            className="control"
          >
            <option value={30}>30 хвилин</option>
            <option value={60}>1 годину</option>
            <option value={120}>2 години</option>
            <option value={180}>3 години</option>
            <option value={1440}>1 день</option>
          </select>
          <Hint>За замовчуванням — за 1 годину. Натискання на push відкриває конкретний візит.</Hint>
        </SettingCard>

        <SettingCard icon={WalletCards} title="Борги" description="Одне зведене повідомлення замість спаму по кожному боргу.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Дні</FieldLabel>
              <select
                value={automation.debt_schedule_days}
                disabled={!enabled || Boolean(saving)}
                onChange={(event) => save({ debt_schedule_days: event.target.value }, 'debt-days')}
                className="control"
              >
                <option value="weekdays">Пн–Пт</option>
                <option value="daily">Щодня</option>
              </select>
            </div>
            <div>
              <FieldLabel>Повідомлень на день</FieldLabel>
              <div className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 flex items-center text-sm font-black text-slate-700">
                {(automation.debt_notification_times || []).length}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {(automation.debt_notification_times || []).map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="time"
                  value={value}
                  disabled={!enabled || Boolean(saving)}
                  onChange={(event) => updateDebtTimeLocal(index, event.target.value)}
                  onBlur={saveDebtTimes}
                  className="control flex-1"
                />
                <button
                  type="button"
                  disabled={!enabled || Boolean(saving) || automation.debt_notification_times.length <= 1}
                  onClick={() => removeDebtTime(index)}
                  className="h-11 w-11 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 disabled:opacity-30 flex items-center justify-center"
                  aria-label="Видалити час"
                ><Trash2 size={16}/></button>
              </div>
            ))}
            <button
              type="button"
              disabled={!enabled || Boolean(saving) || automation.debt_notification_times.length >= 3}
              onClick={addDebtTime}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 disabled:opacity-40"
            ><Plus size={15}/> Додати ще час</button>
          </div>
          <Hint>Якщо боргів немає — повідомлення не надсилається.</Hint>
        </SettingCard>

        <SettingCard icon={Clock3} title="Задачі та рекомендації" description="Нагадати заздалегідь, щоб встигнути зателефонувати клієнту.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>За скільки днів</FieldLabel>
              <select
                value={automation.crm_reminder_days_before}
                disabled={!enabled || Boolean(saving)}
                onChange={(event) => save({ crm_reminder_days_before: Number(event.target.value) }, 'crm-days')}
                className="control"
              >
                <option value={0}>У день події</option>
                <option value={1}>За 1 день</option>
                <option value={2}>За 2 дні</option>
                <option value={3}>За 3 дні</option>
                <option value={7}>За 7 днів</option>
              </select>
            </div>
            <div>
              <FieldLabel>Час</FieldLabel>
              <input
                type="time"
                value={automation.crm_notification_time}
                disabled={!enabled || Boolean(saving)}
                onChange={(event) => setAutomation((current) => ({ ...current, crm_notification_time: event.target.value }))}
                onBlur={() => save({ crm_notification_time: automation.crm_notification_time }, 'crm-time')}
                className="control"
              />
            </div>
          </div>
          <Hint>Сюди входять задачі, рекомендації по авто та сервісні нагадування.</Hint>
        </SettingCard>

        <SettingCard icon={Moon} title="Тихі години" description="Зведення по боргах і CRM не турбують поза робочим часом.">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div><p className="text-sm font-black text-slate-800">Не надсилати борги та CRM</p><p className="text-xs font-semibold text-slate-500">Статуси та нагадування про записи приходять вчасно.</p></div>
            <button
              type="button"
              role="switch"
              aria-checked={automation.quiet_hours_enabled}
              disabled={!enabled || Boolean(saving)}
              onClick={() => save({ quiet_hours_enabled: !automation.quiet_hours_enabled }, 'quiet-enabled')}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${automation.quiet_hours_enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            ><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${automation.quiet_hours_enabled ? 'left-6' : 'left-1'}`}/></button>
          </div>
          {automation.quiet_hours_enabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><FieldLabel>З</FieldLabel><input type="time" value={automation.quiet_hours_start} disabled={!enabled || Boolean(saving)} onChange={(e) => setAutomation((c) => ({ ...c, quiet_hours_start: e.target.value }))} onBlur={() => save({ quiet_hours_start: automation.quiet_hours_start }, 'quiet-start')} className="control" /></div>
              <div><FieldLabel>До</FieldLabel><input type="time" value={automation.quiet_hours_end} disabled={!enabled || Boolean(saving)} onChange={(e) => setAutomation((c) => ({ ...c, quiet_hours_end: e.target.value }))} onBlur={() => save({ quiet_hours_end: automation.quiet_hours_end }, 'quiet-end')} className="control" /></div>
            </div>
          )}
        </SettingCard>
      </div>

      <style>{`.control{width:100%;min-height:44px;border:1px solid rgb(226 232 240);border-radius:16px;background:white;padding:0 14px;font-size:14px;font-weight:800;color:rgb(30 41 59);outline:none}.control:focus{border-color:rgb(59 130 246);box-shadow:0 0 0 3px rgb(219 234 254)}.control:disabled{opacity:.55;cursor:not-allowed}`}</style>
    </section>
  );
}

function SettingCard({ icon: Icon, title, description, children }) {
  return <div className="rounded-[26px] border border-slate-200 bg-slate-50/60 p-4 md:p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-slate-200 text-blue-700"><Icon size={19}/></span><div><h3 className="text-sm font-black text-slate-950 md:text-base">{title}</h3><p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{description}</p></div></div><div className="mt-4">{children}</div></div>;
}

function FieldLabel({ children }) {
  return <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">{children}</span>;
}

function Hint({ children }) {
  return <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-400">{children}</p>;
}
