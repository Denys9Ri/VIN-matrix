import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import {
  Activity,
  AlertTriangle,
  BarChart,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  DollarSign,
  Loader2,
  Package,
  PieChart,
  Plus,
  Save,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CopyButton from '../components/common/CopyButton';
import { AppPage, useToast } from '../components/ui';


const PERIODS = [
  { key: 'today', label: 'Сьогодні' },
  { key: '7d', label: '7 днів' },
  { key: '30d', label: '30 днів' },
  { key: 'this_month', label: 'Цей місяць' },
  { key: 'last_month', label: 'Минулий' },
  { key: 'all', label: 'Весь час' },
  { key: 'custom', label: 'Свій' },
];

const DEFAULT_EXPENSE = {
  date: new Date().toISOString().slice(0, 10),
  category: 'other',
  title: '',
  amount: '',
  payment_method: 'cash',
  comment: '',
  is_recurring: false,
  recurring_period: 'none',
};

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

const PAYMENT_METHODS = [
  ['cash', 'Готівка'],
  ['card', 'Картка'],
  ['bank', 'Банк'],
  ['other', 'Інше'],
];

const money = (value) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });
const decimalMoney = (value) => Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
const percent = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}%`;
const listOf = (value) => (Array.isArray(value) ? value : []);

const salarySchemeLabel = (value) => ({
  services_only: 'тільки роботи',
  services_and_parts_profit: 'роботи + запчастини',
  order_profit: 'прибуток замовлення',
  fixed: 'фіксовано',
}[value] || 'схема не вказана');

const payoutLabel = (value) => ({
  daily: 'щодня',
  weekly: 'щотижня',
  monthly: 'щомісяця',
  custom: 'довільно',
}[value] || 'щомісяця');

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const Analytics = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedMechanicId, setExpandedMechanicId] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState(DEFAULT_EXPENSE);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period: timeFilter });
      if (timeFilter === 'custom') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      const res = await api.get(`/api/analytics/summary/?${params.toString()}`);
      setData(res.data || {});
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }
      setError(err.response?.data?.error || 'Не вдалося завантажити аналітику. Перевірте backend endpoint /api/analytics/summary/.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [navigate, timeFilter, dateFrom, dateTo]);

  const handleAddExpense = async (event) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount || 0);
    if (!expenseForm.title.trim()) return toast.warning('Вкажіть назву витрати.');
    if (!amount || amount <= 0) return toast.warning('Вкажіть суму витрати.');

    setExpenseSaving(true);
    try {
      await api.post('/api/expenses/', {
        ...expenseForm,
        title: expenseForm.title.trim(),
        amount,
      });
      setExpenseModalOpen(false);
      setExpenseForm(DEFAULT_EXPENSE);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Не вдалося додати витрату.');
    } finally {
      setExpenseSaving(false);
    }
  };

  const summary = data?.summary || {};
  const chart = listOf(data?.chart);
  const products = data?.products || {};
  const services = data?.services || {};
  const clients = data?.clients || {};
  const debts = data?.debts || {};
  const mechanics = data?.mechanics || {};
  const workPosts = data?.work_posts || {};
  const suppliers = data?.suppliers || {};
  const expenses = data?.expenses || {};
  const isStore = data?.business_type === 'store' || data?.company?.business_type === 'store';

  const mechanicItems = listOf(mechanics.items).filter((item) => item && (item.id || item.employee_id || item.name));
  const hasMechanics = !isStore && mechanicItems.length > 0;
  const supplierItems = listOf(suppliers.items);
  const expenseCategories = listOf(expenses.categories);
  const expenseItems = listOf(expenses.items);
  const topProductsByRevenue = listOf(products.top_by_revenue);
  const topProductsByProfit = listOf(products.top_by_profit);
  const deadStockItems = listOf(products.dead_stock);
  const lowMarginProducts = listOf(products.low_margin);
  const topClients = listOf(clients.top_by_revenue);
  const sleepingClients = listOf(clients.sleeping);

  const maxChartValue = useMemo(() => {
    const values = chart.map((item) => Math.max(Number(item.revenue || 0), Number(item.net_profit || 0), 0));
    return Math.max(...values, 1);
  }, [chart]);

  if (loading) return <AnalyticsLoading />;

  if (!data && error) {
    return (
      <AppPage className="max-w-[1280px] pb-24">
        <AnalyticsEmpty
          error
          title="Аналітика не завантажилась"
          description={error}
          onRetry={fetchData}
        />
      </AppPage>
    );
  }

  const modeTitle = isStore ? 'Аналітика магазину автозапчастин' : 'Аналітика СТО';
  const modeSubtitle = isStore
    ? 'Товари, оборот, постачальники, склад, клієнти, борги та витрати магазину'
    : 'Каса, прибуток, борги, майстри, пости, постачальники та витрати СТО';

  return (
    <AppPage className="max-w-[1680px] flex flex-col pb-24">
      <Header
        title={modeTitle}
        subtitle={modeSubtitle}
        period={data?.period}
        isStore={isStore}
        summary={summary}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />

      <SectionNav isStore={isStore} hasMechanics={hasMechanics} hasWorkPosts={listOf(workPosts.items).length > 0} />

      {error && <ErrorBox message={error} />}

      {isStore ? (
        <StoreAnalytics
          summary={summary}
          chart={chart}
          maxChartValue={maxChartValue}
          products={products}
          topProductsByRevenue={topProductsByRevenue}
          topProductsByProfit={topProductsByProfit}
          lowMarginProducts={lowMarginProducts}
          deadStockItems={deadStockItems}
          suppliers={suppliers}
          supplierItems={supplierItems}
          clients={clients}
          topClients={topClients}
          sleepingClients={sleepingClients}
          debts={debts}
          expenses={expenses}
          expenseCategories={expenseCategories}
          expenseItems={expenseItems}
          onOpenExpense={() => setExpenseModalOpen(true)}
        />
      ) : (
        <StoAnalytics
          summary={summary}
          chart={chart}
          maxChartValue={maxChartValue}
          products={products}
          services={services}
          workPosts={workPosts}
          suppliers={suppliers}
          supplierItems={supplierItems}
          clients={clients}
          debts={debts}
          expenses={expenses}
          expenseCategories={expenseCategories}
          expenseItems={expenseItems}
          mechanics={mechanics}
          mechanicItems={mechanicItems}
          hasMechanics={hasMechanics}
          expandedMechanicId={expandedMechanicId}
          onToggleMechanic={(id) => setExpandedMechanicId(expandedMechanicId === id ? null : id)}
          onOpenExpense={() => setExpenseModalOpen(true)}
        />
      )}

      {expenseModalOpen && (
        <ExpenseModal
          data={expenseForm}
          setData={setExpenseForm}
          saving={expenseSaving}
          onSubmit={handleAddExpense}
          onClose={() => setExpenseModalOpen(false)}
        />
      )}
    </AppPage>
  );
};

const Header = ({ title, subtitle, period, isStore, summary = {}, timeFilter, setTimeFilter, dateFrom, setDateFrom, dateTo, setDateTo }) => (
  <div className="mb-5 overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
    <div className="relative bg-gradient-to-br from-slate-950 via-blue-950 to-sky-700 px-5 py-6 text-white md:px-8 md:py-7">
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_26%),radial-gradient(circle_at_80%_0%,#38bdf8,transparent_30%)]" />
      <div className="relative flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
            <BarChart size={14} /> Premium dashboard
          </div>
          <h1 className="mt-4 text-3xl font-black uppercase italic leading-tight md:text-5xl">Аналітика</h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-blue-100 md:text-base">{subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white">{isStore ? 'Магазин' : 'СТО'}</span>
            {period?.label && <span className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-blue-100">{period.label}{period.date_from ? ` · ${period.date_from} — ${period.date_to}` : ''}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 2xl:w-[620px]">
          <HeroStat label="Виручка" value={`${money(summary.revenue)} ₴`} />
          <HeroStat label="Чистий прибуток" value={`${money(summary.net_profit)} ₴`} good />
          <HeroStat label="Борги" value={`${money(summary.debt_total)} ₴`} danger={Number(summary.debt_total || 0) > 0} />
        </div>
      </div>
    </div>

    <div className="border-t border-slate-100 bg-white p-3 md:p-4">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1.5 2xl:w-auto">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTimeFilter(item.key)}
              className={`min-h-[42px] flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black uppercase transition-all 2xl:flex-none ${timeFilter === item.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {timeFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2 2xl:w-[360px]">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
        )}
      </div>
    </div>
  </div>
);

