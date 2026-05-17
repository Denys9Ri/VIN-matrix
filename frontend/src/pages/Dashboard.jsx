import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, Plus, CalendarDays, AlertCircle, 
  Wallet, Search, CarFront, Package, ArrowRight, 
  Settings2, X, Clock, CheckCircle2, DollarSign, Wrench, Loader2
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [profile, setProfile] = useState(null);

  // СТАН ВІДЖЕТІВ (Збереження в localStorage)
  const defaultWidgets = {
    welcome: true,
    quickActions: true,
    todayTasks: true,
    financialPulse: true,
    alerts: true
  };
  
  const [activeWidgets, setActiveWidgets] = useState(() => {
    const saved = localStorage.getItem('vinMatrixDashboardWidgets');
    return saved ? JSON.parse(saved) : defaultWidgets;
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [visitsRes, settingsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setVisits(visitsRes.data || []);
        setCompanyInfo(settingsRes.data.company);
        setProfile(settingsRes.data);
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  // Збереження налаштувань віджетів
  const toggleWidget = (key) => {
    const updated = { ...activeWidgets, [key]: !activeWidgets[key] };
    setActiveWidgets(updated);
    localStorage.setItem('vinMatrixDashboardWidgets', JSON.stringify(updated));
  };

  // === ОБЧИСЛЕННЯ ДАНИХ ДЛЯ ВІДЖЕТІВ ===
  const dashboardData = useMemo(() => {
    const today = new Date().toDateString();
    
    // 1. Завдання на сьогодні (створені сьогодні АБО заплановані на сьогодні)
    const todayTasks = visits.filter(v => {
      const isPendingOrProgress = v.status !== 'DONE' && v.status !== 'COMPLETED';
      const createdToday = new Date(v.created_at).toDateString() === today;
      const scheduledToday = v.scheduled_datetime && new Date(v.scheduled_datetime).toDateString() === today;
      return isPendingOrProgress && (createdToday || scheduledToday);
    });

    // 2. Гроші за сьогодні (тільки закриті візити)
    const todayCompleted = visits.filter(v => 
      (v.status === 'DONE' || v.status === 'COMPLETED') && 
      new Date(v.updated_at).toDateString() === today
    );
    const todayRevenue = todayCompleted.reduce((sum, v) => {
      const srvSum = (v.services || []).reduce((s, srv) => s + parseFloat(srv.price || 0), 0);
      const prtSum = (v.parts || []).reduce((s, prt) => s + parseFloat(prt.sell_price || 0), 0);
      return sum + srvSum + prtSum;
    }, 0);

    // 3. Алерти (Проблеми)
    // - Борги: Виконано, але не оплачено
    const unpaidDebts = visits.filter(v => 
      (v.status === 'DONE' || v.status === 'COMPLETED') && v.payment_status === 'unpaid'
    );
    // - Очікують запчастини (IN_PROGRESS)
    const waitingParts = visits.filter(v => v.status === 'IN_PROGRESS');

    return { todayTasks, todayRevenue, todayCompletedCount: todayCompleted.length, unpaidDebts, waitingParts };
  }, [visits]);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic text-blue-600"><Loader2 className="animate-spin mr-2"/> ЗАВАНТАЖЕННЯ...</div>;

  const isStore = companyInfo?.business_type === 'store';
  const greeting = new Date().getHours() < 12 ? 'Доброго ранку' : new Date().getHours() < 18 ? 'Добрий день' : 'Добрий вечір';

  return (
    <div className="max-w-[1600px] mx-auto p-3 md:p-8 md:pl-72 min-h-screen flex flex-col w-full overflow-x-hidden pb-24">
      
      {/* ШАПКА З КНОПКОЮ НАЛАШТУВАННЯ */}
      <div className="flex justify-between items-center mb-6 mt-4 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 flex items-center gap-2">
          <LayoutGrid className="text-blue-600"/> Панель
        </h1>
        <button 
          onClick={() => setIsConfigModalOpen(true)}
          className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 p-2 md:px-4 md:py-2.5 rounded-xl font-black uppercase text-[10px] md:text-xs flex items-center gap-2 transition-all shadow-sm"
        >
          <Settings2 size={16} /> <span className="hidden sm:inline">Налаштувати віджети</span>
        </button>
      </div>

      {/* BENTO GRID (СІТКА ВІДЖЕТІВ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-min">

        {/* ВІДЖЕТ 1: WELCOME & SEARCH (Широкий) */}
        {activeWidgets.welcome && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="relative z-10">
              <p className="text-blue-200 font-bold text-sm md:text-base uppercase tracking-widest mb-1">{greeting},</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-2">
                {profile?.user?.first_name || profile?.user?.username}
              </h2>
              <p className="text-blue-100 font-medium text-sm md:text-base max-w-md">
                Це ваш командний центр. Готові до продуктивного дня?
              </p>
            </div>

            <div className="relative z-10 w-full md:w-96 shrink-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-600 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Швидкий пошук запчастин..." 
                  className="w-full bg-white/95 focus:bg-white border-4 border-transparent focus:border-blue-300 rounded-2xl pl-12 pr-4 py-4 outline-none font-bold text-slate-800 shadow-xl transition-all placeholder:text-slate-400"
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && e.target.value.trim()) {
                      navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ВІДЖЕТ 2: ШВИДКІ ДІЇ */}
        {activeWidgets.quickActions && (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Швидкі дії</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button onClick={() => navigate('/visits')} className="bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-700 hover:text-blue-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
                <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  <Plus size={24} className="text-blue-500" />
                </div>
                <span className="font-bold text-xs md:text-sm uppercase">{isStore ? 'Нове замовлення' : 'Новий запис'}</span>
              </button>
              
              <button onClick={() => navigate('/search')} className="bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
                <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  <Package size={24} className="text-indigo-500" />
                </div>
                <span className="font-bold text-xs md:text-sm uppercase">Підбір деталі</span>
              </button>
            </div>
          </div>
        )}

        {/* ВІДЖЕТ 3: ПЛАН НА СЬОГОДНІ (Великий) */}
        {activeWidgets.todayTasks && (
          <div className="col-span-1 md:col-span-2 lg:row-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-500"/> У роботі сьогодні
              </h3>
              <span className="bg-blue-100 text-blue-600 font-black px-3 py-1 rounded-lg text-xs">{dashboardData.todayTasks.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[400px]">
              {dashboardData.todayTasks.length > 0 ? dashboardData.todayTasks.map(visit => (
                <div 
                  key={visit.id} 
                  onClick={() => navigate('/visits')}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-lg text-slate-800 group-hover:text-blue-600 transition-colors uppercase">{visit.plate}</span>
                    {visit.scheduled_datetime ? (
                       <span className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 flex items-center gap-1">
                         <Clock size={10}/> {new Date(visit.scheduled_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    ) : (
                       <span className="text-[10px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-amber-700">В черзі</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 truncate"><CarFront size={14} className="text-slate-400 shrink-0"/> {visit.client}</p>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3 py-10">
                  <div className="bg-slate-50 p-4 rounded-full"><CheckCircle2 size={32} className="text-slate-300"/></div>
                  <p className="text-xs font-black uppercase tracking-widest">Немає активних задач на сьогодні</p>
                </div>
              )}
            </div>
            {dashboardData.todayTasks.length > 0 && (
              <button onClick={() => navigate('/visits')} className="w-full mt-4 bg-slate-50 text-slate-500 font-black text-[10px] uppercase py-3 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                Всі {isStore ? 'замовлення' : 'візити'} <ArrowRight size={14}/>
              </button>
            )}
          </div>
        )}

        {/* ВІДЖЕТ 4: ФІНАНСИ (Квадратний) */}
        {activeWidgets.financialPulse && (
          <div 
            onClick={() => navigate('/analytics')}
            className="col-span-1 bg-emerald-500 rounded-3xl p-6 shadow-md shadow-emerald-200 text-white cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden group flex flex-col justify-between min-h-[180px]"
          >
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-400 rounded-full blur-2xl translate-y-1/3 translate-x-1/3 z-0"></div>
            <div className="relative z-10 flex justify-between items-start">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-100 flex items-center gap-1.5"><Wallet size={16}/> Обіг сьогодні</h3>
              <ArrowRight size={16} className="text-emerald-200 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-black leading-none mb-1">
                {dashboardData.todayRevenue.toLocaleString()} <span className="text-2xl text-emerald-200 opacity-80">₴</span>
              </h2>
              <p className="text-[10px] font-bold text-emerald-50 uppercase tracking-widest">
                Успішно закрито: {dashboardData.todayCompletedCount} шт.
              </p>
            </div>
          </div>
        )}

        {/* ВІДЖЕТ 5: АЛЕРТИ (Квадратний) */}
        {activeWidgets.alerts && (
          <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[180px]">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500"/> Увага потребують
            </h3>
            
            <div className="space-y-3 flex-1">
              <div 
                onClick={() => navigate('/visits')}
                className="bg-red-50 hover:bg-red-100 p-3 rounded-xl border border-red-100 cursor-pointer transition-colors flex justify-between items-center"
              >
                <div>
                  <p className="text-[10px] font-black uppercase text-red-500 tracking-wide mb-0.5">Неоплачені (Борг)</p>
                  <p className="text-sm font-black text-red-700">{dashboardData.unpaidDebts.length} клієнтів</p>
                </div>
                <ArrowRight size={14} className="text-red-400"/>
              </div>

              <div 
                onClick={() => navigate('/visits')}
                className="bg-orange-50 hover:bg-orange-100 p-3 rounded-xl border border-orange-100 cursor-pointer transition-colors flex justify-between items-center"
              >
                <div>
                  <p className="text-[10px] font-black uppercase text-orange-600 tracking-wide mb-0.5">В процесі (Очікування)</p>
                  <p className="text-sm font-black text-orange-800">{dashboardData.waitingParts.length} {isStore ? 'замовлень' : 'авто'}</p>
                </div>
                <ArrowRight size={14} className="text-orange-400"/>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* === МОДАЛКА НАЛАШТУВАННЯ ВІДЖЕТІВ === */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-100">
            <button onClick={() => setIsConfigModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-lg font-black uppercase mb-6 flex items-center gap-2 text-slate-800"><Settings2 size={20} className="text-blue-500"/> Налаштування Панелі</h2>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><LayoutGrid size={16} className="text-slate-400"/> Привітання та Пошук</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.welcome} onChange={() => toggleWidget('welcome')} />
              </label>

              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Plus size={16} className="text-slate-400"/> Швидкі дії</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.quickActions} onChange={() => toggleWidget('quickActions')} />
              </label>

              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarDays size={16} className="text-slate-400"/> План на сьогодні</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.todayTasks} onChange={() => toggleWidget('todayTasks')} />
              </label>

              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Wallet size={16} className="text-slate-400"/> Фінансовий пульс (Каса)</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.financialPulse} onChange={() => toggleWidget('financialPulse')} />
              </label>

              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><AlertCircle size={16} className="text-slate-400"/> Алерти (Борги, очікування)</span>
                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.alerts} onChange={() => toggleWidget('alerts')} />
              </label>
            </div>

            <button onClick={() => setIsConfigModalOpen(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-lg shadow-blue-200 transition-all tracking-widest text-xs mt-6">
              Готово
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
