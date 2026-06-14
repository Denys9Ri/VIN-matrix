import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
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

const API_BASE = 'http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io';

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

  const token = localStorage.getItem('access_token');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ period: timeFilter });
      if (timeFilter === 'custom') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      const res = await axios.get(`${API_BASE}/api/analytics/summary/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  useEffect(() => { fetchData(); }, [token, navigate, timeFilter, dateFrom, dateTo]);

  const handleAddExpense = async (event) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount || 0);
    if (!expenseForm.title.trim()) return toast.warning('Вкажіть назву витрати.');
    if (!amount || amount <= 0) return toast.warning('Вкажіть суму витрати.');

    setExpenseSaving(true);
    try {
      await axios.post(`${API_BASE}/api/expenses/`, {
        ...expenseForm,
        title: expenseForm.title.trim(),
        amount,
      }, { headers: { Authorization: `Bearer ${token}` } });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen font-black italic text-blue-600">
        <Loader2 className="animate-spin mr-2" /> ЗАВАНТАЖЕННЯ АНАЛІТИКИ...
      </div>
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

const Header = ({ title, subtitle, period, timeFilter, setTimeFilter, dateFrom, setDateFrom, dateTo, setDateTo }) => (
  <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm px-5 md:px-7 py-5 mb-5">
    <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-4xl font-black uppercase italic text-slate-900 flex items-center gap-3">
          <BarChart className="text-blue-600 shrink-0" /> Аналітика
        </h1>
        <p className="text-slate-500 font-bold text-sm mt-2 max-w-3xl">{subtitle}</p>
        {period?.label && (
          <p className="text-[10px] md:text-xs font-black uppercase text-blue-600 mt-3 tracking-widest">
            Період: {period.label}{period.date_from ? ` • ${period.date_from} — ${period.date_to}` : ''}
          </p>
        )}
      </div>
      <div className="w-full 2xl:w-auto space-y-2">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full 2xl:w-auto overflow-x-auto">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTimeFilter(item.key)}
              className={`flex-1 2xl:flex-none px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${timeFilter === item.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {timeFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700" />
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

const SuppliersSection = ({ suppliers, supplierItems }) => (
  <div id="suppliers-section" className="scroll-mt-28 grid grid-cols-1 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-6 mb-6">
    <Panel title="Оборот по постачальниках" icon={<Package size={16} className="text-amber-500" />} subtitle={`${supplierItems.length || 0} постачальників · продаж ${money(suppliers.summary?.revenue)} ₴ · прибуток ${money(suppliers.summary?.profit)} ₴`}>
      {supplierItems.length ? supplierItems.slice(0, 14).map((supplier, idx) => <SupplierRow key={`${supplier.name || idx}`} item={supplier} />) : <EmptyState title="Немає даних по постачальниках" />}
    </Panel>
    <Panel title="Постачальники з низькою маржею" icon={<AlertTriangle size={16} className="text-orange-500" />}>
      {listOf(suppliers.low_margin).length ? listOf(suppliers.low_margin).slice(0, 12).map((supplier, idx) => <SupplierRow key={`${supplier.name || idx}`} item={supplier} compact />) : <EmptyState title="Низької маржі по постачальниках немає" />}
    </Panel>
  </div>
);

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
  <Panel title="Динаміка" icon={<Calendar size={16} className="text-blue-500" />} subtitle="Синій — виручка, зелений — чистий прибуток.">
    {chart.length > 0 ? (
      <div className="h-[320px] w-full flex items-end justify-center gap-3 md:gap-5 pt-10 overflow-x-auto">
        {chart.map((item, idx) => {
          const revenueHeight = Math.max((Number(item.revenue || 0) / maxChartValue) * 100, 2);
          const netHeight = Math.max((Number(item.net_profit || 0) / maxChartValue) * 100, 2);
          return (
            <div key={`${item.date || idx}`} className="min-w-[46px] flex-1 max-w-[85px] flex flex-col items-center group relative h-full justify-end">
              <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-black px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {money(item.revenue)} ₴ / чистий {money(item.net_profit)} ₴
              </div>
              <div className="w-full h-full flex items-end gap-1.5 justify-center">
                <div className="w-1/2 bg-blue-500 rounded-t-xl transition-all duration-500" style={{ height: `${revenueHeight}%` }} />
                <div className="w-1/2 bg-emerald-500 rounded-t-xl transition-all duration-500" style={{ height: `${netHeight}%` }} />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-2 truncate w-full text-center">{item.label}</span>
            </div>
          );
        })}
      </div>
    ) : <EmptyState icon={<BarChart size={42} />} title="Немає даних за цей період" />}
  </Panel>
);

const MetricCard = ({ icon, label, value, sub, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white p-4 rounded-[26px] border border-slate-200 shadow-sm min-h-[148px] flex flex-col justify-between">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tones[tone] || tones.blue}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 leading-tight break-words">{value}</h3>
        {sub && <p className="text-[10px] font-bold text-slate-500 mt-2">{sub}</p>}
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, icon, children, action }) => (
  <div className="bg-white p-5 md:p-6 rounded-[30px] border border-slate-200 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h3 className="font-black uppercase text-slate-900 flex items-center gap-2 text-sm">{icon}{title}</h3>
        {subtitle && <p className="text-xs font-semibold text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const ListCard = ({ title, icon, empty, children, inner = false }) => (
  <div className={`${inner ? 'bg-slate-50/70' : 'bg-white'} p-5 md:p-6 rounded-[30px] border border-slate-200 shadow-sm`}>
    <h3 className="font-black uppercase text-slate-900 mb-4 flex items-center gap-2 text-sm">{icon}{title}</h3>
    <div className="space-y-3">
      {React.Children.count(children) > 0 ? children : <EmptyState title={empty} />}
    </div>
  </div>
);

const EmptyState = ({ icon, title }) => (
  <div className="min-h-[130px] flex flex-col items-center justify-center text-slate-300 text-center p-6">
    {icon || <BarChart size={34} className="mb-2 opacity-50" />}
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
  </div>
);

const SmallStat = ({ label, value, icon }) => (
  <div className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-sm flex items-center gap-4 min-h-[92px]">
    <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">{icon}</div>
    <div className="min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 truncate">{value}</p></div>
  </div>
);

const BigMiniCard = ({ title, value, subtitle, danger }) => (
  <div className="bg-white border border-slate-200 rounded-[26px] p-5 shadow-sm">
    <p className={`text-[10px] font-black uppercase ${danger ? 'text-red-500' : 'text-slate-400'}`}>{title}</p>
    <p className="text-3xl font-black text-slate-900 mt-2">{value}</p>
    <p className="text-xs font-bold text-slate-500 mt-2">{subtitle}</p>
  </div>
);

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
  <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <form onSubmit={onSubmit} className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-black uppercase italic text-slate-900">Нова витрата</h2><button type="button" onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button></div>
      <div className="space-y-4">
        <input type="date" value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} className="input" />
        <select value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })} className="input">{EXPENSE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <input required value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="Назва витрати" className="input" />
        <input required type="number" min="0" step="0.01" value={data.amount} onChange={(e) => setData({ ...data, amount: e.target.value })} placeholder="Сума" className="input" />
        <select value={data.payment_method} onChange={(e) => setData({ ...data, payment_method: e.target.value })} className="input">{PAYMENT_METHODS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <textarea value={data.comment} onChange={(e) => setData({ ...data, comment: e.target.value })} placeholder="Коментар" className="input h-24" />
        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl font-bold text-sm"><input type="checkbox" checked={Boolean(data.is_recurring)} onChange={(e) => setData({ ...data, is_recurring: e.target.checked })} /> Постійна витрата</label>
        {data.is_recurring && <select value={data.recurring_period} onChange={(e) => setData({ ...data, recurring_period: e.target.value })} className="input"><option value="monthly">Щомісяця</option><option value="weekly">Щотижня</option><option value="daily">Щодня</option><option value="none">Без повтору</option></select>}
        <button type="submit" disabled={saving} className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black uppercase flex items-center justify-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Зберегти витрату</button>
      </div>
    </form>
  </div>
);

export default Analytics;
