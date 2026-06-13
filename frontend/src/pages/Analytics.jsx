import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  Package,
  Wrench,
  Wallet,
  BarChart,
  Loader2,
  Users,
  Building2,
  AlertTriangle,
  Clock3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CopyButton from '../components/common/CopyButton';

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

const Analytics = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeFilter, setTimeFilter] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedMechanicId, setExpandedMechanicId] = useState(null);

  const token = localStorage.getItem('access_token');

  useEffect(() => {
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

    fetchData();
  }, [token, navigate, timeFilter, dateFrom, dateTo]);

  const summary = data?.summary || {};
  const chart = listOf(data?.chart);
  const products = data?.products || {};
  const services = data?.services || {};
  const clients = data?.clients || {};
  const debts = data?.debts || {};
  const mechanics = data?.mechanics || {};
  const workPosts = data?.work_posts || {};
  const isStore = data?.business_type === 'store' || data?.company?.business_type === 'store';
  const mechanicItems = listOf(mechanics.items).filter((item) => item && (item.id || item.employee_id || item.name));
  const hasMechanics = !isStore && mechanicItems.length > 0;

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

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden pb-24">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 md:mb-8 gap-4 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 flex items-center gap-2">
            <BarChart className="text-blue-600" /> Аналітика
          </h1>
          <p className="text-slate-500 font-bold text-xs md:text-sm mt-1">
            Backend-аналітика: каса, прибуток, борги, майстри, пости і товари
          </p>
          {data?.period?.label && (
            <p className="text-[10px] font-black uppercase text-blue-600 mt-2 tracking-widest">
              Період: {data.period.label}{data.period.date_from ? ` • ${data.period.date_from} — ${data.period.date_to}` : ''}
            </p>
          )}
        </div>

        <div className="w-full xl:w-auto space-y-2">
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full xl:w-auto overflow-x-auto">
            {PERIODS.map((periodItem) => (
              <button
                key={periodItem.key}
                onClick={() => setTimeFilter(periodItem.key)}
                className={`flex-1 xl:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${
                  timeFilter === periodItem.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {periodItem.label}
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

      {hasMechanics && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => document.getElementById('mechanics-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="bg-purple-600 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase shadow-lg shadow-purple-100 flex items-center gap-2"
          >
            <Users size={16} /> Майстри
          </button>
          <button
            onClick={() => document.getElementById('overview-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="bg-white border border-slate-200 text-slate-700 rounded-2xl px-5 py-3 text-xs font-black uppercase flex items-center gap-2"
          >
            <BarChart size={16} /> Огляд
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 text-red-700 rounded-3xl p-4 flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-black text-sm uppercase">Помилка аналітики</p>
            <p className="text-sm font-semibold mt-1">{error}</p>
          </div>
        </div>
      )}

      <div id="overview-section" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 md:gap-5 mb-6 md:mb-8 scroll-mt-24">
        <MetricCard icon={<Wallet size={15} />} label="Виручка" value={`${money(summary.revenue)} ₴`} tone="blue" />
        <MetricCard icon={<TrendingUp size={15} />} label="Валовий прибуток" value={`${money(summary.gross_profit)} ₴`} sub={`Маржа ${percent(summary.margin_percent)}`} tone="emerald" />
        <MetricCard icon={<CheckCircle2 size={15} />} label="Чистий прибуток" value={`${money(summary.net_profit)} ₴`} sub={`Після зарплат ${percent(summary.net_margin_percent)}`} tone="green" />
        <MetricCard icon={<Wrench size={15} />} label="Майстрам" value={`${money(summary.mechanic_commission)} ₴`} tone="purple" />
        <MetricCard icon={<DollarSign size={15} />} label="Борги" value={`${money(summary.debt_total)} ₴`} sub={`${summary.debt_orders_count || 0} зам.`} tone="red" />
        <MetricCard icon={<Activity size={15} />} label={`Закриті ${isStore ? 'замовлення' : 'візити'}`} value={summary.completed_orders_count || 0} sub={`Сер. чек ${money(summary.average_check)} ₴`} tone="orange" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6 md:mb-8">
        <div className="xl:col-span-2 bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <h3 className="font-black uppercase text-slate-800 flex items-center gap-2 text-sm"><Calendar size={16} className="text-blue-500" /> Динаміка</h3>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Виручка</span>
              <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Чистий прибуток</span>
            </div>
          </div>

          {chart.length > 0 ? (
            <div className="h-[280px] md:h-[330px] w-full flex items-end justify-center gap-3 md:gap-5 pt-10 overflow-x-auto">
              {chart.map((item, idx) => {
                const revenueHeight = Math.max((Number(item.revenue || 0) / maxChartValue) * 100, 2);
                const netHeight = Math.max((Number(item.net_profit || 0) / maxChartValue) * 100, 2);
                return (
                  <div key={`${item.date || idx}`} className="min-w-[46px] flex-1 max-w-[80px] flex flex-col items-center group relative h-full justify-end">
                    <div className="absolute -top-10 bg-slate-800 text-white text-[10px] font-black px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {money(item.revenue)} ₴ / {money(item.net_profit)} ₴
                    </div>
                    <div className="w-full h-full flex items-end gap-1 justify-center">
                      <div className="w-1/2 bg-blue-500 rounded-t-lg transition-all duration-500" style={{ height: `${revenueHeight}%` }} />
                      <div className="w-1/2 bg-emerald-500 rounded-t-lg transition-all duration-500" style={{ height: `${netHeight}%` }} />
                    </div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-2 truncate w-full text-center">{item.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<BarChart size={42} />} title="Немає даних за цей період" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <SmallStat label="Активні в роботі" value={summary.active_orders_count || 0} icon={<Clock3 size={16} />} />
          <SmallStat label="Воронка / незакрита сума" value={`${money(summary.pipeline_revenue)} ₴`} icon={<Activity size={16} />} />
          <SmallStat label="Оплачено" value={`${money(summary.paid_total)} ₴`} icon={<CheckCircle2 size={16} />} />
          <SmallStat label="Собівартість запчастин" value={`${money(summary.cost)} ₴`} icon={<Package size={16} />} />
        </div>
      </div>

      {hasMechanics && (
        <MechanicsSection
          items={mechanicItems}
          expandedId={expandedMechanicId}
          onToggle={(id) => setExpandedMechanicId(expandedMechanicId === id ? null : id)}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <ListCard title="Топ запчастин за виручкою" icon={<Package size={16} className="text-amber-500" />} empty="Немає проданих запчастин">
          {listOf(products.top_by_revenue).slice(0, 8).map((part, idx) => <ProductRow key={`${part.article}-${idx}`} item={part} />)}
        </ListCard>

        {!isStore && (
          <ListCard title="Топ робіт" icon={<Wrench size={16} className="text-purple-500" />} empty="Немає виконаних робіт">
            {listOf(services.top_by_revenue).slice(0, 8).map((service, idx) => <ServiceRow key={`${service.name}-${idx}`} item={service} />)}
          </ListCard>
        )}
      </div>

      {!isStore && listOf(workPosts.items).length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <ListCard title="Пости / підйомники" icon={<Building2 size={16} className="text-cyan-500" />} empty="Немає даних по постах">
            {listOf(workPosts.items).slice(0, 10).map((post, idx) => <WorkPostRow key={`${post.id || idx}`} item={post} />)}
          </ListCard>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ListCard title="Топ клієнтів" icon={<Users size={16} className="text-emerald-500" />} empty="Немає клієнтів за період">
          {listOf(clients.top_by_revenue).slice(0, 8).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
        </ListCard>

        <ListCard title="Борги" icon={<AlertTriangle size={16} className="text-red-500" />} empty="Боргів немає">
          {listOf(debts.items).slice(0, 8).map((debt, idx) => <DebtRow key={`${debt.visit_id || idx}`} item={debt} />)}
        </ListCard>

        <ListCard title="Низька маржа" icon={<TrendingUp size={16} className="text-orange-500" />} empty="Позицій з низькою маржею немає">
          {listOf(products.low_margin).slice(0, 8).map((part, idx) => <LowMarginRow key={`${part.article}-${idx}`} item={part} />)}
        </ListCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        <ListCard title="Залежаний склад" icon={<Package size={16} className="text-slate-500" />} empty="Залежаного складу немає або немає залишків">
          {listOf(products.dead_stock).slice(0, 8).map((item, idx) => <DeadStockRow key={`${item.id || idx}`} item={item} />)}
        </ListCard>

        <ListCard title="Сплячі клієнти" icon={<Clock3 size={16} className="text-slate-500" />} empty="Сплячих клієнтів немає">
          {listOf(clients.sleeping).slice(0, 8).map((client, idx) => <ClientRow key={`${client.phone || idx}`} item={client} />)}
        </ListCard>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, sub, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
      <div className={`w-10 h-10 rounded-2xl ${tones[tone] || tones.blue} flex items-center justify-center mb-4`}>{icon}</div>
      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
      <h3 className="text-2xl font-black text-slate-800 leading-tight">{value}</h3>
      {sub && <p className="text-[10px] font-bold text-slate-500 mt-2">{sub}</p>}
    </div>
  );
};

const SmallStat = ({ icon, label, value }) => (
  <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
    <div className="w-11 h-11 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase text-slate-400 truncate">{label}</p>
      <p className="text-xl font-black text-slate-800 truncate">{value}</p>
    </div>
  </div>
);

const ListCard = ({ title, icon, empty, children }) => {
  const count = React.Children.count(children);
  return (
    <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2 text-sm">{icon} {title}</h3>
      <div className="space-y-3">
        {count > 0 ? children : <p className="text-[10px] font-black uppercase text-center text-slate-400 py-6">{empty}</p>}
      </div>
    </div>
  );
};

const EmptyState = ({ icon, title }) => (
  <div className="h-[250px] w-full flex flex-col items-center justify-center text-slate-300">
    <div className="mb-3 opacity-60">{icon}</div>
    <p className="text-xs font-black uppercase tracking-widest">{title}</p>
  </div>
);

const MechanicsSection = ({ items, expandedId, onToggle }) => {
  const totalCommission = items.reduce((sum, item) => sum + Number(item.commission_total || 0), 0);
  const totalPartsCommission = items.reduce((sum, item) => sum + Number(item.parts_commission || 0), 0);
  const totalServiceCommission = items.reduce((sum, item) => sum + Number(item.service_commission || 0), 0);

  return (
    <div id="mechanics-section" className="scroll-mt-24 mb-6 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 bg-gradient-to-r from-purple-700 via-blue-700 to-cyan-600 text-white">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/75 text-[10px] font-black uppercase tracking-widest"><Users size={15}/> Окрема аналітика</div>
            <h2 className="text-2xl md:text-3xl font-black uppercase italic mt-2">Майстри</h2>
            <p className="text-sm font-bold text-white/80 mt-2 max-w-2xl">Заробіток по кожному майстру: роботи, відсоток від запчастин і прихована історія по датах.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
            <MiniTotal label="Всього" value={`${money(totalCommission)} ₴`} />
            <MiniTotal label="Роботи" value={`${money(totalServiceCommission)} ₴`} />
            <MiniTotal label="Запчастини" value={`${money(totalPartsCommission)} ₴`} />
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-3">
        {items.map((item, idx) => {
          const id = item.id || item.employee_id || item.name || idx;
          return <MechanicDetailCard key={id} item={item} expanded={expandedId === id} onToggle={() => onToggle(id)} />;
        })}
      </div>
    </div>
  );
};

const MiniTotal = ({ label, value }) => (
  <div className="bg-white/15 border border-white/20 rounded-2xl p-3 min-w-0">
    <p className="text-[9px] font-black uppercase text-white/70 truncate">{label}</p>
    <p className="text-lg font-black text-white truncate">{value}</p>
  </div>
);

const MechanicDetailCard = ({ item, expanded, onToggle }) => {
  const history = listOf(item.history_by_date);
  return (
    <div className="border border-slate-200 rounded-3xl overflow-hidden bg-slate-50/60">
      <button onClick={onToggle} className="w-full p-4 bg-white hover:bg-slate-50 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={18} className="text-purple-600" /> : <ChevronRight size={18} className="text-slate-400" />}
            <p className="text-sm font-black text-slate-900 truncate">{item.name || 'Майстер'}</p>
          </div>
          <p className="text-[10px] font-black uppercase text-slate-400 mt-1 ml-6">
            {item.services_count || 0} робіт • {item.visits_count || 0} візитів • {salarySchemeLabel(item.salary_scheme)} • виплата {payoutLabel(item.payout_period)}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
          <MechanicPill label="Заробив" value={`${money(item.commission_total)} ₴`} tone="purple" />
          <MechanicPill label="За роботи" value={`${money(item.service_commission)} ₴`} />
          <MechanicPill label="Із запчастин" value={`${money(item.parts_commission)} ₴`} />
          <MechanicPill label="Робіт на суму" value={`${money(item.services_revenue)} ₴`} />
        </div>
      </button>

      {expanded && (
        <div className="p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SmallInfo label="Маржа запчастин, що бралась у розрахунок" value={`${money(item.parts_profit)} ₴`} />
            <SmallInfo label="Середній % нарахування" value={percent(item.average_commission_percent)} />
            <SmallInfo label="Записів в історії" value={item.history_count || 0} />
          </div>

          {history.length > 0 ? history.map((day) => <MechanicDayGroup key={day.date} day={day} />) : (
            <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-black uppercase text-slate-400">По цьому майстру ще немає нарахувань за обраний період</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MechanicPill = ({ label, value, tone }) => (
  <div className={`rounded-2xl p-3 border ${tone === 'purple' ? 'bg-purple-50 border-purple-100 text-purple-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
    <p className="text-[9px] font-black uppercase opacity-60 truncate">{label}</p>
    <p className="text-sm font-black truncate">{value}</p>
  </div>
);

const SmallInfo = ({ label, value }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-3">
    <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
    <p className="text-lg font-black text-slate-800 mt-1">{value}</p>
  </div>
);

const MechanicDayGroup = ({ day }) => (
  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <p className="text-sm font-black text-slate-900">{day.label || day.date}</p>
        <p className="text-[10px] font-black uppercase text-slate-400">{day.visits_count || 0} візитів • роботи {money(day.service_commission)} ₴ • запчастини {money(day.parts_commission)} ₴</p>
      </div>
      <div className="text-lg font-black text-purple-600">{money(day.commission_total)} ₴</div>
    </div>
    <div className="p-3 space-y-3">
      {listOf(day.items).map((item, idx) => <MechanicVisitDetail key={`${item.visit_id}-${idx}`} item={item} />)}
    </div>
  </div>
);

const MechanicVisitDetail = ({ item }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-900">Візит #{item.visit_id} • {item.plate || 'Авто'}</p>
        <p className="text-[10px] font-bold text-slate-500 mt-1">{item.client || 'Клієнт'} • {item.phone || 'без телефону'} • {item.work_post || 'Без поста'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-purple-600">{money(item.commission_total)} ₴</p>
        <p className="text-[10px] font-bold text-slate-400">роботи {money(item.service_commission)} ₴ / запчастини {money(item.parts_commission)} ₴</p>
      </div>
    </div>

    {listOf(item.services).length > 0 && (
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">За які роботи нараховано</p>
        <div className="space-y-2">
          {listOf(item.services).map((service, idx) => (
            <div key={`${service.name}-${idx}`} className="flex justify-between gap-3 bg-white rounded-xl border border-slate-100 p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{service.name}</p>
                <p className="text-[9px] font-black uppercase text-slate-400">{decimalMoney(service.quantity)} × {money(service.revenue)} ₴ • {percent(service.commission_percent)}</p>
              </div>
              <p className="text-xs font-black text-purple-600 shrink-0">{money(service.commission_amount)} ₴</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {listOf(item.parts).length > 0 && (
      <div className="mt-4">
        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">З яких запчастин накапало</p>
        <div className="space-y-2">
          {listOf(item.parts).map((part, idx) => (
            <div key={`${part.article}-${idx}`} className="flex justify-between gap-3 bg-white rounded-xl border border-slate-100 p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{part.name || 'Запчастина'}</p>
                <p className="text-[9px] font-black uppercase text-slate-400">{part.brand || ''} {part.article || ''} • маржа {money(part.allocated_profit)} ₴ • {percent(part.commission_percent)}</p>
              </div>
              <p className="text-xs font-black text-purple-600 shrink-0">{money(part.commission_amount)} ₴</p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ProductRow = ({ item }) => (
  <div className="flex justify-between items-start bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-slate-700 leading-snug mb-1.5 break-words">{item.name || 'Деталь'}</p>
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="text-[9px] font-black uppercase text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{item.brand || 'Без бренду'}</span>
        {item.article ? <CopyButton value={item.article} label={item.article} copiedLabel="Скопійовано" title="Копіювати артикул" compact /> : null}
        <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">{decimalMoney(item.quantity)} шт</span>
      </div>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-slate-800">{money(item.revenue)} ₴</div>
      <div className="text-[10px] font-bold text-emerald-600">+{money(item.profit)} ₴</div>
    </div>
  </div>
);

const ServiceRow = ({ item }) => (
  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
    <div className="overflow-hidden pr-2 flex-1">
      <p className="text-xs font-bold text-slate-700 truncate">{item.name || 'Робота'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{decimalMoney(item.quantity)} разів • майстрам {money(item.commission_total)} ₴</p>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-slate-800">{money(item.revenue)} ₴</div>
      <div className="text-[10px] font-bold text-emerald-600">{money(item.profit_after_commission)} ₴ після ЗП</div>
    </div>
  </div>
);

const WorkPostRow = ({ item }) => (
  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-800 truncate">{item.name || 'Без поста'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{item.completed_count || 0} закрито • {item.active_count || 0} активні</p>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-slate-800">{money(item.revenue)} ₴</div>
      <div className="text-[10px] font-bold text-emerald-600">{money(item.net_profit)} ₴ чистими</div>
    </div>
  </div>
);

const ClientRow = ({ item }) => (
  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-800 truncate">{item.client || 'Клієнт'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{item.phone || 'без телефону'} • {item.orders_count || 0} зам.</p>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-slate-800">{money(item.revenue)} ₴</div>
      {Number(item.debt || 0) > 0 && <div className="text-[10px] font-bold text-red-600">борг {money(item.debt)} ₴</div>}
    </div>
  </div>
);

const DebtRow = ({ item }) => (
  <div className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100 gap-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-800 truncate">{item.client || 'Клієнт'} • {item.plate || 'Авто'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{item.phone || 'без телефону'} • зам. #{item.visit_id}</p>
    </div>
    <div className="text-sm font-black text-red-600 shrink-0">{money(item.amount)} ₴</div>
  </div>
);

const LowMarginRow = ({ item }) => (
  <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 gap-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-800 truncate">{item.name || 'Товар'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{item.brand || ''} {item.article || ''}</p>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-orange-600">{percent(item.margin_percent)}</div>
      <div className="text-[10px] font-bold text-slate-500">{money(item.profit)} ₴</div>
    </div>
  </div>
);

const DeadStockRow = ({ item }) => (
  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-3">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black text-slate-800 truncate">{item.name || 'Товар'}</p>
      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{item.brand || ''} {item.article || ''} • {item.quantity || 0} шт</p>
    </div>
    <div className="text-right shrink-0">
      <div className="text-sm font-black text-slate-800">{money(item.sell_value)} ₴</div>
      <div className="text-[10px] font-bold text-slate-400">без продажів {item.days_without_sales || 60} дн.</div>
    </div>
  </div>
);

export default Analytics;
