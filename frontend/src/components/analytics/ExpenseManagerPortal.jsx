import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Loader2, Pencil, RefreshCw, Save, Trash2, X } from 'lucide-react';
import api from '../../api/axios';

const EMPTY_EXPENSE = {
  id: null,
  date: new Date().toISOString().slice(0, 10),
  category: 'other',
  title: '',
  amount: '',
  payment_method: 'cash',
  comment: '',
  is_recurring: false,
  recurring_period: 'none',
};

const CATEGORIES = [
  ['rent', 'Оренда'],
  ['utilities', 'Комунальні'],
  ['admin_salary', 'Зарплата персоналу'],
  ['tools', 'Інструмент'],
  ['equipment', 'Обладнання'],
  ['equipment_repair', 'Ремонт обладнання'],
  ['consumables', 'Витратні матеріали'],
  ['marketing', 'Маркетинг'],
  ['taxes', 'Податки'],
  ['bank_fees', 'Банківські комісії'],
  ['delivery', 'Доставка / логістика'],
  ['fuel', 'Пальне'],
  ['software', 'Програми / підписки'],
  ['cleaning', 'Прибирання'],
  ['other', 'Інше'],
];

const PAYMENT_METHODS = [
  ['cash', 'Готівка'],
  ['card', 'Картка'],
  ['bank', 'Банк'],
  ['other', 'Інше'],
];

const money = (value) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
const unpack = (payload) => Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : []);

const normaliseExpense = (item) => ({
  ...EMPTY_EXPENSE,
  ...item,
  amount: item?.amount ?? '',
  comment: item?.comment || '',
  is_recurring: Boolean(item?.is_recurring),
  recurring_period: item?.recurring_period || 'none',
});

