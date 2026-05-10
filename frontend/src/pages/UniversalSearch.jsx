import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Box, Truck, CarFront, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UniversalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Для модалки додавання в замовлення
  const [activeVisits, setActiveVisits] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [addToVisitData, setAddToVisitData] = useState({ visit_id: '', sell_price: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  // Завантажуємо активні візити та інфо (для націнки)
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [visitsRes, settingsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        // Беремо тільки авто, які в черзі або в роботі
        setActiveVisits(visitsRes.data.filter(v => v.status !== 'DONE'));
        setCompanyInfo(settingsRes.data.company);
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      }
    };
    fetchBaseData();
  }, [token, navigate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await axios.get(`${API_BASE}/api/search-parts/?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(res.data);
    } catch (error) {
      console.error("Помилка пошуку", error);
    } finally {
      setLoading(false);
    }
  };

  // Відкриття модалки додавання
  const openAddModal = (part) => {
    setSelectedPart(part);
    // Розраховуємо автоматичну націнку
    const margin = companyInfo?.global_margin_percent ? parseFloat(companyInfo.global_margin_percent) : 0;
    const sellPrice = (part.buy_price * (1 + margin / 100)).toFixed(2);
    setAddToVisitData({ visit_id: activeVisits.length > 0 ? activeVisits[0].id : '', sell_price: sellPrice });
  };

  const handleAddToVisit = async (e) => {
    e.preventDefault();
    if (!addToVisitData.visit_id) {
      alert("Немає активних замовлень. Створіть візит спочатку.");
      return;
    }
    
    const payload = {
      visit: addToVisitData.visit_id,
      brand: selectedPart.brand,
      article: selectedPart.article,
      name: selectedPart.name,
      buy_price: selectedPart.buy_price,
      sell_price: addToVisitData.sell_price,
      supplier: selectedPart.source,
      status: selectedPart.is_local ? 'ARRIVED' : 'WAITING' // Якщо з нашого складу - одразу приїхала
    };

    try {
      await axios.post(`${API_BASE}/api/order-parts/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Успішно додано в замовлення!`);
      setSelectedPart(null);
    } catch (error) {
      alert("Помилка додавання.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 mb-2">Глобальний пошук</h1>
        <p className="text-slate-500 font-bold text-sm">Шукайте запчастини на власному складі та у всіх постачальників одночасно.</p>
      </div>

      {/* РЯДОК ПОШУКУ */}
      <form onSubmit={handleSearch} className="relative w-full mb-8 shadow-xl shadow-slate-200/50 rounded-2xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
        <input 
          type="text" 
          placeholder="Введіть артикул або назву..." 
          className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-16 pr-32 py-5 outline-none focus:border-blue-500 font-black text-lg text-slate-700 transition-all uppercase placeholder:normal-case placeholder:font-medium" 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
        />
        <button type="submit" disabled={loading} className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-sm hover:bg-blue-700 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Знайти'}
        </button>
      </form>

      {/* РЕЗУЛЬТАТИ */}
      {hasSearched && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-8 flex-1">
          <h2 className="text-lg font-black uppercase mb-6 text-slate-800">Результати пошуку: {results.length}</h2>
          
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Джерело</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Артикул / Бренд</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Опис</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Наявність</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Закупка</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {results.map(item => (
                  <tr key={item.id} className={`border-b border-slate-50 transition-colors ${item.is_local ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="p-3">
                      {item.is_local ? (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"><Box size={12}/> {item.source}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"><Truck size={12}/> {item.source}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-black text-sm text-slate-800">{item.article}</p>
                      <p className="text-[10px] font-bold text-blue-500 uppercase">{item.brand}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-sm text-slate-700">{item.name}</p>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-bold text-slate-600 text-sm">{item.quantity}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-black text-slate-800">{item.buy_price.toLocaleString()} ₴</span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => openAddModal(item)} className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-colors shadow-sm" title="Додати в замовлення">
                        <Plus size={18}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length === 0 && !loading && (
              <div className="text-center py-20 text-slate-400 font-bold uppercase">За вашим запитом нічого не знайдено</div>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА ДОДАВАННЯ */}
      {selectedPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 relative">
            <button onClick={() => setSelectedPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Plus className="text-emerald-500"/> Додати в авто</h2>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <p className="font-black text-slate-800 text-lg leading-tight mb-1">{selectedPart.article}</p>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">{selectedPart.brand} | {selectedPart.name}</p>
              <div className="flex justify-between items-end border-t border-slate-200 pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Закупка:</span>
                <span className="font-black text-blue-600">{selectedPart.buy_price} ₴</span>
              </div>
            </div>

            <form onSubmit={handleAddToVisit} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1.5"><CarFront size={14}/> Оберіть активне замовлення</label>
                {activeVisits.length > 0 ? (
                  <select required className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-bold text-slate-700" value={addToVisitData.visit_id} onChange={e => setAddToVisitData({...addToVisitData, visit_id: e.target.value})}>
                    {activeVisits.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} ({v.client})</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                    Немає машин в роботі. Спочатку створіть візит.
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Ціна продажу клієнту (₴)</label>
                <div className="flex items-center gap-3">
                  <input required type="number" step="0.01" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-black text-xl text-emerald-600" value={addToVisitData.sell_price} onChange={e => setAddToVisitData({...addToVisitData, sell_price: e.target.value})} />
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg whitespace-nowrap">Націнка: {companyInfo?.global_margin_percent}%</span>
                </div>
              </div>

              <button type="submit" disabled={activeVisits.length === 0} className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm mt-4 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all disabled:opacity-50">
                Зберегти в чек
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default UniversalSearch;