const SectionNav = ({ isStore, hasMechanics, hasWorkPosts }) => {
  const items = isStore
    ? [
        ['overview-section', <BarChart size={15} />, 'Огляд'],
        ['orders-section', <ShoppingCart size={15} />, 'Замовлення'],
        ['products-section', <Package size={15} />, 'Товари'],
        ['suppliers-section', <Package size={15} />, 'Постачальники'],
        ['stock-section', <Building2 size={15} />, 'Склад'],
        ['clients-section', <Users size={15} />, 'Клієнти'],
        ['expenses-section', <DollarSign size={15} />, 'Витрати'],
      ]
    : [
        ['overview-section', <BarChart size={15} />, 'Огляд'],
        ...(hasMechanics ? [['mechanics-section', <Users size={15} />, 'Майстри']] : []),
        ...(hasWorkPosts ? [['posts-section', <Building2 size={15} />, 'Пости']] : []),
        ['suppliers-section', <Package size={15} />, 'Постачальники'],
        ['expenses-section', <DollarSign size={15} />, 'Витрати'],
        ['clients-section', <Users size={15} />, 'Клієнти'],
        ['products-section', <Package size={15} />, 'Товари / роботи'],
      ];

  return (
    <div className="sticky top-2 z-20 bg-white/90 backdrop-blur rounded-[26px] border border-slate-200 shadow-sm p-2 mb-5 overflow-x-auto">
      <div className="flex gap-2 min-w-max">
        {items.map(([id, icon, label], idx) => (
          <button
            key={id}
            onClick={() => scrollToSection(id)}
            className={`rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center gap-2 transition ${idx === 0 ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ErrorBox = ({ message }) => (
  <div className="mb-6 bg-red-50 border border-red-100 text-red-700 rounded-3xl p-4 flex items-start gap-3">
    <AlertTriangle className="shrink-0 mt-0.5" size={18} />
    <div><p className="font-black text-sm uppercase">Помилка аналітики</p><p className="text-sm font-semibold mt-1">{message}</p></div>
  </div>
);


const SectionTitle = ({ icon, title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
    <div>
      <h3 className="font-black uppercase text-slate-900 flex items-center gap-2 text-sm">
        {icon}
        {title}
      </h3>
      {subtitle && <p className="text-xs font-semibold text-slate-500 mt-1 max-w-3xl">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const StoreAnalytics = ({ summary, chart, maxChartValue, products, topProductsByRevenue, topProductsByProfit, lowMarginProducts, deadStockItems, suppliers, supplierItems, clients, topClients, sleepingClients, debts, expenses, expenseCategories, expenseItems, onOpenExpense }) => (
  <>
    <div id="overview-section" className="scroll-mt-28 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4 mb-6">
      <MetricCard icon={<Wallet size={15} />} label="Виручка" value={`${money(summary.revenue)} ₴`} tone="blue" />
      <MetricCard icon={<Package size={15} />} label="Закупка проданого" value={`${money(summary.cost)} ₴`} tone="slate" />
      <MetricCard icon={<TrendingUp size={15} />} label="Валовий прибуток" value={`${money(summary.gross_profit)} ₴`} sub={`Маржа ${percent(summary.margin_percent)}`} tone="emerald" />
      <MetricCard icon={<CheckCircle2 size={15} />} label="Чистий прибуток" value={`${money(summary.net_profit)} ₴`} sub={`Після витрат ${percent(summary.net_margin_percent)}`} tone="green" />
      <MetricCard icon={<DollarSign size={15} />} label="Витрати магазину" value={`${money(summary.operating_expenses)} ₴`} tone="red" />
      <MetricCard icon={<ShoppingCart size={15} />} label="Закриті замовлення" value={summary.completed_orders_count || 0} sub={`Сер. чек ${money(summary.average_check)} ₴`} tone="orange" />
      <MetricCard icon={<AlertTriangle size={15} />} label="Борги" value={`${money(summary.debt_total)} ₴`} sub={`${summary.debt_orders_count || 0} зам.`} tone="red" />
      <MetricCard icon={<Activity size={15} />} label="Активні" value={summary.active_orders_count || 0} sub={`Воронка ${money(summary.pipeline_revenue)} ₴`} tone="purple" />
    </div>

    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-6">
      <ChartPanel chart={chart} maxChartValue={maxChartValue} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-1 gap-4">
        <SmallStat label="Оплачено" value={`${money(summary.paid_total)} ₴`} icon={<CheckCircle2 size={16} />} />
        <SmallStat label="Незакрита сума" value={`${money(summary.pipeline_revenue)} ₴`} icon={<Activity size={16} />} />
        <SmallStat label="Собівартість проданого" value={`${money(summary.cost)} ₴`} icon={<Package size={16} />} />
        <SmallStat label="Скасовані замовлення" value={summary.cancelled_orders_count || 0} icon={<AlertTriangle size={16} />} />
      </div>
    </div>

    <div id="orders-section" className="scroll-mt-28 mb-6">
      <SectionTitle icon={<ShoppingCart size={17} className="text-blue-600" />} title="Замовлення магазину" subtitle="Де зависають гроші: активні, виконані, борги і скасування." />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <BigMiniCard title="Всі за період" value={summary.orders_count || 0} subtitle="створені / оновлені замовлення" />
        <BigMiniCard title="Виконані" value={summary.completed_orders_count || 0} subtitle={`виручка ${money(summary.revenue)} ₴`} />
        <BigMiniCard title="Активні" value={summary.active_orders_count || 0} subtitle={`у роботі на ${money(summary.pipeline_revenue)} ₴`} />
        <BigMiniCard title="Проблемні" value={summary.debt_orders_count || 0} subtitle={`борг ${money(summary.debt_total)} ₴`} danger />
      </div>
    </div>

    <div id="products-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <ListCard title="Топ товарів за виручкою" icon={<Package size={16} className="text-amber-500" />} empty="Немає проданих товарів">
        {topProductsByRevenue.slice(0, 10).map((part, idx) => <ProductRow key={`${part.article}-${idx}`} item={part} />)}
      </ListCard>
      <ListCard title="Топ товарів за прибутком" icon={<TrendingUp size={16} className="text-emerald-500" />} empty="Немає прибуткових товарів">
        {topProductsByProfit.slice(0, 10).map((part, idx) => <ProductRow key={`${part.article}-${idx}`} item={part} showProfit />)}
      </ListCard>
    </div>

    <SuppliersSection suppliers={suppliers} supplierItems={supplierItems} />

    <div id="stock-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <ListCard title="Залежаний склад" icon={<Building2 size={16} className="text-slate-500" />} empty="Залежаного складу немає або немає залишків">
        {deadStockItems.slice(0, 10).map((item, idx) => <DeadStockRow key={`${item.id || idx}`} item={item} />)}
      </ListCard>
      <ListCard title="Низька маржа товарів" icon={<AlertTriangle size={16} className="text-orange-500" />} empty="Позицій з низькою маржею немає">
        {lowMarginProducts.slice(0, 10).map((part, idx) => <LowMarginRow key={`${part.article}-${idx}`} item={part} />)}
      </ListCard>
      <Panel title="Коротко по складу" icon={<Package size={16} className="text-blue-500" />}>
        <div className="grid grid-cols-1 gap-3">
          <SmallStat label="Собівартість проданого" value={`${money(summary.cost)} ₴`} icon={<Package size={16} />} />
          <SmallStat label="Потенційно залежало" value={`${deadStockItems.length} поз.`} icon={<Clock3 size={16} />} />
          <SmallStat label="Низька маржа" value={`${lowMarginProducts.length} поз.`} icon={<AlertTriangle size={16} />} />
        </div>
      </Panel>
    </div>

    <div id="clients-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <ListCard title="Топ клієнтів" icon={<Users size={16} className="text-emerald-500" />} empty="Немає клієнтів за період">
        {topClients.slice(0, 10).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
      </ListCard>
      <ListCard title="Борги / неоплачені" icon={<AlertTriangle size={16} className="text-red-500" />} empty="Боргів немає">
        {listOf(debts.items).slice(0, 10).map((debt, idx) => <DebtRow key={`${debt.visit_id || idx}`} item={debt} />)}
      </ListCard>
      <ListCard title="Сплячі клієнти" icon={<Clock3 size={16} className="text-slate-500" />} empty="Сплячих клієнтів немає">
        {sleepingClients.slice(0, 10).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
      </ListCard>
    </div>

    <ExpensesSection expenses={expenses} categories={expenseCategories} items={expenseItems} onOpen={onOpenExpense} title="Витрати магазину" />
  </>
);

const StoAnalytics = ({ summary, chart, maxChartValue, products, services, workPosts, suppliers, supplierItems, clients, debts, expenses, expenseCategories, expenseItems, mechanicItems, hasMechanics, expandedMechanicId, onToggleMechanic, onOpenExpense }) => (
  <>
    <div id="overview-section" className="scroll-mt-28 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4 mb-6">
      <MetricCard icon={<Wallet size={15} />} label="Виручка" value={`${money(summary.revenue)} ₴`} tone="blue" />
      <MetricCard icon={<TrendingUp size={15} />} label="Валовий прибуток" value={`${money(summary.gross_profit)} ₴`} sub={`Маржа ${percent(summary.margin_percent)}`} tone="emerald" />
      <MetricCard icon={<CheckCircle2 size={15} />} label="Чистий прибуток" value={`${money(summary.net_profit)} ₴`} sub={`Після зарплат і витрат`} tone="green" />
      <MetricCard icon={<Wrench size={15} />} label="Майстрам" value={`${money(summary.mechanic_commission)} ₴`} tone="purple" />
      <MetricCard icon={<DollarSign size={15} />} label="Витрати СТО" value={`${money(summary.operating_expenses)} ₴`} tone="red" />
      <MetricCard icon={<DollarSign size={15} />} label="Борги" value={`${money(summary.debt_total)} ₴`} sub={`${summary.debt_orders_count || 0} зам.`} tone="red" />
      <MetricCard icon={<Activity size={15} />} label="Закриті візити" value={summary.completed_orders_count || 0} sub={`Сер. чек ${money(summary.average_check)} ₴`} tone="orange" />
      <MetricCard icon={<Package size={15} />} label="Собівартість" value={`${money(summary.cost)} ₴`} tone="slate" />
    </div>

    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-6">
      <ChartPanel chart={chart} maxChartValue={maxChartValue} />
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-1 gap-4">
        <SmallStat label="Активні в роботі" value={summary.active_orders_count || 0} icon={<Clock3 size={16} />} />
        <SmallStat label="Воронка / незакрита сума" value={`${money(summary.pipeline_revenue)} ₴`} icon={<Activity size={16} />} />
        <SmallStat label="Оплачено" value={`${money(summary.paid_total)} ₴`} icon={<CheckCircle2 size={16} />} />
        <SmallStat label="Собівартість запчастин" value={`${money(summary.cost)} ₴`} icon={<Package size={16} />} />
      </div>
    </div>

    {hasMechanics && <MechanicsSection items={mechanicItems} expandedId={expandedMechanicId} onToggle={onToggleMechanic} />}

    <div id="products-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
      <ListCard title="Топ запчастин за виручкою" icon={<Package size={16} className="text-amber-500" />} empty="Немає проданих запчастин">
        {listOf(products.top_by_revenue).slice(0, 10).map((part, idx) => <ProductRow key={`${part.article}-${idx}`} item={part} />)}
      </ListCard>
      <ListCard title="Топ робіт" icon={<Wrench size={16} className="text-purple-500" />} empty="Немає виконаних робіт">
        {listOf(services.top_by_revenue).slice(0, 10).map((service, idx) => <ServiceRow key={`${service.name}-${idx}`} item={service} />)}
      </ListCard>
    </div>

    {listOf(workPosts.items).length > 0 && (
      <div id="posts-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <ListCard title="Пости / підйомники" icon={<Building2 size={16} className="text-cyan-500" />} empty="Немає даних по постах">
          {listOf(workPosts.items).slice(0, 12).map((post, idx) => <WorkPostRow key={`${post.id || idx}`} item={post} />)}
        </ListCard>
      </div>
    )}

    <SuppliersSection suppliers={suppliers} supplierItems={supplierItems} />
    <ExpensesSection expenses={expenses} categories={expenseCategories} items={expenseItems} onOpen={onOpenExpense} title="Витрати СТО" />

    <div id="clients-section" className="scroll-mt-28 grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <ListCard title="Топ клієнтів" icon={<Users size={16} className="text-emerald-500" />} empty="Немає клієнтів за період">
        {listOf(clients.top_by_revenue).slice(0, 10).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
      </ListCard>
      <ListCard title="Борги" icon={<AlertTriangle size={16} className="text-red-500" />} empty="Боргів немає">
        {listOf(debts.items).slice(0, 10).map((debt, idx) => <DebtRow key={`${debt.visit_id || idx}`} item={debt} />)}
      </ListCard>
      <ListCard title="Низька маржа" icon={<TrendingUp size={16} className="text-orange-500" />} empty="Позицій з низькою маржею немає">
        {listOf(products.low_margin).slice(0, 10).map((part, idx) => <LowMarginRow key={`${part.article}-${idx}`} item={part} />)}
      </ListCard>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ListCard title="Залежаний склад" icon={<Package size={16} className="text-slate-500" />} empty="Залежаного складу немає або немає залишків">
        {listOf(products.dead_stock).slice(0, 10).map((item, idx) => <DeadStockRow key={`${item.id || idx}`} item={item} />)}
      </ListCard>
      <ListCard title="Сплячі клієнти" icon={<Clock3 size={16} className="text-slate-500" />} empty="Сплячих клієнтів немає">
        {listOf(clients.sleeping).slice(0, 10).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
      </ListCard>
    </div>
  </>
);

const SuppliersSection = ({ suppliers, supplierItems }) => {
  const lowMarginItems = listOf(suppliers.low_margin);
  return (
    <div id="suppliers-section" className="scroll-mt-28 mb-6 space-y-5">
      <SectionTitle
        icon={<Package size={17} className="text-amber-500" />}
        title="Постачальники"
        subtitle="Оборот, закупка, прибуток і маржа по кожному постачальнику — без каші, як у нормальній CRM."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SmallStat label="Продаж через постачальників" value={`${money(suppliers.summary?.revenue)} ₴`} icon={<Wallet size={16} />} />
        <SmallStat label="Закупка" value={`${money(suppliers.summary?.cost)} ₴`} icon={<Package size={16} />} />
        <SmallStat label="Прибуток" value={`${money(suppliers.summary?.profit)} ₴`} icon={<TrendingUp size={16} />} />
      </div>
      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] gap-6">
        <Panel title="Оборот по постачальниках" icon={<Package size={16} className="text-amber-500" />} subtitle={`${supplierItems.length || 0} постачальників у вибраному періоді`}>
          <SupplierTable items={supplierItems.slice(0, 14)} empty="Немає даних по постачальниках" />
        </Panel>
        <Panel title="Низька маржа" icon={<AlertTriangle size={16} className="text-orange-500" />} subtitle="Кого треба перевірити по націнці або закупці.">
          <div className="space-y-3">
            {lowMarginItems.length ? lowMarginItems.slice(0, 12).map((supplier, idx) => <SupplierRow key={`${supplier.name || idx}`} item={supplier} compact />) : <EmptyState title="Низької маржі по постачальниках немає" />}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const ExpensesSection = ({ expenses, categories, items, onOpen, title }) => (
  <div id="expenses-section" className="scroll-mt-28 mb-6">
    <Panel
      title={title}
      icon={<DollarSign size={16} className="text-rose-500" />}
      subtitle="Оренда, реклама, комунальні, доставка, програми, податки та інші операційні витрати."
      action={<button onClick={onOpen} className="bg-rose-600 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase flex items-center gap-2 hover:bg-rose-700"><Plus size={16} /> Додати витрату</button>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <SmallStat label="Витрати за період" value={`${money(expenses.summary?.total)} ₴`} icon={<DollarSign size={16} />} />
        <SmallStat label="Разові витрати" value={`${money(expenses.summary?.one_time_total)} ₴`} icon={<Activity size={16} />} />
        <SmallStat label="Постійні витрати" value={`${money(expenses.summary?.recurring_total)} ₴`} icon={<Clock3 size={16} />} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ListCard title="Витрати по категоріях" icon={<PieChart size={16} className="text-rose-500" />} empty="Витрат за період немає" inner>
          {categories.slice(0, 12).map((item, idx) => <ExpenseCategoryRow key={`${item.category || idx}`} item={item} />)}
        </ListCard>
        <ListCard title="Останні витрати" icon={<Clock3 size={16} className="text-slate-500" />} empty="Витрат ще немає" inner>
          {items.slice(0, 12).map((item, idx) => <ExpenseItemRow key={`${item.id || idx}`} item={item} />)}
        </ListCard>
      </div>
    </Panel>
  </div>
);

const ChartPanel = ({ chart, maxChartValue }) => (
  <Panel title="Динаміка" icon={<Calendar size={16} className="text-blue-500" />} subtitle="Виручка і чистий прибуток у вибраному періоді.">
    {chart.length > 0 ? (
      <div className="h-[340px] w-full overflow-x-auto rounded-[28px] border border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 pt-10 pb-4">
        <div className="flex h-full min-w-[720px] items-end justify-center gap-3 md:gap-5">
          {chart.map((item, idx) => {
            const revenueHeight = Math.max((Number(item.revenue || 0) / maxChartValue) * 100, 2);
            const netHeight = Math.max((Number(item.net_profit || 0) / maxChartValue) * 100, 2);
            return (
              <div key={`${item.date || idx}`} className="group relative flex h-full min-w-[48px] max-w-[92px] flex-1 flex-col items-center justify-end">
                <div className="pointer-events-none absolute -top-8 z-10 rounded-2xl bg-slate-950 px-3 py-2 text-[10px] font-black text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 whitespace-nowrap">
                  {money(item.revenue)} ₴ · чистий {money(item.net_profit)} ₴
                </div>
                <div className="flex h-full w-full items-end justify-center gap-1.5">
                  <div className="w-1/2 rounded-t-2xl bg-blue-600 transition-all duration-500" style={{ height: `${revenueHeight}%` }} />
                  <div className="w-1/2 rounded-t-2xl bg-emerald-500 transition-all duration-500" style={{ height: `${netHeight}%` }} />
                </div>
                <span className="mt-2 w-full truncate text-center text-[10px] font-black uppercase text-slate-400">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    ) : <EmptyState icon={<BarChart size={42} />} title="Немає даних за цей період" />}
  </Panel>
);

const MetricCard = ({ icon, label, value, sub, tone = 'blue' }) => {
  const tones = {
    blue: 'from-blue-600 to-sky-500 text-white shadow-blue-200/70',
    emerald: 'from-emerald-600 to-teal-500 text-white shadow-emerald-200/70',
    green: 'from-green-600 to-emerald-500 text-white shadow-emerald-200/70',
    purple: 'from-purple-600 to-indigo-500 text-white shadow-purple-200/70',
    red: 'from-rose-600 to-orange-500 text-white shadow-rose-200/70',
    orange: 'from-orange-500 to-amber-400 text-white shadow-orange-200/70',
    slate: 'from-slate-900 to-slate-700 text-white shadow-slate-200/70',
  };
  return (
    <div className={`relative min-h-[156px] overflow-hidden rounded-[28px] bg-gradient-to-br p-4 shadow-xl ${tones[tone] || tones.blue}`}>
      <div className="absolute right-[-32px] top-[-32px] h-28 w-28 rounded-full bg-white/15" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 text-white ring-1 ring-white/15">{icon}</div>
        </div>
        <div className="mt-5">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
          <h3 className="break-words text-2xl font-black leading-tight md:text-3xl">{value}</h3>
          {sub && <p className="mt-2 text-[11px] font-bold text-white/80">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, icon, children, action }) => (
  <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/55 md:p-6">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-950">{icon}{title}</h3>
        {subtitle && <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const ListCard = ({ title, icon, empty, children, inner = false }) => (
  <div className={`${inner ? 'bg-slate-50/70' : 'bg-white'} rounded-[30px] border border-slate-200 p-5 shadow-sm md:p-6`}>
    <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-900">{icon}{title}</h3>
    <div className="space-y-3">
      {React.Children.count(children) > 0 ? children : <EmptyState title={empty} />}
    </div>
  </div>
);

const EmptyState = ({ icon, title }) => (
  <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-slate-300">
    {icon || <BarChart size={34} className="mb-2 opacity-50" />}
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
  </div>
);

const SmallStat = ({ label, value, icon }) => (
  <div className="flex min-h-[96px] items-center gap-4 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">{icon}</div>
    <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="truncate text-xl font-black text-slate-950">{value}</p></div>
  </div>
);

const BigMiniCard = ({ title, value, subtitle, danger }) => (
  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
    <p className={`text-[10px] font-black uppercase tracking-[0.12em] ${danger ? 'text-rose-500' : 'text-slate-400'}`}>{title}</p>
    <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">{subtitle}</p>
  </div>
);

const HeroStat = ({ label, value, good, danger }) => (
  <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">{label}</p>
    <p className={`mt-2 text-xl font-black leading-tight ${good ? 'text-emerald-100' : danger ? 'text-rose-100' : 'text-white'}`}>{value}</p>
  </div>
);

const AnalyticsLoading = () => (
  <AppPage className="max-w-[1280px] pb-24">
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="rounded-[34px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
        <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={34} />
        <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Завантаження аналітики</p>
        <p className="mt-2 text-sm font-semibold text-slate-500">Збираю продажі, прибуток, борги, витрати і постачальників.</p>
      </div>
    </div>
  </AppPage>
);

const AnalyticsEmpty = ({ title, description, onRetry, error }) => (
  <div className="flex min-h-[70vh] items-center justify-center">
    <div className={`w-full max-w-2xl rounded-[34px] border p-8 text-center shadow-xl ${error ? 'border-rose-100 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <AlertTriangle className={`mx-auto mb-4 ${error ? 'text-rose-600' : 'text-slate-400'}`} size={38} />
      <h2 className="text-2xl font-black uppercase text-slate-950">{title}</h2>
      <p className="mt-3 text-sm font-bold leading-relaxed text-slate-500">{description}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white hover:bg-slate-800">Спробувати ще раз</button>}
    </div>
  </div>
);

const SupplierTable = ({ items = [], empty }) => (
  items.length ? (
    <div className="overflow-hidden rounded-[26px] border border-slate-200">
      <div className="hidden grid-cols-[minmax(180px,1.2fr)_120px_120px_120px_100px] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 lg:grid">
        <span>Постачальник</span><span className="text-right">Продаж</span><span className="text-right">Закупка</span><span className="text-right">Прибуток</span><span className="text-right">Маржа</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item, idx) => <SupplierTableRow key={`${item.name || idx}`} item={item} />)}
      </div>
    </div>
  ) : <EmptyState title={empty} />
);

const SupplierTableRow = ({ item }) => (
  <div className="grid grid-cols-1 gap-3 bg-white px-4 py-4 lg:grid-cols-[minmax(180px,1.2fr)_120px_120px_120px_100px] lg:items-center">
    <div className="min-w-0">
      <p className="truncate text-sm font-black text-slate-950">{item.name || 'Без постачальника'}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-400">{item.parts_count || 0} позицій · {item.visits_count || 0} замовл.{item.variants_count ? ` · складів: ${item.variants_count}` : ''}</p>
    </div>
    <TableMoney value={item.revenue} />
    <TableMoney value={item.cost} muted />
    <TableMoney value={item.profit} good />
    <div className="text-left lg:text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${Number(item.margin_percent || 0) < 15 ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>{percent(item.margin_percent)}</span></div>
  </div>
);

const TableMoney = ({ value, good, muted }) => <p className={`text-sm font-black lg:text-right ${good ? 'text-emerald-600' : muted ? 'text-slate-500' : 'text-slate-950'}`}>{money(value)} ₴</p>;

const ProductRow = ({ item, showProfit = false }) => (
  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black text-slate-800 leading-snug mb-2 break-words">{item.name || 'Деталь'}</p>
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="text-[9px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-lg">{item.brand || 'Без бренду'}</span>
        {item.article && <CopyButton value={item.article} label={item.article} copiedLabel="Скопійовано" title="Копіювати артикул" compact />}
        <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-200 px-2 py-1 rounded-lg">{decimalMoney(item.quantity)} шт</span>
      </div>
    </div>
    <div className="text-right shrink-0"><p className="text-lg font-black text-slate-900">{money(item.revenue)} ₴</p><p className="text-[10px] font-black text-emerald-600">+{money(showProfit ? item.profit : item.profit)} ₴</p></div>
  </div>
);

const ServiceRow = ({ item }) => (
  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.name}</p><p className="text-[10px] font-bold text-slate-400">{decimalMoney(item.quantity)} шт · майстрам {money(item.commission_total)} ₴</p></div>
    <div className="text-right shrink-0"><p className="text-lg font-black text-slate-900">{money(item.revenue)} ₴</p><p className="text-[10px] font-black text-emerald-600">після зарпл. {money(item.profit_after_commission)} ₴</p></div>
  </div>
);

const SupplierRow = ({ item, compact }) => (
  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0">
      <p className="text-sm font-black text-slate-900 truncate">{item.name || 'Без постачальника'}</p>
      <p className="text-[10px] font-bold text-slate-400 mt-1">{item.parts_count || 0} позицій · {item.visits_count || 0} замовл. · маржа {percent(item.margin_percent)}{item.variants_count ? ` · складів: ${item.variants_count}` : ''}</p>
      {!compact && <p className="text-[10px] font-bold text-slate-500 mt-1">Закупка {money(item.cost)} ₴ · прибуток {money(item.profit)} ₴</p>}
    </div>
    <div className="text-right shrink-0"><p className="text-lg font-black text-slate-900">{money(item.revenue)} ₴</p><p className="text-[10px] font-black text-emerald-600">+{money(item.profit)} ₴</p></div>
  </div>
);

const ClientRow = ({ item }) => (
  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.client || 'Клієнт'}</p><p className="text-[10px] font-bold text-slate-400">{item.phone || 'без телефону'} · {item.orders_count || 0} зам.</p>{Number(item.debt || 0) > 0 && <p className="text-[10px] font-black text-red-500 mt-1">борг {money(item.debt)} ₴</p>}</div>
    <p className="text-lg font-black text-slate-900 shrink-0">{money(item.revenue)} ₴</p>
  </div>
);

const DebtRow = ({ item }) => (
  <div className="flex justify-between items-start bg-red-50 p-4 rounded-2xl border border-red-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.client || 'Клієнт'}</p><p className="text-[10px] font-bold text-slate-400">{item.phone || ''} · {item.plate || ''}</p></div>
    <p className="text-lg font-black text-red-600 shrink-0">{money(item.amount)} ₴</p>
  </div>
);

const LowMarginRow = ({ item }) => (
  <div className="flex justify-between items-start bg-orange-50 p-4 rounded-2xl border border-orange-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.name || item.article}</p><p className="text-[10px] font-bold text-slate-500">{item.brand || ''} {item.article || ''}</p></div>
    <div className="text-right shrink-0"><p className="text-lg font-black text-orange-600">{percent(item.margin_percent)}</p><p className="text-[10px] font-bold text-slate-500">+{money(item.profit)} ₴</p></div>
  </div>
);

const DeadStockRow = ({ item }) => (
  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 break-words">{item.name || item.article}</p><p className="text-[10px] font-bold text-slate-400">{item.brand || ''} {item.article || ''} · {item.quantity || 0} шт</p></div>
    <div className="text-right shrink-0"><p className="text-sm font-black text-slate-900">{money(item.buy_value)} ₴</p><p className="text-[10px] font-bold text-slate-400">закупка</p></div>
  </div>
);

const WorkPostRow = ({ item }) => (
  <div className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.name}</p><p className="text-[10px] font-bold text-slate-400">{item.completed_count || 0} закрито · {item.active_count || 0} активні</p></div>
    <div className="text-right shrink-0"><p className="text-lg font-black text-slate-900">{money(item.revenue)} ₴</p><p className="text-[10px] font-black text-emerald-600">{money(item.net_profit)} ₴ чистими</p></div>
  </div>
);

