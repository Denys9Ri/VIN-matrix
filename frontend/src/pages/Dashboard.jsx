import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutGrid, Plus, CalendarDays, AlertCircle, 
  Wallet, Search, CarFront, Package, ArrowRight, 
  Settings2, X, Clock, CheckCircle2, Loader2, Camera, ImagePlus, ClipboardList
} from 'lucide-react';
import AttentionCenter from '../components/notifications/AttentionCenter';

const Dashboard = () => {
  const navigate = useNavigate();
  const [visits, setVisits] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [profile, setProfile] = useState(null);

  const dashCameraRef = useRef(null);
  const dashGalleryRef = useRef(null);
  const [isDashboardScanning, setIsDashboardScanning] = useState(false);

  const defaultWidgets = {
    welcome: true,
    attentionCenter: true,
    quickActions: true,
    aiScanner: true,
    todayTasks: true,
    recommendations: true,
    financialPulse: true,
    alerts: true
  };
  
  const [activeWidgets, setActiveWidgets] = useState(() => {
    const saved = localStorage.getItem('vinMatrixDashboardWidgets');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...defaultWidgets, ...parsed };
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [visitsRes, settingsRes, recommendationsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/recommendations/`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
        ]);
        setVisits(visitsRes.data || []);
        setCompanyInfo(settingsRes.data.company);
        setProfile(settingsRes.data);
        setRecommendations(Array.isArray(recommendationsRes.data) ? recommendationsRes.data : []);
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  const toggleWidget = (key) => {
    const updated = { ...activeWidgets, [key]: !activeWidgets[key] };
    setActiveWidgets(updated);
    localStorage.setItem('vinMatrixDashboardWidgets', JSON.stringify(updated));
  };

  const handleDashboardScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsDashboardScanning(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('document', blob, 'scan.jpg');
          try {
            const res = await axios.post(`${API_BASE}/api/visits/recognize_document/`, formData, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
              navigate('/visits', { state: { scannedData: res.data } });
            }
          } catch (error) {
            alert("Не вдалося розпізнати. Спробуйте чіткіше фото.");
          } finally {
            setIsDashboardScanning(false);
          }
        }, 'image/jpeg', 0.8);
      };
    };
  };

  const dashboardData = useMemo(() => {
    const today = new Date().toDateString();
    const todayTasks = visits.filter(v => {
      const isPendingOrProgress = v.status !== 'DONE' && v.status !== 'COMPLETED';
      const createdToday = new Date(v.created_at).toDateString() === today;
      const scheduledToday = v.scheduled_datetime && new Date(v.scheduled_datetime).toDateString() === today;
      return isPendingOrProgress && (createdToday || scheduledToday);
    });

    const todayCompleted = visits.filter(v => 
      (v.status === 'DONE' || v.status === 'COMPLETED') && 
      new Date(v.updated_at).toDateString() === today
    );
    const todayRevenue = todayCompleted.reduce((sum, v) => {
      const srvSum = (v.services || []).reduce((s, srv) => s + parseFloat(srv.price || 0), 0);
      const prtSum = (v.parts || []).reduce((s, prt) => s + parseFloat(prt.sell_price || 0), 0);
      return sum + srvSum + prtSum;
    }, 0);

    const unpaidDebts = visits.filter(v => 
      (v.status === 'DONE' || v.status === 'COMPLETED') && v.payment_status === 'unpaid'
    );
    const waitingParts = visits.filter(v => v.status === 'IN_PROGRESS');

    const recActive = recommendations.filter(r => r.state === 'active').length;
    const recSoon = recommendations.filter(r => r.state === 'soon').length;
    const recOverdue = recommendations.filter(r => r.state === 'overdue').length;
    const recPriority = recommendations
      .filter(r => ['soon', 'overdue'].includes(r.state))
      .sort((a, b) => (a.state === 'overdue' ? -1 : 1) - (b.state === 'overdue' ? -1 : 1))
      .slice(0, 3);

    return { todayTasks, todayRevenue, todayCompletedCount: todayCompleted.length, unpaidDebts, waitingParts, recActive, recSoon, recOverdue, recPriority };
  }, [visits, recommendations]);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic text-blue-600"><Loader2 className="animate-spin mr-2"/> ЗАВАНТАЖЕННЯ...</div>;

  const isStore = companyInfo?.business_type === 'store';
  const greeting = new Date().getHours() < 12 ? 'Доброго ранку' : new Date().getHours() < 18 ? 'Добрий день' : 'Добрий вечір';

  return (
    <div className="max-w-[1600px] mx-auto p-3 md:p-8 min-h-screen flex flex-col w-full overflow-x-hidden pb-24">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-min">
        {activeWidgets.welcome && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="relative z-10">
              <p className="text-blue-200 font-bold text-sm md:text-base uppercase tracking-widest mb-1">{greeting},</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-2">{profile?.user?.first_name || profile?.user?.username}</h2>
              <p className="text-blue-100 font-medium text-sm md:text-base max-w-md">Це ваш командний центр. Готові до продуктивного дня?</p>
            </div>
            <div className="relative z-10 w-full md:w-96 shrink-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-600 transition-colors" size={20} />
                <input type="text" placeholder="Швидкий пошук запчастин..." className="w-full bg-white/95 focus:bg-white border-4 border-transparent focus:border-blue-300 rounded-2xl pl-12 pr-4 py-4 outline-none font-bold text-slate-800 shadow-xl transition-all placeholder:text-slate-400" onKeyDown={(e) => { if(e.key === 'Enter' && e.target.value.trim()) navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`); }} />
              </div>
            </div>
          </div>
        )}

        {activeWidgets.attentionCenter && <AttentionCenter />}

        {activeWidgets.quickActions && (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Швидкі дії</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button onClick={() => navigate('/visits')} className="bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-700 hover:text-blue-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"><div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform"><Plus size={24} className="text-blue-500" /></div><span className="font-bold text-xs md:text-sm uppercase text-center">{isStore ? 'Нове замовлення' : 'Новий запис'}</span></button>
              <button onClick={() => navigate('/search')} className="bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group"><div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform"><Package size={24} className="text-indigo-500" /></div><span className="font-bold text-xs md:text-sm uppercase text-center">Підбір деталі</span></button>
            </div>
          </div>
        )}

        {activeWidgets.aiScanner && (
          <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white border border-slate-700 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[180px]">
            {isDashboardScanning && <div className="absolute inset-0 bg-slate-950/90 z-20 flex flex-col items-center justify-center p-4 backdrop-blur-sm"><div className="relative w-36 h-24 border border-emerald-500 rounded-lg overflow-hidden bg-slate-900/50 mb-3"><div className="laser-line"></div></div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">ШІ розпізнає техпаспорт...</p></div>}
            <div><span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded mb-3 inline-block">ШІ-Модуль</span><h3 className="text-base font-black uppercase italic leading-tight mb-1 flex items-center gap-2"><Camera size={18} className="text-emerald-400"/> Швидкий OCR Скан</h3><p className="text-[11px] text-slate-400 font-bold max-w-xs leading-tight">Завантажте техпаспорт для миттєвого заповнення картки</p></div>
            <div className="grid grid-cols-2 gap-2 mt-4 z-10"><button onClick={() => dashCameraRef.current.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/50"><Camera size={14}/> Камера</button><button onClick={() => dashGalleryRef.current.click()} className="bg-slate-700 hover:bg-slate-600 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"><ImagePlus size={14}/> Галерея</button></div>
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={dashCameraRef} onChange={handleDashboardScan} />
            <input type="file" accept="image/*" className="hidden" ref={dashGalleryRef} onChange={handleDashboardScan} />
          </div>
        )}

        {activeWidgets.todayTasks && (
          <div className="col-span-1 md:col-span-2 lg:row-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100"><h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2"><CalendarDays size={18} className="text-blue-500"/> У роботі сьогодні</h3><span className="bg-blue-100 text-blue-600 font-black px-3 py-1 rounded-lg text-xs">{dashboardData.todayTasks.length}</span></div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[400px]">
              {dashboardData.todayTasks.length > 0 ? dashboardData.todayTasks.map(visit => <div key={visit.id} onClick={() => navigate('/visits')} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"><div className="flex justify-between items-start mb-2"><span className="font-black text-lg text-slate-800 group-hover:text-blue-600 transition-colors uppercase">{visit.plate}</span>{visit.scheduled_datetime ? <span className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-500 flex items-center gap-1"><Clock size={10}/> {new Date(visit.scheduled_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-[10px] font-black uppercase tracking-widest bg-amber-50 border border-amber-200 px-2 py-1 rounded-md text-amber-700">В черзі</span>}</div><p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 truncate"><CarFront size={14} className="text-slate-400 shrink-0"/> {visit.client}</p></div>) : <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3 py-10"><div className="bg-slate-50 p-4 rounded-full"><CheckCircle2 size={32} className="text-slate-300"/></div><p className="text-xs font-black uppercase tracking-widest">Немає активних задач на сьогодні</p></div>}
            </div>
            {dashboardData.todayTasks.length > 0 && <button onClick={() => navigate('/visits')} className="w-full mt-4 bg-slate-50 text-slate-500 font-black text-[10px] uppercase py-3 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">Всі {isStore ? 'замовлення' : 'візити'} <ArrowRight size={14}/></button>}
          </div>
        )}

        {activeWidgets.recommendations && (
          <div className="col-span-1 md:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[220px]">
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100"><h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2"><ClipboardList size={18} className="text-indigo-500"/> Рекомендації</h3><button onClick={() => navigate('/crm/recommendations')} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">CRM <ArrowRight size={13}/></button></div>
            <div className="grid grid-cols-3 gap-2 mb-4"><div className="bg-blue-50 rounded-2xl p-3 border border-blue-100"><p className="text-[9px] font-black uppercase text-blue-400">Активні</p><p className="text-xl font-black text-blue-700">{dashboardData.recActive}</p></div><div className="bg-amber-50 rounded-2xl p-3 border border-amber-100"><p className="text-[9px] font-black uppercase text-amber-500">Скоро</p><p className="text-xl font-black text-amber-700">{dashboardData.recSoon}</p></div><div className="bg-rose-50 rounded-2xl p-3 border border-rose-100"><p className="text-[9px] font-black uppercase text-rose-500">Простр.</p><p className="text-xl font-black text-rose-700">{dashboardData.recOverdue}</p></div></div>
            <div className="space-y-2 flex-1">
              {dashboardData.recPriority.length > 0 ? dashboardData.recPriority.map(item => <div key={item.id} onClick={() => navigate('/crm/recommendations')} className={`p-3 rounded-2xl border cursor-pointer transition-colors ${item.state === 'overdue' ? 'bg-rose-50 border-rose-100 hover:bg-rose-100' : 'bg-amber-50 border-amber-100 hover:bg-amber-100'}`}><div className="flex justify-between gap-2"><p className="text-sm font-black text-slate-800 truncate">{item.plate || 'Без номера'}</p><span className="text-[10px] font-black uppercase text-slate-500 shrink-0">{item.state_label}</span></div><p className="text-xs font-bold text-slate-600 truncate">{item.title}</p></div>) : <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-black uppercase tracking-wider bg-slate-50 rounded-2xl">Немає термінових рекомендацій</div>}
            </div>
          </div>
        )}

        {activeWidgets.financialPulse && (
          <div onClick={() => navigate('/analytics')} className="col-span-1 bg-emerald-500 rounded-3xl p-6 shadow-md shadow-emerald-200 text-white cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden group flex flex-col justify-between min-h-[180px]"><div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-400 rounded-full blur-2xl translate-y-1/3 translate-x-1/3 z-0"></div><div className="relative z-10 flex justify-between items-start"><h3 className="text-xs font-black uppercase tracking-widest text-emerald-100 flex items-center gap-1.5"><Wallet size={16}/> Обіг сьогодні</h3><ArrowRight size={16} className="text-emerald-200 group-hover:translate-x-1 transition-transform" /></div><div className="relative z-10"><h2 className="text-4xl font-black leading-none mb-1">{dashboardData.todayRevenue.toLocaleString()} <span className="text-2xl text-emerald-200 opacity-80">₴</span></h2><p className="text-[10px] font-bold text-emerald-50 uppercase tracking-widest">Успішно закрито: {dashboardData.todayCompletedCount} шт.</p></div></div>
        )}

        {activeWidgets.alerts && (
          <div className="col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[180px]"><h3 className="text-xs font-black uppercase text-slate-800 tracking-widest mb-4 flex items-center gap-2"><AlertCircle size={16} className="text-red-500"/> Увага потребують</h3><div className="space-y-3 flex-1"><div onClick={() => navigate('/visits')} className="bg-red-50 hover:bg-red-100 p-3 rounded-xl border border-red-100 cursor-pointer transition-colors flex justify-between items-center"><div><p className="text-[10px] font-black uppercase text-red-500 tracking-wide mb-0.5">Неоплачені (Борг)</p><p className="text-sm font-black text-red-700">{dashboardData.unpaidDebts.length} клієнтів</p></div><ArrowRight size={14} className="text-red-400"/></div><div onClick={() => navigate('/visits')} className="bg-orange-50 hover:bg-orange-100 p-3 rounded-xl border border-orange-100 cursor-pointer transition-colors flex justify-between items-center"><div><p className="text-[10px] font-black uppercase text-orange-600 tracking-wide mb-0.5">В процесі (Очікування)</p><p className="text-sm font-black text-orange-800">{dashboardData.waitingParts.length} {isStore ? 'замовлень' : 'авто'}</p></div><ArrowRight size={14} className="text-orange-400"/></div></div></div>
        )}
      </div>

      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-100">
            <button onClick={() => setIsConfigModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-lg font-black uppercase mb-6 flex items-center gap-2 text-slate-800"><Settings2 size={20} className="text-blue-500"/> Налаштування Панелі</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><LayoutGrid size={16} className="text-slate-400"/> Привітання та Пошук</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.welcome} onChange={() => toggleWidget('welcome')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><AlertCircle size={16} className="text-slate-400"/> Центр повідомлень</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.attentionCenter} onChange={() => toggleWidget('attentionCenter')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Plus size={16} className="text-slate-400"/> Швидкі дії</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.quickActions} onChange={() => toggleWidget('quickActions')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Camera size={16} className="text-slate-400"/> Хмарний ШІ-сканер</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.aiScanner} onChange={() => toggleWidget('aiScanner')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarDays size={16} className="text-slate-400"/> План на сьогодні</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.todayTasks} onChange={() => toggleWidget('todayTasks')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><ClipboardList size={16} className="text-slate-400"/> Рекомендації CRM</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.recommendations} onChange={() => toggleWidget('recommendations')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Wallet size={16} className="text-slate-400"/> Фінансовий пульс (Каса)</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.financialPulse} onChange={() => toggleWidget('financialPulse')} /></label>
              <label className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/50 cursor-pointer hover:border-blue-300 transition-colors"><span className="text-sm font-bold text-slate-700 flex items-center gap-2"><AlertCircle size={16} className="text-slate-400"/> Алерти (Борги, очікування)</span><input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={activeWidgets.alerts} onChange={() => toggleWidget('alerts')} /></label>
            </div>
            <button onClick={() => setIsConfigModalOpen(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-lg shadow-blue-200 transition-all tracking-widest text-xs mt-6">Готово</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