function Field({ label, children }) {
  return <label className="block space-y-1.5"><span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function ExpenseEditor({ value, onChange, disabled }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Дата"><input disabled={disabled} type="date" value={value.date} onChange={(event) => set({ date: event.target.value })} className="input" /></Field>
      <Field label="Категорія"><select disabled={disabled} value={value.category} onChange={(event) => set({ category: event.target.value })} className="input">{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    </div>
    <Field label="Назва витрати"><input disabled={disabled} required value={value.title} onChange={(event) => set({ title: event.target.value })} className="input" placeholder="Наприклад: оренда боксу" /></Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Сума"><input disabled={disabled} required type="number" min="0" step="0.01" value={value.amount} onChange={(event) => set({ amount: event.target.value })} className="input" placeholder="0.00" /></Field>
      <Field label="Метод оплати"><select disabled={disabled} value={value.payment_method} onChange={(event) => set({ payment_method: event.target.value })} className="input">{PAYMENT_METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    </div>
    <Field label="Коментар"><textarea disabled={disabled} value={value.comment} onChange={(event) => set({ comment: event.target.value })} className="input h-24" placeholder="Деталі або причина зміни" /></Field>
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
      <input disabled={disabled} type="checkbox" checked={Boolean(value.is_recurring)} onChange={(event) => set({ is_recurring: event.target.checked, recurring_period: event.target.checked && value.recurring_period === 'none' ? 'monthly' : value.recurring_period })} />
      Постійна витрата
    </label>
    {value.is_recurring && <Field label="Період повтору"><select disabled={disabled} value={value.recurring_period} onChange={(event) => set({ recurring_period: event.target.value })} className="input"><option value="monthly">Щомісяця</option><option value="weekly">Щотижня</option><option value="daily">Щодня</option><option value="none">Без повтору</option></select></Field>}
  </div>;
}

function ExpenseManagerModal({ onClose }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/expenses/');
      const rows = unpack(response.data).sort((left, right) => `${right.date || ''}-${right.id || 0}`.localeCompare(`${left.date || ''}-${left.id || 0}`));
      setItems(rows);
      if (selected) {
        const updated = rows.find((item) => item.id === selected.id);
        if (updated) setSelected(normaliseExpense(updated));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Не вдалося завантажити витрати.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('uk-UA');
    if (!needle) return items;
    return items.filter((item) => [item.title, item.category_label, item.date, item.comment].join(' ').toLocaleLowerCase('uk-UA').includes(needle));
  }, [items, query]);

  const startEdit = (item) => {
    setError('');
    setSelected(normaliseExpense(item));
  };

  const refreshAnalytics = () => {
    window.dispatchEvent(new Event('vin-matrix-expenses-updated'));
    window.setTimeout(() => window.location.reload(), 120);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selected?.id) return;
    const amount = Number(selected.amount || 0);
    if (!selected.title.trim()) return setError('Вкажіть назву витрати.');
    if (!amount || amount <= 0) return setError('Вкажіть коректну суму витрати.');

    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/expenses/${selected.id}/`, {
        date: selected.date,
        category: selected.category,
        title: selected.title.trim(),
        amount,
        payment_method: selected.payment_method,
        comment: selected.comment.trim(),
        is_recurring: selected.is_recurring,
        recurring_period: selected.is_recurring ? selected.recurring_period : 'none',
      });
      refreshAnalytics();
    } catch (err) {
      setError(err.response?.data?.error || 'Не вдалося зберегти зміни.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected?.id) return;
    const approved = window.confirm(`Видалити витрату «${selected.title}»? Цю дію не можна скасувати.`);
    if (!approved) return;

    setRemoving(true);
    setError('');
    try {
      await api.delete(`/api/expenses/${selected.id}/`);
      refreshAnalytics();
    } catch (err) {
      setError(err.response?.data?.error || 'Не вдалося видалити витрату.');
      setRemoving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-sm md:px-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/50 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-slate-950 via-rose-700 to-orange-500 px-5 py-6 text-white md:flex-row md:items-start md:justify-between md:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100">Операційні витрати</p>
            <h2 className="mt-2 text-2xl font-black uppercase italic leading-tight md:text-3xl">Редагування витрат</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold text-rose-100">Виправ суму, дату, категорію або назву — аналітика перераховується одразу після збереження.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-2xl bg-white/15 text-white hover:bg-white/25 md:self-auto"><X size={20} /></button>
        </div>

        <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
          <aside className="border-b border-slate-100 bg-slate-50 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <div className="mb-4 flex items-center gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="input flex-1" placeholder="Пошук витрати" />
              <button type="button" title="Оновити список" onClick={load} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
            </div>
            {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-rose-600" size={28} /></div> : (
              <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {filtered.length ? filtered.map((item) => {
                  const active = selected?.id === item.id;
                  return <button type="button" key={item.id} onClick={() => startEdit(item)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-100' : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40'}`}>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{item.title}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{item.date} · {item.category_label || item.category}</p></div><span className="shrink-0 text-sm font-black text-rose-600">{money(item.amount)} ₴</span></div>
                    {item.comment && <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-slate-500">{item.comment}</p>}
                  </button>;
                }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm font-bold text-slate-400">Витрат за цим пошуком немає.</div>}
              </div>
            )}
          </aside>

          <section className="p-5 md:p-7">
            {selected ? <form onSubmit={save}>
              <div className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">Вибрана витрата</p><h3 className="mt-1 text-xl font-black text-slate-900">{selected.title || 'Без назви'}</h3></div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">ID {selected.id}</span>
              </div>
              {error && <div className="mb-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
              <ExpenseEditor value={selected} onChange={setSelected} disabled={saving || removing} />
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={remove} disabled={saving || removing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-3 text-xs font-black uppercase text-red-600 hover:bg-red-50 disabled:opacity-50">{removing ? <Loader2 className="animate-spin" size={17} /> : <Trash2 size={17} />} Видалити</button>
                <div className="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={() => setSelected(null)} disabled={saving || removing} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">Скасувати</button><button type="submit" disabled={saving || removing} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black uppercase text-white hover:bg-rose-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Зберегти зміни</button></div>
              </div>
            </form> : <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Pencil size={34} className="mb-4 text-rose-500" /><h3 className="text-xl font-black text-slate-900">Обери витрату зі списку</h3><p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">Тут можна виправити суму, дату, категорію, спосіб оплати або коментар.</p></div>}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ExpenseManagerPortal() {
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let previousHost = null;
    const attach = () => {
      const section = document.getElementById('expenses-section');
      const addButton = section?.querySelector('button');
      if (!section || !addButton || window.location.pathname !== '/analytics') {
        if (previousHost?.parentElement) previousHost.remove();
        previousHost = null;
        setHost(null);
        setOpen(false);
        return;
      }

      let nextHost = document.getElementById('vin-expense-manager-host');
      if (!nextHost) {
        nextHost = document.createElement('span');
        nextHost.id = 'vin-expense-manager-host';
        addButton.insertAdjacentElement('afterend', nextHost);
      }
      previousHost = nextHost;
      setHost(nextHost);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (previousHost?.parentElement) previousHost.remove();
    };
  }, []);

  return <>{host && createPortal(<button type="button" onClick={() => setOpen(true)} className="ml-2 inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs font-black uppercase text-rose-600 shadow-sm hover:bg-rose-50"><Pencil size={16} /> Редагувати витрати</button>, host)}{open && <ExpenseManagerModal onClose={() => setOpen(false)} />}</>;
}