const ExpenseCategoryRow = ({ item }) => (
  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 gap-3">
    <div><p className="text-sm font-black text-slate-800">{item.label || item.category}</p><p className="text-[10px] font-bold text-slate-400">{item.count || 0} витрат · {percent(item.share_percent)} від усіх</p></div>
    <p className="text-lg font-black text-rose-600 shrink-0">{money(item.total)} ₴</p>
  </div>
);

const ExpenseItemRow = ({ item }) => (
  <div className="flex justify-between items-start bg-white p-4 rounded-2xl border border-slate-100 gap-3">
    <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{item.title}</p><p className="text-[10px] font-bold text-slate-400">{item.date || ''} · {item.category_label || ''}</p>{item.comment && <p className="text-[10px] font-semibold text-slate-500 mt-1 break-words">{item.comment}</p>}</div>
    <p className="text-lg font-black text-rose-600 shrink-0">{money(item.amount)} ₴</p>
  </div>
);

const MechanicsSection = ({ items, expandedId, onToggle }) => (
  <div id="mechanics-section" className="scroll-mt-28 mb-6">
    <Panel title="Майстри" icon={<Users size={17} className="text-purple-600" />} subtitle="Заробіток по кожному майстру: роботи, відсоток від запчастин і прихована історія по датах.">
      <div className="space-y-4">
        {items.map((item) => {
          const id = item.id || item.employee_id || item.name;
          const open = expandedId === id;
          return <MechanicCard key={id} item={item} open={open} onToggle={() => onToggle(id)} />;
        })}
      </div>
    </Panel>
  </div>
);

