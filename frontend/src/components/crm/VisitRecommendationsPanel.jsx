import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { recommendationScheduleDefaults } from '../../utils/recommendationVisit';

const emptyRecommendation = { title: '', description: '', due_date: '', due_mileage: '' };
const listOf = (value) => (Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : []);

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const recommendationBadge = (recommendation) => {
  if (recommendation.status === 'done') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = recommendation.due_date ? new Date(`${recommendation.due_date}T12:00:00`) : null;
    if (due && !Number.isNaN(due.getTime()) && due >= today) {
      return { label: 'Заплановано', cls: 'bg-blue-50 text-blue-700 border-blue-100' };
    }
    return { label: 'Виконано', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }

  if (!recommendation.due_date) {
    return { label: 'Без терміну', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${recommendation.due_date}T12:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days <= 0) return { label: 'Терміново', cls: 'bg-rose-50 text-rose-700 border-rose-100' };
  if (days <= 14) return { label: 'Скоро', cls: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: 'Планово', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
};

export default function VisitRecommendationsPanel({
  recommendations = [],
  showCreateForm,
  setShowCreateForm,
  createForm,
  setCreateForm,
  onCreate,
  onUpdate,
  onSchedule,
  onDone,
  onPostpone,
}) {
  const safeRecommendations = listOf(recommendations).filter((item) => item?.status !== 'cancelled');
  const active = useMemo(
    () => safeRecommendations.filter((item) => item.status !== 'done'),
    [safeRecommendations],
  );
  const history = useMemo(
    () => safeRecommendations.filter((item) => item.status === 'done'),
    [safeRecommendations],
  );

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyRecommendation });
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(recommendationScheduleDefaults());
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => {
    if (!safeRecommendations.some((item) => item.id === editingId)) setEditingId(null);
    if (!safeRecommendations.some((item) => item.id === schedulingId)) setSchedulingId(null);
  }, [safeRecommendations, editingId, schedulingId]);

  const startEdit = (recommendation) => {
    setSchedulingId(null);
    setEditingId(recommendation.id);
    setEditForm({
      title: recommendation.title || '',
      description: recommendation.description || '',
      due_date: recommendation.due_date || '',
      due_mileage: recommendation.due_mileage || '',
    });
  };

  const saveEdit = async (recommendation) => {
    if (!editForm.title.trim() || savingKey) return;
    setSavingKey(`edit-${recommendation.id}`);
    try {
      const ok = await onUpdate?.(recommendation, {
        title: editForm.title.trim(),
        description: editForm.description || '',
        due_date: editForm.due_date || null,
        due_mileage: editForm.due_mileage ? Number(editForm.due_mileage) : null,
      });
      if (ok !== false) setEditingId(null);
    } finally {
      setSavingKey('');
    }
  };

  const startSchedule = (recommendation) => {
    setEditingId(null);
    setSchedulingId(recommendation.id);
    setScheduleForm(recommendationScheduleDefaults(recommendation));
  };

  const saveSchedule = async (recommendation) => {
    if (!scheduleForm.date || !scheduleForm.time || savingKey) return;
    setSavingKey(`schedule-${recommendation.id}`);
    try {
      const ok = await onSchedule?.(recommendation, scheduleForm);
      if (ok !== false) setSchedulingId(null);
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs font-black uppercase tracking-widest text-blue-700">Автоматично після діагностики</p>
        <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">
          Пункти зі статусом «Увага» або «Критично» вже потрапляють сюди самі. Тут лишається уточнити термін або одразу записати клієнта на наступний візит.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Потрібно зробити" value={active.length} />
        <StatCard label="Заплановано / виконано" value={history.length} />
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="col-span-2 min-h-[70px] rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-sm transition hover:bg-blue-700 sm:col-span-1 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Додати вручну
        </button>
      </div>

      {showCreateForm && (
        <RecommendationEditor
          title="Нова рекомендація"
          form={createForm}
          setForm={setCreateForm}
          onCancel={() => setShowCreateForm(false)}
          onSave={onCreate}
          submitLabel="Додати рекомендацію"
        />
      )}

      <div className="space-y-3">
        {active.map((recommendation) => {
          const badge = recommendationBadge(recommendation);
          const isEditing = editingId === recommendation.id;
          const isScheduling = schedulingId === recommendation.id;

          return (
            <article key={recommendation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${badge.cls}`}>{badge.label}</span>
                    {recommendation.due_date && <span className="text-[11px] font-black uppercase text-slate-400">до {formatDate(recommendation.due_date)}</span>}
                    {recommendation.due_mileage && <span className="text-[11px] font-black uppercase text-slate-400">{Number(recommendation.due_mileage).toLocaleString('uk-UA')} км</span>}
                  </div>
                  <h3 className="break-words text-base font-black text-slate-950">{recommendation.title}</h3>
                  {recommendation.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-500">{recommendation.description}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => startEdit(recommendation)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase text-slate-600 transition hover:border-blue-200 hover:text-blue-700 flex items-center gap-1.5"
                >
                  <Pencil size={13} /> Редагувати
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                <button
                  type="button"
                  onClick={() => startSchedule(recommendation)}
                  className="min-h-[44px] rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <CalendarPlus size={16} /> Записати на СТО
                </button>
                <button
                  type="button"
                  onClick={() => onPostpone?.(recommendation)}
                  className="min-h-[44px] rounded-xl bg-amber-50 px-4 py-2.5 text-[11px] font-black uppercase text-amber-700 transition hover:bg-amber-100 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} /> +30 днів
                </button>
                <button
                  type="button"
                  onClick={() => onDone?.(recommendation.id)}
                  className="min-h-[44px] rounded-xl bg-emerald-50 px-4 py-2.5 text-[11px] font-black uppercase text-emerald-700 transition hover:bg-emerald-100 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> Виконано
                </button>
              </div>

              {isEditing && (
                <div className="mt-3">
                  <RecommendationEditor
                    title="Редагування"
                    form={editForm}
                    setForm={setEditForm}
                    onCancel={() => setEditingId(null)}
                    onSave={() => saveEdit(recommendation)}
                    submitLabel={savingKey === `edit-${recommendation.id}` ? 'Зберігаємо...' : 'Зберегти зміни'}
                    disabled={savingKey === `edit-${recommendation.id}`}
                  />
                </div>
              )}

              {isScheduling && (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase text-blue-800">Наступний запис</p>
                      <p className="mt-1 text-xs font-bold leading-relaxed text-blue-700">
                        Після збереження візит зʼявиться на дошці, а дата й час потраплять у акт виконаних робіт клієнта.
                      </p>
                    </div>
                    <button type="button" onClick={() => setSchedulingId(null)} className="rounded-lg p-1.5 text-blue-400 hover:bg-white hover:text-blue-700"><X size={17} /></button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Дата" type="date" required value={scheduleForm.date} onChange={(value) => setScheduleForm({ ...scheduleForm, date: value })} />
                    <Field label="Час" type="time" required value={scheduleForm.time} onChange={(value) => setScheduleForm({ ...scheduleForm, time: value })} />
                    <Field label="Пробіг, км" type="number" value={scheduleForm.mileage} onChange={(value) => setScheduleForm({ ...scheduleForm, mileage: value })} />
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1.5 ml-1 block text-[10px] font-black uppercase text-slate-500">Примітка до нового запису</span>
                    <input
                      value={scheduleForm.comment || ''}
                      onChange={(event) => setScheduleForm({ ...scheduleForm, comment: event.target.value })}
                      placeholder="Необовʼязково"
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingKey === `schedule-${recommendation.id}`}
                    onClick={() => saveSchedule(recommendation)}
                    className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <CalendarPlus size={16} />
                    {savingKey === `schedule-${recommendation.id}` ? 'Створюємо запис...' : 'Створити наступний візит'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!active.length && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={28} />
          <p className="mt-2 text-sm font-black text-emerald-800">Активних рекомендацій немає</p>
          <p className="mt-1 text-xs font-bold text-emerald-700">Якщо діагностика виявить «Увага» або «Критично», вони зʼявляться тут автоматично.</p>
        </div>
      )}

      {history.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black uppercase text-slate-600 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><Clock3 size={15} /> Історія / заплановані</span>
            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px]">{history.length}</span>
          </summary>
          <div className="space-y-2 border-t border-slate-200 p-3">
            {history.map((recommendation) => {
              const badge = recommendationBadge(recommendation);
              return (
                <div key={recommendation.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${badge.cls}`}>{badge.label}</span>
                    {recommendation.due_date && <span className="text-[10px] font-black uppercase text-slate-400">{formatDate(recommendation.due_date)}</span>}
                  </div>
                  <p className="mt-2 text-sm font-black text-slate-800">{recommendation.title}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function RecommendationEditor({ title, form, setForm, onCancel, onSave, submitLabel, disabled }) {
  const submit = (event) => {
    event.preventDefault();
    onSave?.(event);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase text-slate-800">{title}</h3>
        <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"><X size={17} /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Що рекомендуємо" required value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
        <Field label="Рекомендовано до" type="date" value={form.due_date} onChange={(value) => setForm({ ...form, due_date: value })} />
        <Field label="Пробіг, км" type="number" value={form.due_mileage} onChange={(value) => setForm({ ...form, due_mileage: value })} />
        <label className="md:col-span-2 block">
          <span className="mb-1.5 ml-1 block text-[10px] font-black uppercase text-slate-500">Опис для клієнта</span>
          <textarea
            value={form.description || ''}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Коротко і зрозуміло: що треба зробити і чому"
            className="min-h-[90px] w-full resize-none rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500"
          />
        </label>
      </div>
      <button disabled={disabled} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white transition hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
        <Save size={15} /> {submitLabel}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 ml-1 block text-[10px] font-black uppercase text-slate-500">{label}</span>
      <input
        required={required}
        type={type}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[46px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-800 outline-none transition focus:border-blue-500"
      />
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="min-h-[70px] rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}
