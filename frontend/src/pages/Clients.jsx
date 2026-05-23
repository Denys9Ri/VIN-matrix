import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, CarFront, Phone, CalendarDays, Wallet, History, X, Wrench, Store, MessageSquare, ChevronLeft, ChevronRight, Copy, Check, RefreshCcw, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; 
  
  const [copiedVin, setCopiedVin] = useState(null);

  const [isRepeatingVisit, setIsRepeatingVisit] = useState(false);
  const [repeatVisitData, setRepeatVisitData] = useState({ date: '', time: '' });
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [editingVisitData, setEditingVisitData] = useState({ date: '', time: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const fetchClients = async () => {
    try {
      const params = new URLSearchParams({ history: 'true' });
      if (searchQuery) params.append('search', searchQuery);

      const res = await axios.get(`${API_BASE}/api/visits/?${params.toString()}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      const grouped = res.data.reduce((acc, visit) => {
        const servicesTotal = visit.services?.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) || 0;
        const partsTotal = visit.parts?.reduce((sum, p) => sum + parseFloat(p.sell_price || 0), 0) || 0;
        const visitTotal = servicesTotal + partsTotal;

        if (!acc[visit.plate]) {
          acc[visit.plate] = {
            plate: visit.plate,
            vin_code: visit.vin_code,
            client: visit.client,
            phone: visit.phone,
            totalSpent: 0,
            visits: []
          };
        }
        
        if (visit.vin_code && !acc[visit.plate].vin_code) {
          acc[visit.plate].vin_code = visit.vin_code;
        }

        acc[visit.plate].visits.push({ ...visit, visitTotal });
        acc[visit.plate].totalSpent += visitTotal;
        return acc;
      }, {});

      setClients(Object.values(grouped));
    } catch (error) {
      if (error.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => { fetchClients(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, token, navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleCopyVin = (vin) => {
    if (!vin) return;
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(vin).then(() => {
        setCopiedVin(vin);
        setTimeout(() => setCopiedVin(null), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = vin;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedVin(vin);
        setTimeout(() => setCopiedVin(null), 2000);
      } catch (err) {}
      document.body.removeChild(textArea);
    }
  };

  const handleCreateRepeatVisit = async (e) => {
    e.preventDefault();
    let scheduled_datetime = null;
    if (repeatVisitData.date && repeatVisitData.time) {
      const localDate = new Date(`${repeatVisitData.date}T${repeatVisitData.time}`);
      scheduled_datetime = localDate.toISOString();
    }
    const payload = {
        plate: selectedClient.plate.toUpperCase(),
        vin_code: selectedClient.vin_code || '', 
        client: selectedClient.client,
        phone: selectedClient.phone,
        scheduled_datetime: scheduled_datetime
    };
    try {
      await axios.post(`${API_BASE}/api/visits/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setIsRepeatingVisit(false);
      setSelectedClient(null);
      setRepeatVisitData({ date: '', time: '' });
      navigate('/visits'); 
    } catch (error) { alert("Помилка створення візиту"); }
  };

  const handleStartVisitDateTimeEdit = (visit) => {
    const baseDate = visit.scheduled_datetime ? new Date(visit.scheduled_datetime) : new Date(visit.created_at);
    if (Number.isNaN(baseDate.getTime())) return;

    const date = baseDate.toISOString().slice(0, 10);
    const time = `${String(baseDate.getHours()).padStart(2, '0')}:${String(baseDate.getMinutes()).padStart(2, '0')}`;
    setEditingVisitId(visit.id);
    setEditingVisitData({ date, time });
  };

  const handleSaveVisitDateTime = async (visitId) => {
    const parsedDate = new Date(`${editingVisitData.date}T${editingVisitData.time}`);
    if (Number.isNaN(parsedDate.getTime())) {
      alert('Некоректна дата або час');
      return;
    }

    try {
      await axios.patch(`${API_BASE}/api/visits/${visitId}/`, { scheduled_datetime: parsedDate.toISOString() }, { headers: { Authorization: `Bearer ${token}` } });
      await fetchClients();
      setSelectedClient(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          visits: prev.visits.map(v => v.id === visitId ? { ...v, scheduled_datetime: parsedDate.toISOString() } : v)
        };
      });
      setEditingVisitId(null);
    } catch (error) {
      alert("Не вдалося оновити дату/час візиту");
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = clients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(clients.length / itemsPerPage);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">VIN-MATRIX ЗАВАНТАЖЕННЯ...</div>;

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 md:pl-72 min-h-screen flex flex-col overflow-x-hidden">
      
      <style>{`
        input[type="date"], input[type="time"] { color: #334155 !important; -webkit-appearance: none; min-height: 42px; }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 shrink-0 mt-4 md:mt-0">
        <div>
          <h1 className="text-xl md:text-3xl font-black uppercase italic text-slate-800">База клієнтів</h1>
          <p className="text-slate-500 font-bold text-xs md:text-sm mt-1">Унікальних авто: {clients.length}</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Пошук (номер, VIN, ім'я, телефон)..." 
            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-700 shadow-sm transition-all text-sm" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      <div className="flex-1 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {currentClients.map(c => (
            <div 
              key={c.plate} 
              onClick={() => setSelectedClient(c)}
              className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[9px] font-black uppercase text-blue-500 mb-1 tracking-widest">Номер авто</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{c.plate}</h3>
                    {c.vin_code && (
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest truncate max-w-[150px]">
                        VIN: {c.vin_code}
                      </p>
                    )}
                  </div>
                  <div className="bg-blue-50 p-2 md:p-3 rounded-xl group-hover:scale-110 transition-transform shrink-0">
                    <CarFront className="text-blue-600" size={20} />
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <p className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 truncate"><CarFront size={14} className="text-slate-400 shrink-0"/> {c.client}</p>
                  <p className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2"><Phone size={14} className="text-slate-400 shrink-0"/> {c.phone}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Всього візитів</p>
                  <p className="text-sm font-black flex items-center gap-1"><History size={14} className="text-slate-600"/> {c.visits.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Загальна каса</p>
                  <p className="text-sm font-black flex items-center gap-1 text-green-600"><Wallet size={14}/> {c.totalSpent.toLocaleString()} ₴</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="w-full text-center py-20 text-slate-400 font-black uppercase text-base md:text-xl">
            Клієнтів не знайдено
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`p-2.5 md:p-3 rounded-xl transition-all flex items-center justify-center ${currentPage === 1 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-widest">
              Стор. {currentPage} з {totalPages}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`p-2.5 md:p-3 rounded-xl transition-all flex items-center justify-center ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 z-40 overflow-y-auto pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-4 md:p-8 shadow-2xl relative my-auto">
            <button onClick={() => setSelectedClient(null)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
            
            <div className="border-b border-slate-100 pb-5 mb-5 pr-8">
              <h2 className="text-2xl md:text-4xl font-black uppercase mb-2 leading-tight">{selectedClient.plate}</h2>
              
              {selectedClient.vin_code && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[10px] md:text-sm font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 break-all">
                    VIN: {selectedClient.vin_code}
                  </span>
                  <button 
                    onClick={() => handleCopyVin(selectedClient.vin_code)}
                    className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors border border-slate-200 hover:border-blue-200 shrink-0"
                    title="Скопіювати VIN"
                  >
                    {copiedVin === selectedClient.vin_code ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  </button>
                  {copiedVin === selectedClient.vin_code && (
                    <span className="text-[10px] font-bold text-green-600 uppercase transition-all">Скопійовано!</span>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 text-xs md:text-sm font-bold text-slate-600 mb-4">
                <span className="flex items-center gap-1.5"><CarFront size={14} className="shrink-0"/> <span className="truncate">{selectedClient.client}</span></span>
                <span className="flex items-center gap-1.5"><Phone size={14} className="shrink-0"/> {selectedClient.phone}</span>
                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100"><Wallet size={14} className="shrink-0"/> LTV: {selectedClient.totalSpent.toLocaleString()} ₴</span>
              </div>

              <button 
                onClick={() => setIsRepeatingVisit(true)} 
                className="w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all mt-2"
              >
                <RefreshCcw size={16}/> Записати на повторний візит
              </button>
            </div>

            <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2 tracking-widest text-sm md:text-base"><History size={18}/> Історія візитів</h3>

            <div className="space-y-4 md:space-y-6">
              {selectedClient.visits.map((visit, index) => (
                <div key={visit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-200 pb-3 gap-2">
                    <div className="font-black text-blue-600 flex items-center gap-2 text-sm md:text-base">
                      <CalendarDays size={16}/> 
                      {visit.scheduled_datetime 
                        ? new Date(visit.scheduled_datetime).toLocaleDateString() 
                        : new Date(visit.created_at).toLocaleDateString()
                      }
                      {editingVisitId !== visit.id && (
                        <button
                          onClick={() => handleStartVisitDateTimeEdit(visit)}
                          className="text-slate-400 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-1 transition-colors"
                          title="Редагувати дату та час візиту"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      <span className="text-slate-400 text-[10px] md:text-xs font-medium ml-2">Візит #{selectedClient.visits.length - index}</span>
                    </div>
                    {editingVisitId === visit.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" value={editingVisitData.date} onChange={e => setEditingVisitData(prev => ({ ...prev, date: e.target.value }))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700" />
                        <input type="time" value={editingVisitData.time} onChange={e => setEditingVisitData(prev => ({ ...prev, time: e.target.value }))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700" />
                        <button onClick={() => handleSaveVisitDateTime(visit.id)} className="bg-blue-600 text-white rounded-lg px-2 py-1 text-[10px] font-black uppercase">Зберегти</button>
                        <button onClick={() => setEditingVisitId(null)} className="bg-slate-200 text-slate-700 rounded-lg px-2 py-1 text-[10px] font-black uppercase">Скасувати</button>
                      </div>
                    )}
                    <div className="font-black text-base md:text-lg">{visit.visitTotal.toLocaleString()} ₴</div>
                  </div>

                  {visit.services?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Wrench size={12}/> Роботи</p>
                      <ul className="space-y-1">
                        {visit.services.map(s => (
                          <li key={s.id} className="flex justify-between text-xs md:text-sm font-medium text-slate-700 gap-2 mb-2">
                            <span className="truncate flex-1">{s.name}</span>
                            <span className="font-bold shrink-0">{parseFloat(s.price).toLocaleString()} ₴</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {visit.parts?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Store size={12}/> Запчастини</p>
                      <ul className="space-y-1">
                        {visit.parts.map(p => (
                          <li key={p.id} className="flex flex-col sm:flex-row sm:justify-between text-xs md:text-sm font-medium text-slate-700 gap-1 sm:gap-2 mb-3 sm:mb-2 border-b sm:border-0 border-slate-100 pb-2 sm:pb-0">
                            <span className="truncate block w-full">{p.name} <span className="text-[9px] md:text-[10px] text-slate-400 ml-1">({p.brand})</span></span>
                            <span className="shrink-0 sm:text-right block w-full sm:w-auto">
                              <span className="font-bold block">{parseFloat(p.sell_price).toLocaleString()} ₴</span>
                              <span className="text-[10px] text-slate-500 font-semibold block">Закупівля: {parseFloat(p.buy_price ?? p.purchase_price ?? 0).toLocaleString()} ₴</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {visit.comment && (
                    <div className="mt-4 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <p className="text-[9px] md:text-[10px] font-black uppercase text-amber-800 mb-1 flex items-center gap-1"><MessageSquare size={12}/> Коментар майстра</p>
                      <p className="text-xs md:text-sm font-medium text-slate-700">{visit.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА СТВОРЕННЯ ПОВТОРНОГО ВІЗИТУ */}
      {isRepeatingVisit && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative border border-slate-100">
            <button onClick={() => setIsRepeatingVisit(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full transition-colors"><X size={18} /></button>
            <h2 className="text-lg font-black uppercase mb-2 flex items-center gap-2 text-blue-600"><RefreshCcw size={20}/> Новий запис</h2>
            <p className="text-sm font-bold text-slate-600 mb-6 pb-4 border-b border-slate-100">Для клієнта: <span className="text-slate-900">{selectedClient.client} ({selectedClient.plate})</span></p>
            
            <form onSubmit={handleCreateRepeatVisit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Оберіть дату</label>
                <input required type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-slate-700 text-sm transition-all" value={repeatVisitData.date} onChange={e => setRepeatVisitData({...repeatVisitData, date: e.target.value})}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Оберіть час</label>
                <input required type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-bold text-slate-700 text-sm transition-all" value={repeatVisitData.time} onChange={e => setRepeatVisitData({...repeatVisitData, time: e.target.value})}/>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black uppercase shadow-lg shadow-blue-200 transition-all tracking-widest text-xs mt-4">
                Створити візит
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Clients;