const MechanicCard = ({ item, open, onToggle }) => (
  <div className="bg-slate-50 border border-slate-100 rounded-[24px] overflow-hidden">
    <button onClick={onToggle} className="w-full p-4 md:p-5 flex items-start justify-between gap-4 text-left hover:bg-slate-100/70 transition">
      <div className="min-w-0"><p className="text-base font-black text-slate-900 truncate">{item.name}</p><p className="text-[10px] font-black uppercase text-slate-400 mt-1">{salarySchemeLabel(item.salary_scheme)} · {payoutLabel(item.payout_period)} · роботи {percent(item.commission_percent)} · запчастини {percent(item.parts_commission_percent)}</p></div>
      <div className="flex items-center gap-4 shrink-0"><div className="text-right"><p className="text-xl font-black text-slate-900">{money(item.commission_total)} ₴</p><p className="text-[10px] font-black text-slate-400">{item.history_count || 0} записів</p></div>{open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
    </button>
    {open && <MechanicHistory item={item} />}
  </div>
);

const MechanicHistory = ({ item }) => (
  <div className="px-4 md:px-5 pb-5 space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <SmallStat label="З робіт" value={`${money(item.service_commission)} ₴`} icon={<Wrench size={16} />} />
      <SmallStat label="Із запчастин" value={`${money(item.parts_commission)} ₴`} icon={<Package size={16} />} />
      <SmallStat label="Сума робіт" value={`${money(item.services_revenue)} ₴`} icon={<Wallet size={16} />} />
      <SmallStat label="Маржа запчастин" value={`${money(item.parts_profit)} ₴`} icon={<TrendingUp size={16} />} />
    </div>
    {listOf(item.history_by_date).length ? listOf(item.history_by_date).map((day) => <MechanicDay key={day.date} day={day} />) : <EmptyState title="Історії по майстру ще немає" />}
  </div>
);

const MechanicDay = ({ day }) => (
  <div className="bg-white border border-slate-100 rounded-[22px] p-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3"><p className="font-black text-slate-900">{day.label}</p><p className="text-xs font-black text-purple-600">{money(day.commission_total)} ₴ · {day.visits_count} віз.</p></div>
    <div className="space-y-3">{listOf(day.items).map((visit) => <MechanicVisitDetail key={`${visit.visit_id}-${visit.created_at}`} visit={visit} />)}</div>
  </div>
);

const MechanicVisitDetail = ({ visit }) => (
  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
    <div className="flex flex-col sm:flex-row sm:justify-between gap-2"><div><p className="font-black text-sm text-slate-900">Візит #{visit.visit_id} · {visit.plate || 'Авто'}</p><p className="text-[10px] font-bold text-slate-400">{visit.client || 'Клієнт'} · {visit.work_post || 'Без поста'}</p></div><p className="font-black text-emerald-600">{money(visit.commission_total)} ₴</p></div>
    {listOf(visit.services).length > 0 && <div className="mt-3"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Роботи</p>{listOf(visit.services).map((svc, idx) => <div key={idx} className="flex justify-between text-xs py-1"><span className="font-bold text-slate-600">{svc.name}</span><span className="font-black text-slate-900">{money(svc.commission_amount)} ₴</span></div>)}</div>}
    {listOf(visit.parts).length > 0 && <div className="mt-3"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">Запчастини, з яких накапало</p>{listOf(visit.parts).map((part, idx) => <div key={idx} className="flex justify-between text-xs py-1 gap-3"><span className="font-bold text-slate-600 truncate">{part.name} {part.article ? `· ${part.article}` : ''}</span><span className="font-black text-emerald-600 shrink-0">{money(part.commission_amount)} ₴</span></div>)}</div>}
  </div>
);

const ExpenseModal = ({ data, setData, saving, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/65 px-3 py-5 backdrop-blur-sm md:px-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl overflow-hidden rounded-[34px] border border-white/60 bg-white shadow-2xl">
      <div className="bg-gradient-to-br from-slate-950 via-rose-700 to-orange-500 px-5 py-6 text-white md:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100">Операційні витрати</p>
            <h2 className="mt-2 text-2xl font-black uppercase italic leading-tight md:text-3xl">Нова витрата</h2>
            <p className="mt-2 text-sm font-bold text-rose-100">Оренда, доставка, реклама, податки, зарплата адміністрації та інші витрати бізнесу.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white hover:bg-white/25"><X size={20} /></button>
        </div>
      </div>

      <div className="space-y-4 p-5 md:p-7">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Дата"><input type="date" value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} className="input" /></Field>
          <Field label="Категорія"><select value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })} className="input">{EXPENSE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        </div>
        <Field label="Назва витрати"><input required value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="Наприклад: Оренда боксу, реклама, доставка" className="input" /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Сума"><input required type="number" min="0" step="0.01" value={data.amount} onChange={(e) => setData({ ...data, amount: e.target.value })} placeholder="0.00" className="input" /></Field>
          <Field label="Метод оплати"><select value={data.payment_method} onChange={(e) => setData({ ...data, payment_method: e.target.value })} className="input">{PAYMENT_METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        </div>
        <Field label="Коментар"><textarea value={data.comment} onChange={(e) => setData({ ...data, comment: e.target.value })} placeholder="Деталі витрати" className="input h-24" /></Field>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={Boolean(data.is_recurring)} onChange={(e) => setData({ ...data, is_recurring: e.target.checked })} />
          Постійна витрата
        </label>
        {data.is_recurring && <Field label="Період повтору"><select value={data.recurring_period} onChange={(e) => setData({ ...data, recurring_period: e.target.value })} className="input"><option value="monthly">Щомісяця</option><option value="weekly">Щотижня</option><option value="daily">Щодня</option><option value="none">Без повтору</option></select></Field>}
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 md:px-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">Скасувати</button>
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-black uppercase text-white hover:bg-rose-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Зберегти витрату</button>
      </div>
    </form>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-black text-slate-800">{label}</span>
    {children}
  </label>
);

export default Analytics;
