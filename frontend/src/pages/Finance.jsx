import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import api from '../api/axios';
import FinanceWorkspaceNav from '../components/finance/FinanceWorkspaceNav';
import AppPage from '../components/ui/AppPage';

const PERIODS = [
  ['today', 'Сьогодні'],
  ['7d', '7 днів'],
  ['30d', '30 днів'],
  ['this_month', 'Цей місяць'],
  ['last_month', 'Минулий'],
  ['all', 'Весь час'],
  ['custom', 'Свій'],
];

const EXPENSE_CATEGORIES = [
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

const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₴`;
const localInputNow = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
const today = () => new Date().toISOString().slice(0, 10);
const num = (value) => Number(String(value ?? '').replace(',', '.')) || 0;

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`mx-auto my-4 overflow-hidden rounded-[30px] border border-white/40 bg-white shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-slate-950 via-blue-950 to-sky-700 p-5 text-white md:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">VIN-matrix · Фінанси</p>
            <h2 className="mt-2 text-xl font-black uppercase md:text-2xl">{title}</h2>
            {subtitle && <p className="mt-1 max-w-3xl text-xs font-bold leading-relaxed text-blue-100">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[10px] font-semibold leading-relaxed text-slate-400">{hint}</span>}
    </label>
  );
}

const inputClass = 'min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

