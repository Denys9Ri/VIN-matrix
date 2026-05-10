import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, CarFront, Phone, CalendarDays, Wallet, History, X, Wrench, Store, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  // ДОДАНО: Стан для пагінації
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Кількість авто на одній сторінці

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
            client: visit.client,
            phone: visit.phone,
            totalSpent: 0,
            visits: []
          };
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

  // ДОДАНО: Якщо користувач починає пошук, перекидаємо його на 1-шу сторінку
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // ДОДАНО: Логіка обчислення поточних авто для відображення
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = clients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(clients.length / itemsPerPage);

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">R16 ЗАВАНТАЖЕННЯ...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800">База клієнтів</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">Унікальних авто: {clients.length}</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Пошук (номер, ім'я, телефон)..." 
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-blue-500 font-bold text-slate-700 shadow-sm transition-all" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      {/* СПИСОК КЛІЄНТІВ (використовуємо currentClients замість clients) */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentClients.map(c => (
            <div 
              key={c.plate} 
              onClick={() => setSelectedClient(c)}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-blue-500 mb-1 tracking-widest">Номер авто</p>
                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{c.plate}</h3>
                </div>
                <div className="bg-blue-50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                  <CarFront className="text-blue-600" size={24} />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><CarFront size={14} className="text-slate-400"/> {c.client}</p>
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {c.phone}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Всього візитів</p>
                  <p className="text-sm font-black flex items-center gap-1"><History size={14} className="text-slate-600"/> {c.visits.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Загальна каса</p>
                  <p className="text-sm font-black flex items-center gap-1 text-green-600"><Wallet size={14}/> {c.totalSpent.toLocaleString()} ₴</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="w-full text-center py-20 text-slate-400 font-black uppercase text-xl">
            Клієнтів не знайдено
          </div>
        )}

        {/* ДОДАНО: КНОПКИ ПАГІНАЦІЇ */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`p-3 rounded-2xl transition-all flex items-center justify-center ${currentPage === 1 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="text-sm font-black text-slate-500 uppercase tracking-widest">
              Стор. {currentPage} з {totalPages}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`p-3 rounded-2xl transition-all flex items-center justify-center ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600 shadow-sm'}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* МОДАЛКА: ІСТОРІЯ КЛІЄНТА */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-3xl p-5 md:p-8 shadow-2xl mt-8 mb-16 relative">
            <button onClick={() => setSelectedClient(null)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
            
            <div className="border-b border-slate-100 pb-6 mb-6">
              <h2 className="text-3xl md:text-4xl font-black uppercase mb-2">{selectedClient.plate}</h2>
              <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><CarFront size={16}/> {selectedClient.client}</span>
                <span className="flex items-center gap-1.5"><Phone size={16}/> {selectedClient.phone}</span>
                <span className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100"><Wallet size={16}/> LTV: {selectedClient.totalSpent.toLocaleString()} ₴</span>
              </div>
            </div>

            <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2 tracking-widest"><History size={18}/> Історія візитів</h3>

            <div className="space-y-6">
              {selectedClient.visits.map((visit, index) => (
                <div key={visit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                    <div className="font-black text-blue-600 flex items-center gap-2">
                      <CalendarDays size={16}/> 
                      {new Date(visit.created_at).toLocaleDateString()} 
                      <span className="text-slate-400 text-xs font-medium ml-2">Візит #{selectedClient.visits.length - index}</span>
                    </div>
                    <div className="font-black text-lg">{visit.visitTotal.toLocaleString()} ₴</div>
                  </div>

                  {visit.services?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1"><Wrench size={12}/> Роботи</p>
                      <ul className="space-y-1">
                        {visit.services.map(s => (
                          <li key={s.id} className="flex justify-between text-sm font-medium text-slate-700">
                            <span>{s.name}</span>
                            <span className="font-bold">{parseFloat(s.price).toLocaleString()} ₴</span>
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
                          <li key={p.id} className="flex justify-between text-sm font-medium text-slate-700">
                            <span>{p.name} <span className="text-[10px] text-slate-400 ml-1">({p.brand})</span></span>
                            <span className="font-bold">{parseFloat(p.sell_price).toLocaleString()} ₴</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {visit.comment && (
                    <div className="mt-4 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <p className="text-[10px] font-black uppercase text-amber-800 mb-1 flex items-center gap-1"><MessageSquare size={12}/> Коментар майстра</p>
                      <p className="text-sm font-medium text-slate-700">{visit.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
