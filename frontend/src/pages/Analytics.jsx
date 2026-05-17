import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { TrendingUp, DollarSign, Activity, Calendar, Package, Wrench, Wallet, ArrowUpRight, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Analytics = () => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  
  // Фільтр часу: 'today', 'week', 'month', 'all'
  const [timeFilter, setTimeFilter] = useState('week');

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [visitsRes, settingsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/visits/?history=true`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        // Для фінансів беремо тільки успішно закриті візити/замовлення
        const completedVisits = visitsRes.data.filter(v => v.status === 'DONE' || v.status === 'COMPLETED');
        setVisits(completedVisits);
        setCompanyInfo(settingsRes.data.company);
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  // Обчислення статистики на основі обраного фільтру
  const stats = useMemo(() => {
    const now = new Date();
    
    // Фільтруємо по даті
    const filteredVisits = visits.filter(v => {
      const vDate = new Date(v.updated_at || v.created_at);
      if (timeFilter === 'today') {
        return vDate.toDateString() === now.toDateString();
      }
      if (timeFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return vDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
      }
      return true; // all
    });

    let totalRevenue = 0;
    let totalCost = 0;
    const partsSales = {};
    const servicesSales = {};
    const chartDataMap = {};

    filteredVisits.forEach(visit => {
      const vDate = new Date(visit.updated_at || visit.created_at);
      // Формуємо ключ для графіка (День або Місяць)
      const dateKey = timeFilter === 'all' 
        ? vDate.toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' })
        : vDate.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });

      if (!chartDataMap[dateKey]) chartDataMap[dateKey] = 0;

      let visitRevenue = 0;
      let visitCost = 0;

      // Рахуємо послуги
      visit.services?.forEach(s => {
        const price = parseFloat(s.price) || 0;
        visitRevenue += price;
        
        if (!servicesSales[s.name]) servicesSales[s.name] = { count: 0, revenue: 0 };
        servicesSales[s.name].count += 1;
        servicesSales[s.name].revenue += price;
      });

      // Рахуємо запчастини
      visit.parts?.forEach(p => {
        const sellPrice = parseFloat(p.sell_price) || 0;
        const buyPrice = parseFloat(p.buy_price) || 0;
        
        visitRevenue += sellPrice;
        visitCost += buyPrice;

        const partKey = `${p.name} (${p.brand})`;
        if (!partsSales[partKey]) partsSales[partKey] = { count: 0, revenue: 0 };
        partsSales[partKey].count += 1;
        partsSales[partKey].revenue += sellPrice;
      });

      totalRevenue += visitRevenue;
      totalCost += visitCost;
      chartDataMap[dateKey] += visitRevenue;
    });

    const netProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const averageCheck = filteredVisits.length > 0 ? (totalRevenue / filteredVisits.length).toFixed(0) : 0;

    // Сортуємо дані для графіка за часом
    const chartData = Object.keys(chartDataMap).map(key => ({
      label: key,
      value: chartDataMap[key]
    }));

    // Топ запчастин
    const topParts = Object.entries(partsSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Топ послуг
    const topServices = Object.entries(servicesSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { totalRevenue, netProfit, marginPercent, averageCheck, totalOrders: filteredVisits.length, chartData, topParts, topServices };
  }, [visits, timeFilter]);

  const maxChartValue = Math.max(...stats.chartData.map(d => d.value), 1);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">VIN-MATRIX АНАЛІТИКА...</div>;

  const isStore = companyInfo?.business_type === 'store';

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-600"/> Аналітика</h1>
          <p className="text-slate-500 font-bold text-xs md:text-sm mt-1">Фінансові показники вашого бізнесу</p>
        </div>
        
        {/* Фільтр Часу */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto overflow-x-auto">
          <button onClick={() => setTimeFilter('today')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${timeFilter === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Сьогодні</button>
          <button onClick={() => setTimeFilter('week')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${timeFilter === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Тиждень</button>
          <button onClick={() => setTimeFilter('month')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${timeFilter === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Місяць</button>
          <button onClick={() => setTimeFilter('all')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap ${timeFilter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>За весь час</button>
        </div>
      </div>

      {/* Головні Картки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Wallet size={14}/> Загальна каса</p>
            <h3 className="text-2xl md:text-3xl font-black text-slate-800">{stats.totalRevenue.toLocaleString()} <span className="text-lg md:text-xl text-slate-500">₴</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-500"/> Чистий прибуток</p>
            <h3 className="text-2xl md:text-3xl font-black text-emerald-600">{stats.netProfit.toLocaleString()} <span className="text-lg md:text-xl text-emerald-400">₴</span></h3>
            <p className="text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-1 rounded-md">Маржа: {stats.marginPercent}%</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><DollarSign size={14}/> Середній чек</p>
            <h3 className="text-2xl md:text-3xl font-black text-slate-800">{stats.averageCheck.toLocaleString()} <span className="text-lg md:text-xl text-slate-500">₴</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
          <div className="relative z-10">
            <p className="text-[10px] md:text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Activity size={14}/> Успішні {isStore ? 'замовлення' : 'візити'}</p>
            <h3 className="text-2xl md:text-3xl font-black text-slate-800">{stats.totalOrders}</h3>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ЧИСТИЙ ТЕЙЛВІНД ГРАФІК (Без npm бібліотек) */}
        <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-black uppercase text-slate-800 mb-6 flex items-center gap-2 text-sm"><Calendar size={16} className="text-blue-500"/> Динаміка доходу</h3>
          
          {stats.chartData.length > 0 ? (
            <div className="flex-1 min-h-[250px] md:min-h-[300px] flex items-end gap-2 md:gap-4 pt-10">
              {stats.chartData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  
                  {/* Tooltip при наведенні */}
                  <div className="absolute -top-10 bg-slate-800 text-white text-[10px] font-black uppercase px-2 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none mb-2">
                    {data.value.toLocaleString()} ₴
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                  </div>

                  {/* Стовпчик графіка */}
                  <div 
                    className="w-full bg-blue-100 group-hover:bg-blue-200 rounded-t-lg transition-all duration-500 ease-out relative overflow-hidden flex items-end justify-center pb-2"
                    style={{ height: `${Math.max((data.value / maxChartValue) * 100, 2)}%` }}
                  >
                    <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{ height: '100%' }}></div>
                  </div>

                  {/* Підпис знизу */}
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-2 truncate w-full text-center">{data.label}</span>
                </div>
              ))}
            </div>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-300 min-h-[250px]">
                <BarChart3 size={48} className="mb-3 opacity-50"/>
                <p className="text-xs font-black uppercase tracking-widest">Немає даних за цей період</p>
             </div>
          )}
        </div>

        {/* ТОП ПРОДАЖІВ */}
        <div className="space-y-6">
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2 text-sm"><Package size={16} className="text-amber-500"/> Топ запчастин</h3>
            <div className="space-y-3">
              {stats.topParts.length > 0 ? stats.topParts.map((part, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="overflow-hidden pr-2 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{part.name}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{part.count} шт</p>
                  </div>
                  <div className="text-sm font-black text-slate-800 shrink-0">{part.revenue.toLocaleString()} ₴</div>
                </div>
              )) : (
                <p className="text-[10px] font-black uppercase text-center text-slate-400 py-4">Немає проданих запчастин</p>
              )}
            </div>
          </div>

          {!isStore && (
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2 text-sm"><Wrench size={16} className="text-purple-500"/> Топ послуг</h3>
              <div className="space-y-3">
                {stats.topServices.length > 0 ? stats.topServices.map((service, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="overflow-hidden pr-2 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{service.name}</p>
                      <p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{service.count} разів</p>
                    </div>
                    <div className="text-sm font-black text-slate-800 shrink-0">{service.revenue.toLocaleString()} ₴</div>
                  </div>
                )) : (
                  <p className="text-[10px] font-black uppercase text-center text-slate-400 py-4">Немає виконаних послуг</p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Analytics;
