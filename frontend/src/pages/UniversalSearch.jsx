import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Box, Truck, CarFront, X, Loader2, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UniversalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // ДОДАНО: Стан для розкриття складів
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Для модалки додавання в замовлення
  const [companyInfo, setCompanyInfo] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  
  const [visitSearchQuery, setVisitSearchQuery] = useState('');
  const [visitSearchResults, setVisitSearchResults] = useState([]);
  const [isSearchingVisits, setIsSearchingVisits] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const [addToVisitData, setAddToVisitData] = useState({ sell_price: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } });
        setCompanyInfo(res.data.company);
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      }
    };
    fetchSettings();
  }, [token, navigate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    setExpandedRows(new Set()); // Скидаємо розкриті рядки при новому пошуку
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

  // ФУНКЦІЯ РОЗКРИТТЯ/ЗГОРТАННЯ
  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (visitSearchQuery.length >= 2) {
        setIsSearchingVisits(true);
        try {
          const res = await axios.get(`${API_BASE}/api/visits/?search=${visitSearchQuery}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setVisitSearchResults(res.data.filter(v => v.status !== 'DONE'));
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearchingVisits(false);
        }
      } else {
        setVisitSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [visitSearchQuery, token]);

  const openAddModal = (part) => {
    setSelectedPart(part);
    setSelectedVisit(null);
    setVisitSearchQuery('');
    const margin = companyInfo?.global_margin_percent ? parseFloat(companyInfo.global_margin_percent) : 0;
    const sellPrice = (part.buy_price * (1 + margin / 100)).toFixed(2);
    setAddToVisitData({ sell_price: sellPrice });
  };

  const handleAddToVisit = async (e) => {
    e.preventDefault();
    if (!selectedVisit) {
      alert("Будь ласка, знайдіть та оберіть автомобіль!");
      return;
    }
    
    const payload = {
      visit: selectedVisit.id,
      brand: selectedPart.brand,
      article: selectedPart.article,
      name: selectedPart.name,
      buy_price: selectedPart.buy_price,
      sell_price: addToVisitData.sell_price,
      supplier: selectedPart.source,
      status: selectedPart.is_local ? 'ARRIVED' : 'WAITING'
    };

    try {
      await axios.post(`${API_BASE}/api/order-parts/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Запчастину додано до ${selectedVisit.plate}!`);
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
                  <React.Fragment key={item.id}>
                    {/* ГОЛОВНИЙ РЯДОК */}
                    <tr className={`border-b border-slate-50 transition-colors ${item.is_local ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          {item.is_local ? (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"><Box size={12}/> {item.source}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"><Truck size={12}/> {item.source}</span>
                          )}
                          
                          {/* КНОПКА РОЗКРИТТЯ ІНШИХ СКЛАДІВ */}
                          {item.warehouses && item.warehouses.length > 1 && (
                            <button 
                              onClick={() => toggleRow(item.id)}
                              className="text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2 py-1 rounded transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border border-slate-200"
                            >
                              {expandedRows.has(item.id) ? <><ChevronUp size={12}/> Сховати</> : <><ChevronDown size={12}/> Ще {item.warehouses.length - 1} склади</>}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-black text-sm text-slate-800">{item.article}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase">{item.brand}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-sm text-slate-700">{item.name}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-600 text-sm bg-slate-100 px-2 py-1 rounded-lg">{item.quantity}</span>
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
                    
                    {/* ПРИХОВАНІ РЯДКИ (ІНШІ СКЛАДИ) */}
                    {expandedRows.has(item.id) && item.warehouses?.slice(1).map((wh, idx) => (
                      <tr key={`${item.id}_wh_${idx}`} className="bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-100 transition-colors">
                        <td className="p-3 pl-6">
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                            <CornerDownRight size={14} className="text-slate-300"/> {wh.name}
                          </span>
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3 text-xs text-slate-400 font-medium">Альтернативний склад</td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-slate-500 text-sm">{wh.quantity} шт</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-bold text-slate-500">{item.buy_price.toLocaleString()} ₴</span>
                        </td>
                        <td className="p-3 text-right">
                          {/* Якщо клікають тут, передаємо ім'я конкретного складу */}
                          <button 
                            onClick={() => openAddModal({...item, source: `${item.source} (${wh.name})`, quantity: `${wh.quantity} шт`})} 
                            className="text-emerald-500 hover:text-white hover:bg-emerald-500 p-1.5 rounded-lg transition-colors border border-emerald-200 hover:border-emerald-500 shadow-sm"
                            title={`Додати з ${wh.name}`}
                          >
                            <Plus size={16}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {results.length === 0 && !loading && (
              <div className="text-center py-20 text-slate-400 font-bold uppercase">За вашим запитом нічого не знайдено</div>
            )}
          </div>
        </div>
      )}

      {selectedPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 relative mt-10 mb-10 shadow-2xl">
            <button onClick={() => setSelectedPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Plus className="text-emerald-500"/> Додати в авто</h2>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 relative overflow-hidden">
              {/* Бірочка звідки товар */}
              <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-bl-lg">
                {selectedPart.source}
              </div>

              <p className="font-black text-slate-800 text-lg leading-tight mb-1">{selectedPart.article}</p>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3 pr-16">{selectedPart.brand} | {selectedPart.name}</p>
              <div className="flex justify-between items-end border-t border-slate-200 pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Закупка:</span>
                <span className="font-black text-blue-600">{selectedPart.buy_price} ₴</span>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Знайдіть авто (Номер або VIN)</label>
                {!selectedVisit ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Напр. АА1234..." 
                      className="w-full bg-white border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-700 uppercase"
                      value={visitSearchQuery}
                      onChange={(e) => setVisitSearchQuery(e.target.value)}
                    />
                    
                    {visitSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                        {visitSearchResults.map(v => (
                          <button 
                            key={v.id} 
                            onClick={() => { setSelectedVisit(v); setVisitSearchResults([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                          >
                            <p className="font-black text-sm text-slate-800">{v.plate}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{v.client} | {v.vin_code || 'Без VIN'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {isSearchingVisits && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-blue-500" size={16}/></div>}
                  </div>
                ) : (
                  <div className="flex justify-between items-center bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                    <div>
                      <p className="font-black text-blue-700">{selectedVisit.plate}</p>
                      <p className="text-[10px] font-bold text-blue-500 uppercase">{selectedVisit.client}</p>
                    </div>
                    <button onClick={() => setSelectedVisit(null)} className="text-blue-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Ціна продажу клієнту (₴)</label>
                <div className="flex items-center gap-3">
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-black text-xl text-emerald-600" 
                    value={addToVisitData.sell_price} 
                    onChange={e => setAddToVisitData({...addToVisitData, sell_price: e.target.value})} 
                  />
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                    Націнка: {companyInfo?.global_margin_percent}%
                  </div>
                </div>
              </div>

              <button 
                onClick={handleAddToVisit}
                disabled={!selectedVisit} 
                className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm mt-4 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:grayscale"
              >
                Зберегти в чек
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UniversalSearch;