function StatCard({ icon, label, value, subtitle, tone = 'slate' }) {
  const tones = {
    blue: 'from-blue-600 to-sky-500 text-white',
    emerald: 'from-emerald-600 to-teal-500 text-white',
    rose: 'from-rose-600 to-orange-500 text-white',
    violet: 'from-violet-600 to-indigo-500 text-white',
    slate: 'from-slate-900 to-slate-700 text-white',
  };
  return (
    <div className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br p-5 shadow-lg ${tones[tone] || tones.slate}`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative">
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/75">{label}</p>
        <p className="mt-2 text-2xl font-black md:text-3xl">{value}</p>
        {subtitle && <p className="mt-2 text-[11px] font-bold text-white/75">{subtitle}</p>}
      </div>
    </div>
  );
}

function EntityBadge({ name }) {
  return <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{name || 'Без ФОП / ТОВ'}</span>;
}

function Finance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [configOpen, setConfigOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [allocationTarget, setAllocationTarget] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      if (entityFilter !== 'all') params.set('legal_entity', entityFilter);
      const response = await api.get(`/api/finance/summary/?${params.toString()}`);
      setData(response.data || {});
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Не вдалося завантажити фінанси.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period, dateFrom, dateTo, entityFilter]);

  const entities = Array.isArray(data?.entities) ? data.entities : [];
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  const summary = data?.summary || {};
  const meta = data?.meta || {};

  const filteredTransactions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('uk-UA');
    return transactions.filter((item) => {
      if (typeFilter !== 'all' && item.direction !== typeFilter) return false;
      if (!needle) return true;
      return [
        item.title,
        item.legal_entity_name,
        item.account_name,
        item.category_label,
        item.counterparty,
        item.client,
        item.plate,
        item.comment,
        item.source_ref,
      ].join(' ').toLocaleLowerCase('uk-UA').includes(needle);
    });
  }, [transactions, query, typeFilter]);

  const exportCsv = async (direction = 'all') => {
    try {
      const params = new URLSearchParams({ period, direction });
      if (period === 'custom') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      if (entityFilter !== 'all') params.set('legal_entity', entityFilter);
      const response = await api.get(`/api/finance/export/?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `vin-matrix-finance-${direction}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage('Не вдалося сформувати файл для бухгалтера.');
    }
  };

  const openManualTransaction = (item = null) => {
    setEditingTransaction(item?.source_payload?.id ? item.source_payload : item);
    setTransactionOpen(true);
  };

  if (loading && !data) {
    return <AppPage className="max-w-[1680px]"><div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={34} className="animate-spin text-blue-600" /></div></AppPage>;
  }

  return (
    <AppPage className="max-w-[1680px] pb-24">
      <FinanceWorkspaceNav />

      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <div className="relative bg-gradient-to-br from-slate-950 via-blue-950 to-sky-700 px-5 py-7 text-white md:px-8">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_26%),radial-gradient(circle_at_80%_0%,#38bdf8,transparent_30%)]" />
          <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100"><WalletCards size={14} /> Рух реальних грошей</div>
              <h1 className="mt-4 text-3xl font-black uppercase italic md:text-5xl">Фінанси</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-blue-100 md:text-base">ФОП / ТОВ, каси й рахунки, надходження, витрати, зарплати, постачальники та повна історія коригувань.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider">{data?.period?.label || 'Період'}</span>
                <span className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider">{entities.filter((item) => item.is_active).length} юрособ</span>
                {Number(summary.virtual_allocations_count || 0) > 0 && <span className="rounded-2xl border border-amber-300/30 bg-amber-300/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-100">{summary.virtual_allocations_count} авто-розподілів</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setExpenseOpen(true)} className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-xs font-black uppercase shadow-lg shadow-rose-950/20 hover:bg-rose-400"><ReceiptText size={16} /> Витрата</button>
              <button type="button" onClick={() => openManualTransaction()} className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase text-slate-900 hover:bg-blue-50"><Plus size={16} /> Операція</button>
              <button type="button" onClick={() => setConfigOpen(true)} className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black uppercase hover:bg-white/20"><Settings2 size={16} /> ФОП / рахунки</button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 p-3 md:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              {PERIODS.map(([key, label]) => <button type="button" key={key} onClick={() => setPeriod(key)} className={`min-h-[40px] whitespace-nowrap rounded-xl px-3 py-2 text-[10px] font-black uppercase ${period === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{label}</button>)}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {period === 'custom' && <><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClass} /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClass} /></>}
              <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} className={`${inputClass} sm:min-w-[260px]`}>
                <option value="all">Всі ФОП / ТОВ</option>
                {entities.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.entity_type_label} · {item.name}</option>)}
              </select>
              <button type="button" onClick={load} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
            </div>
          </div>
        </div>
      </section>

      {message && <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700"><span>{message}</span><button type="button" onClick={() => setMessage('')}><X size={15} /></button></div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="emerald" icon={<ArrowDownLeft size={18} />} label="Надійшло" value={money(summary.income)} subtitle="Фактичні надходження за період" />
        <StatCard tone="rose" icon={<ArrowUpRight size={18} />} label="Витрачено" value={money(summary.expense)} subtitle="Фактичні виплати за період" />
        <StatCard tone="blue" icon={<ArrowRightLeft size={18} />} label="Грошовий потік" value={money(summary.cash_flow)} subtitle="Надходження мінус витрати" />
        <StatCard tone="violet" icon={<CircleDollarSign size={18} />} label="Грошей зараз" value={money(summary.total_balance)} subtitle={`Готівка ${money(summary.cash_balance)} · безготівка ${money(summary.non_cash_balance)}`} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
        <div className="rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
            <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">Грошові залишки</p><h2 className="mt-1 text-xl font-black text-slate-950">Каси та рахунки</h2></div>
            <button type="button" onClick={() => setConfigOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase text-slate-700 hover:bg-slate-50"><Settings2 size={15} /> Налаштувати</button>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {accounts.length ? accounts.map((account) => (
              <div key={account.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">{account.account_type === 'cash' ? <Banknote size={18} /> : <Landmark size={18} />}</div>{account.is_primary && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Основний</span>}</div>
                <p className="mt-4 text-sm font-black text-slate-950">{account.name}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">{account.account_type_label}</p>
                <p className="mt-4 text-2xl font-black text-slate-950">{money(account.balance)}</p>
                <div className="mt-3"><EntityBadge name={account.legal_entity_name} /></div>
              </div>
            )) : <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400">Рахунків ще немає.</div>}
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-600">Розподіл надходжень</p><h2 className="mt-1 text-xl font-black text-slate-950">Як платять клієнти</h2></div><WalletCards size={22} className="text-violet-500" /></div>
          <div className="mt-5 space-y-3">
            {(data?.payment_channels || []).length ? data.payment_channels.map((channel) => {
              const percent = Number(summary.income || 0) > 0 ? Math.round((Number(channel.amount || 0) / Number(summary.income)) * 100) : 0;
              return <div key={channel.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-slate-700">{channel.label}</span><span className="text-sm font-black text-slate-950">{money(channel.amount)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(percent, 100)}%` }} /></div><p className="mt-1 text-[10px] font-bold text-slate-400">{percent}% надходжень</p></div>;
            }) : <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-400">За вибраний період оплат немає.</p>}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600">Каса / банк / ФОП / ТОВ</p><h2 className="mt-1 text-xl font-black text-slate-950">Журнал руху грошей</h2><p className="mt-1 text-xs font-semibold text-slate-500">Кожна оплата й витрата має джерело. ФОП або рахунок можна виправити без втрати історії.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук: клієнт, ФОП, сума…" className={`${inputClass} sm:min-w-[260px]`} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}><option value="all">Всі операції</option><option value="income">Надходження</option><option value="expense">Витрати</option><option value="transfer">Перекази</option></select>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredTransactions.length ? filteredTransactions.map((item) => {
            const isIncome = item.direction === 'income';
            const isTransfer = item.direction === 'transfer';
            return (
              <div key={item.id} className="grid grid-cols-1 gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[48px_minmax(0,1fr)_minmax(180px,0.45fr)_auto] md:items-center md:p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : isTransfer ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>{isIncome ? <ArrowDownLeft size={18} /> : isTransfer ? <ArrowRightLeft size={18} /> : <ArrowUpRight size={18} />}</div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-slate-950">{item.title}</p>{item.virtual_allocation && <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Авто</span>}</div><p className="mt-1 text-[11px] font-semibold text-slate-500">{item.category_label}{item.counterparty ? ` · ${item.counterparty}` : ''}{item.visit_id ? ` · Замовлення №${item.visit_id}` : ''}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{item.occurred_at ? new Date(item.occurred_at).toLocaleString('uk-UA') : ''}{item.payment_method_label ? ` · ${item.payment_method_label}` : ''}</p></div>
                <div><EntityBadge name={item.legal_entity_name} /><p className="mt-2 text-[11px] font-bold text-slate-500">{item.account_name}{isTransfer && item.target_account_name ? ` → ${item.target_account_name}` : ''}</p></div>
                <div className="flex items-center justify-between gap-3 md:justify-end"><p className={`whitespace-nowrap text-lg font-black ${isIncome ? 'text-emerald-600' : isTransfer ? 'text-blue-600' : 'text-rose-600'}`}>{isIncome ? '+' : isTransfer ? '↔' : '−'} {money(item.amount)}</p>{item.editable && <button type="button" title="Коригувати" onClick={() => item.source_type === 'manual_transaction' ? openManualTransaction(item) : setAllocationTarget(item)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"><Pencil size={15} /></button>}</div>
              </div>
            );
          }) : <div className="p-10 text-center text-sm font-bold text-slate-400">Операцій за цим фільтром немає.</div>}
        </div>
      </section>

      <section className="mt-6 rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-600">Коли запчастини й роботи проходять через різні юрособи</p><h2 className="mt-1 text-xl font-black text-slate-950">Розподіл замовлень по ФОП / ТОВ</h2><p className="mt-1 text-xs font-semibold text-slate-500">Для одного ФОП нічого вибирати не треба — він підставляється автоматично. Для кількох можна окремо призначити запчастини та роботи.</p></div>
        <div className="divide-y divide-slate-100">
          {(data?.recent_visits || []).length ? data.recent_visits.map((visit) => <VisitAssignmentRow key={visit.visit_id} visit={visit} entities={entities} onSaved={load} />) : <div className="p-8 text-center text-sm font-bold text-slate-400">Замовлень ще немає.</div>}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">Бухгалтеру</p><h2 className="mt-1 text-xl font-black text-slate-950">Фінансові реєстри</h2><p className="mt-1 text-xs font-semibold text-slate-500">Файл відкривається в Excel та містить ФОП / ТОВ, рахунок, категорію, контрагента й джерело.</p></div><FileSpreadsheet size={24} className="text-blue-600" /></div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><button type="button" onClick={() => exportCsv('all')} className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase text-white"><Download size={15} className="mr-2 inline" />Весь рух</button><button type="button" onClick={() => exportCsv('income')} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white"><Download size={15} className="mr-2 inline" />Прибуткова</button><button type="button" onClick={() => exportCsv('expense')} className="rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase text-white"><Download size={15} className="mr-2 inline" />Витратна</button></div>
        </div>
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-violet-600">Контроль</p><h2 className="mt-1 text-xl font-black text-slate-950">Історія коригувань</h2><p className="mt-1 text-xs font-semibold text-slate-500">Зміна ФОП, рахунку або операції не проходить безслідно.</p></div><ShieldCheck size={24} className="text-violet-600" /></div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">{(data?.changes || []).length ? data.changes.map((change) => <div key={change.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-slate-800">{change.action_label} · {change.object_type}</p><span className="text-[9px] font-bold text-slate-400">{change.created_at ? new Date(change.created_at).toLocaleString('uk-UA') : ''}</span></div><p className="mt-1 text-[10px] font-semibold text-slate-500">{change.changed_by || 'Система'}{change.reason ? ` · ${change.reason}` : ''}</p></div>) : <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-400">Коригувань ще не було.</p>}</div>
        </div>
      </section>

      {configOpen && <FinanceConfigModal data={data} onClose={() => setConfigOpen(false)} onSaved={() => { setConfigOpen(false); load(); }} />}
      {expenseOpen && <ExpenseModal data={data} onClose={() => setExpenseOpen(false)} onSaved={() => { setExpenseOpen(false); setMessage('Витрату додано. Аналітика й Фінанси оновлені.'); load(); }} />}
      {transactionOpen && <TransactionModal data={data} value={editingTransaction} onClose={() => { setTransactionOpen(false); setEditingTransaction(null); }} onSaved={() => { setTransactionOpen(false); setEditingTransaction(null); load(); }} />}
      {allocationTarget && <AllocationModal data={data} target={allocationTarget} onClose={() => setAllocationTarget(null)} onSaved={() => { setAllocationTarget(null); setMessage('Розподіл виправлено. Зміна записана в історію.'); load(); }} />}
    </AppPage>
  );
}

function VisitAssignmentRow({ visit, entities, onSaved }) {
  const [partsId, setPartsId] = useState(String(visit.parts_legal_entity_id || ''));
  const [servicesId, setServicesId] = useState(String(visit.services_legal_entity_id || ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const activeEntities = entities.filter((item) => item.is_active);

  const save = async () => {
    if (!partsId || !servicesId) return;
    setSaving(true);
    try {
      await api.patch(`/api/finance/visit/${visit.visit_id}/assignment/`, {
        parts_legal_entity_id: Number(partsId),
        services_legal_entity_id: Number(servicesId),
        reason: 'Коригування розподілу замовлення',
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_minmax(180px,0.7fr)_auto] md:items-end md:p-5">
      <div><p className="text-sm font-black text-slate-950">№{visit.visit_id} · {visit.client || visit.plate || 'Замовлення'}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{visit.plate || 'Без авто'} · запчастини {money(visit.parts_total)} · роботи {money(visit.services_total)}</p></div>
      <Field label="Запчастини"><select value={partsId} onChange={(event) => setPartsId(event.target.value)} className={inputClass}>{activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></Field>
      <Field label="Роботи"><select value={servicesId} onChange={(event) => setServicesId(event.target.value)} className={inputClass}>{activeEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></Field>
      <button type="button" disabled={saving} onClick={save} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black uppercase text-white disabled:opacity-50 ${saved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}{saved ? 'Збережено' : 'Зберегти'}</button>
    </div>
  );
}

function ExpenseModal({ data, onClose, onSaved }) {
  const entities = (data?.entities || []).filter((item) => item.is_active);
  const [form, setForm] = useState({ date: today(), category: 'other', title: '', amount: '', payment_method: 'cash', legal_entity_id: entities.find((item) => item.is_primary)?.id || entities[0]?.id || '', account_id: '', comment: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const accounts = (data?.accounts || []).filter((item) => String(item.legal_entity_id || '') === String(form.legal_entity_id));

  useEffect(() => {
    if (!accounts.find((item) => String(item.id) === String(form.account_id))) {
      const preferred = accounts.find((item) => form.payment_method === 'cash' ? item.account_type === 'cash' : item.account_type !== 'cash') || accounts[0];
      setForm((prev) => ({ ...prev, account_id: preferred?.id || '' }));
    }
  }, [form.legal_entity_id, form.payment_method, data]);

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || num(form.amount) <= 0 || !form.legal_entity_id || !form.account_id) return setError('Заповніть назву, суму, ФОП / ТОВ і рахунок.');
    setSaving(true);
    setError('');
    try {
      const expense = await api.post('/api/expenses/', { date: form.date, category: form.category, title: form.title.trim(), amount: num(form.amount), payment_method: form.payment_method, comment: form.comment, is_recurring: false, recurring_period: 'none' });
      await api.put('/api/finance/source-allocation/', {
        source_type: 'expense',
        source_id: expense.data.id,
        allocations: [{ legal_entity_id: Number(form.legal_entity_id), account_id: Number(form.account_id), amount: num(form.amount), note: form.comment }],
        reason: form.reason || 'Вказано ФОП / ТОВ при створенні витрати',
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || Object.values(err.response?.data || {})?.[0] || 'Не вдалося додати витрату.');
    } finally { setSaving(false); }
  };

  return <Modal title="Нова витрата" subtitle="Звичайна витрата потрапляє і в поточну Аналітику, і в новий фінансовий журнал." onClose={onClose}><form onSubmit={save} className="space-y-4 p-5 md:p-6">{error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{String(error)}</div>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Дата"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></Field><Field label="Категорія"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>{EXPENSE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div><Field label="Назва витрати"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Наприклад: оренда боксу" /></Field><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Сума"><input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" min="0" step="0.01" className={inputClass} /></Field><Field label="Спосіб"><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inputClass}><option value="cash">Готівка</option><option value="card">Картка</option><option value="bank">Рахунок / банк</option><option value="other">Інше</option></select></Field></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="ФОП / ТОВ"><select value={form.legal_entity_id} onChange={(e) => setForm({ ...form, legal_entity_id: e.target.value, account_id: '' })} className={inputClass}>{entities.map((item) => <option key={item.id} value={item.id}>{item.entity_type_label} · {item.name}</option>)}</select></Field><Field label="Звідки оплачено"><select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={inputClass}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><Field label="Коментар"><textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={`${inputClass} min-h-20`} /></Field><Field label="Причина / примітка до історії"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputClass} placeholder="Необов'язково" /></Field><div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase">Скасувати</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти</button></div></form></Modal>;
}

function TransactionModal({ data, value, onClose, onSaved }) {
  const entities = (data?.entities || []).filter((item) => item.is_active);
  const initialEntity = value?.legal_entity_id || entities.find((item) => item.is_primary)?.id || entities[0]?.id || '';
  const [form, setForm] = useState({ id: value?.id || null, kind: value?.kind || 'expense', source_type: value?.source_type || 'manual', occurred_at: value?.occurred_at ? String(value.occurred_at).slice(0, 16) : localInputNow(), amount: value?.amount ?? '', legal_entity_id: initialEntity, account_id: value?.account_id || '', target_account_id: value?.target_account_id || '', category: value?.category || 'other', title: value?.title || '', counterparty: value?.counterparty || '', employee_id: value?.employee_id || '', supplier_id: value?.supplier_id || '', payment_method: value?.payment_method || '', comment: value?.comment || '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const accounts = (data?.accounts || []).filter((item) => String(item.legal_entity_id || '') === String(form.legal_entity_id));
  const allAccounts = data?.accounts || [];

  useEffect(() => {
    if (!form.account_id || !accounts.some((item) => String(item.id) === String(form.account_id))) setForm((prev) => ({ ...prev, account_id: accounts.find((item) => item.is_primary)?.id || accounts[0]?.id || '' }));
  }, [form.legal_entity_id, data]);

  const changeSource = (sourceType) => {
    const patch = { source_type: sourceType };
    if (['salary', 'supplier', 'tax', 'refund'].includes(sourceType)) patch.kind = 'expense';
    if (sourceType === 'owner' && form.kind === 'transfer') patch.kind = 'income';
    setForm({ ...form, ...patch });
  };

  const save = async (event) => {
    event.preventDefault();
    if (num(form.amount) <= 0 || !form.account_id) return setError('Вкажіть суму та рахунок.');
    setSaving(true); setError('');
    const payload = { ...form, amount: num(form.amount), legal_entity_id: Number(form.legal_entity_id) || null, account_id: Number(form.account_id) || null, target_account_id: Number(form.target_account_id) || null, employee_id: Number(form.employee_id) || null, supplier_id: Number(form.supplier_id) || null };
    try {
      if (form.id) await api.patch(`/api/finance/transactions/${form.id}/`, payload); else await api.post('/api/finance/transactions/', payload);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || err.response?.data?.detail || Object.values(err.response?.data || {})?.[0] || 'Не вдалося зберегти операцію.'); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id || !window.confirm('Видалити цю фінансову операцію? Зміна залишиться в журналі коригувань.')) return;
    setSaving(true);
    try { await api.delete(`/api/finance/transactions/${form.id}/`, { data: { reason: form.reason || 'Видалення користувачем' } }); onSaved(); } catch { setError('Не вдалося видалити операцію.'); setSaving(false); }
  };

  return <Modal title={form.id ? 'Редагування операції' : 'Нова фінансова операція'} subtitle="Для зарплат і постачальників це фактична виплата грошей, а не повторна витрата в Аналітиці." onClose={onClose}><form onSubmit={save} className="space-y-4 p-5 md:p-6">{error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{String(error)}</div>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Тип руху"><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inputClass}><option value="income">Надходження</option><option value="expense">Витрата / виплата</option><option value="transfer">Переказ між рахунками</option></select></Field><Field label="Призначення"><select value={form.source_type} onChange={(e) => changeSource(e.target.value)} className={inputClass}>{(data?.meta?.transaction_sources || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Field></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Дата й час"><input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className={inputClass} /></Field><Field label="Сума"><input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></Field></div><Field label="Опис"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Наприклад: виплата зарплати за серпень" /></Field><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="ФОП / ТОВ"><select value={form.legal_entity_id} onChange={(e) => setForm({ ...form, legal_entity_id: e.target.value, account_id: '' })} className={inputClass}>{entities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label={form.kind === 'transfer' ? 'З рахунку' : 'Каса / рахунок'}><select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={inputClass}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>{form.kind === 'transfer' && <Field label="На рахунок"><select value={form.target_account_id} onChange={(e) => setForm({ ...form, target_account_id: e.target.value })} className={inputClass}><option value="">Оберіть</option>{allAccounts.filter((item) => String(item.id) !== String(form.account_id)).map((item) => <option key={item.id} value={item.id}>{item.legal_entity_name} · {item.name}</option>)}</select></Field>}{form.source_type === 'salary' && <Field label="Працівник"><select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className={inputClass}><option value="">Оберіть майстра / працівника</option>{(data?.meta?.employees || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}{form.source_type === 'supplier' && <Field label="Постачальник"><select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputClass}><option value="">Оберіть постачальника</option>{(data?.meta?.suppliers || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}<Field label="Контрагент"><input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} className={inputClass} placeholder="Якщо немає в довіднику" /></Field><Field label="Коментар"><textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={`${inputClass} min-h-20`} /></Field><Field label="Причина коригування"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputClass} placeholder={form.id ? 'Наприклад: помилково вибрали рахунок' : 'Необов’язково'} /></Field><div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">{form.id ? <button type="button" onClick={remove} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-black uppercase text-red-600"><Trash2 size={15} /> Видалити</button> : <span />}<div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase">Скасувати</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти</button></div></div></form></Modal>;
}

function AllocationModal({ data, target, onClose, onSaved }) {
  const [payload, setPayload] = useState(null);
  const [rows, setRows] = useState([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const entities = (data?.entities || []).filter((item) => item.is_active);

  useEffect(() => {
    let active = true;
    api.get(`/api/finance/source-allocation/?source_type=${encodeURIComponent(target.source_type)}&source_id=${encodeURIComponent(target.source_id)}`).then((response) => {
      if (!active) return;
      setPayload(response.data);
      setRows((response.data?.allocations || []).map((item) => ({ legal_entity_id: item.legal_entity_id, account_id: item.account_id, amount: item.amount, note: item.note || '' })));
    }).catch((err) => { if (active) setError(err.response?.data?.error || 'Не вдалося завантажити розподіл.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target]);

  const accountsFor = (entityId) => (data?.accounts || []).filter((item) => String(item.legal_entity_id || '') === String(entityId));
  const setRow = (index, patch) => setRows(rows.map((row, idx) => idx === index ? { ...row, ...patch } : row));
  const total = rows.reduce((sum, row) => sum + num(row.amount), 0);
  const expected = num(payload?.amount);

  const addRow = () => {
    const entity = entities[0];
    const account = accountsFor(entity?.id)[0];
    setRows([...rows, { legal_entity_id: entity?.id || '', account_id: account?.id || '', amount: '', note: '' }]);
  };

  const save = async () => {
    if (!reason.trim()) return setError('Вкажіть причину коригування — вона залишиться в історії.');
    if (Math.abs(total - expected) > 0.009) return setError(`Розподіл має дорівнювати ${money(expected)}.`);
    setSaving(true); setError('');
    try {
      await api.put('/api/finance/source-allocation/', { source_type: target.source_type, source_id: target.source_id, allocations: rows.map((row) => ({ legal_entity_id: Number(row.legal_entity_id), account_id: Number(row.account_id), amount: num(row.amount), note: row.note })), reason: reason.trim() });
      onSaved();
    } catch (err) { setError(err.response?.data?.allocations || err.response?.data?.error || 'Не вдалося зберегти коригування.'); } finally { setSaving(false); }
  };

  return <Modal wide title="Коригування ФОП / ТОВ" subtitle="Можна рознести одну оплату між кількома ФОП / ТОВ. Загальна сума має залишитися незмінною." onClose={onClose}><div className="p-5 md:p-6">{loading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div> : <><div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase text-slate-400">Джерело</p><p className="mt-1 text-sm font-black text-slate-900">{payload?.title}</p></div><div className="rounded-2xl bg-blue-50 p-4"><p className="text-[10px] font-black uppercase text-blue-400">Сума операції</p><p className="mt-1 text-lg font-black text-blue-700">{money(expected)}</p></div><div className={`rounded-2xl p-4 ${Math.abs(total - expected) <= 0.009 ? 'bg-emerald-50' : 'bg-rose-50'}`}><p className="text-[10px] font-black uppercase text-slate-400">Розподілено</p><p className={`mt-1 text-lg font-black ${Math.abs(total - expected) <= 0.009 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(total)}</p></div></div>{error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{String(error)}</div>}<div className="space-y-3">{rows.map((row, index) => { const rowAccounts = accountsFor(row.legal_entity_id); return <div key={index} className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_180px_44px] md:items-end"><Field label="ФОП / ТОВ"><select value={row.legal_entity_id} onChange={(e) => { const entityId = e.target.value; const firstAccount = accountsFor(entityId)[0]; setRow(index, { legal_entity_id: entityId, account_id: firstAccount?.id || '' }); }} className={inputClass}>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.entity_type_label} · {entity.name}</option>)}</select></Field><Field label="Каса / рахунок"><select value={row.account_id || ''} onChange={(e) => setRow(index, { account_id: e.target.value })} className={inputClass}>{rowAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Сума"><input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => setRow(index, { amount: e.target.value })} className={inputClass} /></Field><button type="button" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, idx) => idx !== index))} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-100 bg-white text-red-500 disabled:opacity-30"><Trash2 size={15} /></button></div>; })}</div><button type="button" onClick={addRow} className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black uppercase text-blue-700"><Plus size={15} /> Розділити ще</button><div className="mt-5"><Field label="Причина коригування" hint="Обов'язково: щоб власник бачив хто і чому змінив ФОП або рахунок."><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Наприклад: менеджер помилково поставив ФОП №1" /></Field></div><div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase">Скасувати</button><button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Зберегти коригування</button></div></>}</div></Modal>;
}

function FinanceConfigModal({ data, onClose, onSaved }) {
  const [entities, setEntities] = useState(data?.entities || []);
  const [accounts, setAccounts] = useState(data?.accounts || []);
  const [entityForm, setEntityForm] = useState(null);
  const [accountForm, setAccountForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reloadLists = async () => {
    const [entityRes, accountRes] = await Promise.all([api.get('/api/finance/legal-entities/'), api.get('/api/finance/accounts/')]);
    setEntities(entityRes.data?.results || []); setAccounts(accountRes.data?.results || []);
  };

  const newEntity = () => setEntityForm({ id: null, entity_type: 'fop', name: '', tax_id: '', registration_code: '', iban: '', bank_name: '', requisites: '', is_primary: entities.length === 0, is_default_for_parts: entities.length === 0, is_default_for_services: entities.length === 0, is_active: true, reason: '' });
  const newAccount = (entityId = entities.find((item) => item.is_primary)?.id || entities[0]?.id) => setAccountForm({ id: null, legal_entity_id: entityId || '', name: '', account_type: 'cash', currency: 'UAH', iban: '', bank_name: '', opening_balance: 0, is_primary: false, is_active: true, reason: '' });

  const saveEntity = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { if (entityForm.id) await api.patch(`/api/finance/legal-entities/${entityForm.id}/`, entityForm); else await api.post('/api/finance/legal-entities/', entityForm); await reloadLists(); setEntityForm(null); } catch (err) { setError(err.response?.data?.name || err.response?.data?.error || 'Не вдалося зберегти ФОП / ТОВ.'); } finally { setSaving(false); }
  };
  const saveAccount = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { if (accountForm.id) await api.patch(`/api/finance/accounts/${accountForm.id}/`, accountForm); else await api.post('/api/finance/accounts/', accountForm); await reloadLists(); setAccountForm(null); } catch (err) { setError(err.response?.data?.name || err.response?.data?.error || 'Не вдалося зберегти рахунок.'); } finally { setSaving(false); }
  };

  return <Modal wide title="ФОП / ТОВ та рахунки" subtitle="Один ФОП працює автоматично. Для кількох юросіб задайте окремі правила для запчастин і робіт." onClose={onClose}><div className="grid grid-cols-1 gap-0 lg:grid-cols-2"><section className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-blue-600">Юридичні особи</p><h3 className="text-lg font-black text-slate-950">ФОП / ТОВ</h3></div><button type="button" onClick={newEntity} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-black uppercase text-white"><Plus size={14} /> Додати</button></div><div className="space-y-2">{entities.map((entity) => <button type="button" key={entity.id} onClick={() => setEntityForm({ ...entity, reason: '' })} className={`w-full rounded-2xl border p-4 text-left transition hover:border-blue-200 ${entity.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-55'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{entity.entity_type_label} · {entity.name}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{entity.tax_id || entity.registration_code || 'Реквізити не заповнені'}</p></div><ChevronRight size={16} className="text-slate-300" /></div><div className="mt-3 flex flex-wrap gap-1.5">{entity.is_primary && <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase text-white">Основний</span>}{entity.is_default_for_parts && <span className="rounded-full bg-blue-100 px-2 py-1 text-[9px] font-black uppercase text-blue-700">Запчастини</span>}{entity.is_default_for_services && <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Роботи</span>}</div></button>)}</div></section><section className="p-5 md:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-emerald-600">Гроші фізично</p><h3 className="text-lg font-black text-slate-950">Каси / банки / картки</h3></div><button type="button" onClick={() => newAccount()} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-black uppercase text-white"><Plus size={14} /> Додати</button></div><div className="space-y-2">{accounts.map((account) => <button type="button" key={account.id} onClick={() => setAccountForm({ ...account, reason: '' })} className={`w-full rounded-2xl border p-4 text-left transition hover:border-emerald-200 ${account.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-55'}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{account.name}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{account.legal_entity_name} · {account.account_type_label} · старт {money(account.opening_balance)}</p></div><ChevronRight size={16} className="text-slate-300" /></div></button>)}</div></section></div>{error && <div className="mx-5 mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 md:mx-6">{String(error)}</div>}{entityForm && <div className="border-t border-slate-100 bg-slate-50 p-5 md:p-6"><form onSubmit={saveEntity} className="mx-auto max-w-4xl space-y-4"><div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-950">{entityForm.id ? 'Редагувати юрособу' : 'Нова юрособа'}</h3><button type="button" onClick={() => setEntityForm(null)}><X size={18} /></button></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Тип"><select value={entityForm.entity_type} onChange={(e) => setEntityForm({ ...entityForm, entity_type: e.target.value })} className={inputClass}><option value="fop">ФОП</option><option value="tov">ТОВ</option><option value="other">Інша юрособа</option></select></Field><Field label="Назва"><input value={entityForm.name} onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })} className={inputClass} placeholder="ФОП Іваненко І.І." /></Field><Field label="ІПН"><input value={entityForm.tax_id || ''} onChange={(e) => setEntityForm({ ...entityForm, tax_id: e.target.value })} className={inputClass} /></Field><Field label="ЄДРПОУ / код"><input value={entityForm.registration_code || ''} onChange={(e) => setEntityForm({ ...entityForm, registration_code: e.target.value })} className={inputClass} /></Field><Field label="IBAN"><input value={entityForm.iban || ''} onChange={(e) => setEntityForm({ ...entityForm, iban: e.target.value })} className={inputClass} /></Field><Field label="Банк"><input value={entityForm.bank_name || ''} onChange={(e) => setEntityForm({ ...entityForm, bank_name: e.target.value })} className={inputClass} /></Field></div><Field label="Реквізити"><textarea value={entityForm.requisites || ''} onChange={(e) => setEntityForm({ ...entityForm, requisites: e.target.value })} className={`${inputClass} min-h-20`} /></Field><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{[['is_primary','Основний'],['is_default_for_parts','Запчастини за замовчуванням'],['is_default_for_services','Роботи за замовчуванням']].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700"><input type="checkbox" checked={Boolean(entityForm[key])} onChange={(e) => setEntityForm({ ...entityForm, [key]: e.target.checked })} />{label}</label>)}</div><Field label="Причина зміни"><input value={entityForm.reason || ''} onChange={(e) => setEntityForm({ ...entityForm, reason: e.target.value })} className={inputClass} /></Field><div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white"><Save size={15} /> Зберегти ФОП / ТОВ</button></div></form></div>}{accountForm && <div className="border-t border-slate-100 bg-slate-50 p-5 md:p-6"><form onSubmit={saveAccount} className="mx-auto max-w-4xl space-y-4"><div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-950">{accountForm.id ? 'Редагувати рахунок' : 'Новий рахунок'}</h3><button type="button" onClick={() => setAccountForm(null)}><X size={18} /></button></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="ФОП / ТОВ"><select value={accountForm.legal_entity_id || ''} onChange={(e) => setAccountForm({ ...accountForm, legal_entity_id: e.target.value })} className={inputClass}>{entities.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Назва"><input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} className={inputClass} placeholder="Каса / PrivatBank / Mono" /></Field><Field label="Тип"><select value={accountForm.account_type} onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })} className={inputClass}>{(data?.meta?.account_types || []).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Field><Field label="Початковий залишок"><input type="number" step="0.01" value={accountForm.opening_balance ?? 0} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} className={inputClass} /></Field><Field label="IBAN"><input value={accountForm.iban || ''} onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })} className={inputClass} /></Field><Field label="Банк"><input value={accountForm.bank_name || ''} onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })} className={inputClass} /></Field></div><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700"><input type="checkbox" checked={Boolean(accountForm.is_primary)} onChange={(e) => setAccountForm({ ...accountForm, is_primary: e.target.checked })} />Основний рахунок цієї юрособи</label><Field label="Причина зміни"><input value={accountForm.reason || ''} onChange={(e) => setAccountForm({ ...accountForm, reason: e.target.value })} className={inputClass} /></Field><div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase text-white"><Save size={15} /> Зберегти рахунок</button></div></form></div>}<div className="flex justify-end border-t border-slate-100 p-5"><button type="button" onClick={onSaved} className="rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white">Готово</button></div></Modal>;
}

export default Finance;
