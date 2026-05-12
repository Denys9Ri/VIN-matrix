import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, Box, Truck, X, Loader2, ChevronDown, ChevronUp, CornerDownRight, Info, Image as ImageIcon, Banknote, Edit3, Check, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UniversalSearch = () => {
  const navigate = useNavigate();
  
  const [query, setQuery] = useState(sessionStorage.getItem('searchQuery') || '');
  const [results, setResults] = useState(JSON.parse(sessionStorage.getItem('searchResults')) || []);
  
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(results.length > 0);
  
  const [expandedAnalogs, setExpandedAnalogs] = useState(new Set()); // Для аналогів
  const [companyInfo, setCompanyInfo] = useState(null);
  
  const [isEditingEuro, setIsEditingEuro] = useState(false);
  const [euroRateInput, setEuroRateInput] = useState('');

  const [selectedPart, setSelectedPart] = useState(null);
  const [infoPart, setInfoPart] = useState(null);
  
  const [visitSearchQuery, setVisitSearchQuery] = useState('');
  const [visitSearchResults, setVisitSearchResults] = useState([]);
  const [isSearchingVisits, setIsSearchingVisits] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const [locationFilter, setLocationFilter] = useState('');

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } });
        setCompanyInfo(res.data.company);
        setEuroRateInput(res.data.company.euro_rate || '42.00');
      } catch (error) {
        if (error.response?.status === 401) navigate('/login');
      }
    };
    fetchSettings();
  }, [token, navigate]);

  useEffect(() => {
    sessionStorage.setItem('searchQuery', query);
    sessionStorage.setItem('searchResults', JSON.stringify(results));
  }, [query, results]);

  const handleSaveEuroRate = async () => {
    try {
      await axios.patch(`${API_BASE}/api/settings/`, 
        { "company[euro_rate]": euroRateInput }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompanyInfo({ ...companyInfo, euro_rate: euroRateInput });
      setIsEditingEuro(false);
      if (results.length > 0) handleSearch();
    } catch (error) {
      alert("Помилка збереження курсу");
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    setExpandedAnalogs(new Set()); 
    setLocationFilter(''); 
    try {
      const res = await axios.get(`${API_BASE}/api/search-parts/?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Додаємо кожному результату стан вибраного складу
      const initialResults = res.data.map(item => ({
        ...item,
        selectedWhIdx: 0 // за замовчуванням перший склад
      }));
      setResults(initialResults);
    } catch (error) {
      console.error("Помилка пошуку", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAnalogs = (id) => {
    const newExpanded = new Set(expandedAnalogs);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedAnalogs(newExpanded);
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

  const openAddModal = (part, whIdx) => {
    const selectedWh = part.warehouses[whIdx];
    const finalPart = {
      ...part,
      source: `${part.source} (${selectedWh.name})`,
      buy_price: selectedWh.buy_price,
      quantity: `${selectedWh.quantity} шт`
    };
    
    setSelectedPart(finalPart);
    setSelectedVisit(null);
    setVisitSearchQuery('');
    const margin = companyInfo?.global_margin_percent ? parseFloat(companyInfo.global_margin_percent) : 0;
    const sellPrice = (finalPart.buy_price * (1 + margin / 100)).toFixed(2);
    setAddToVisitData({ sell_price: sellPrice });
  };

  const handleAddToVisit = async (e) => {
    e.preventDefault();
    if (!selectedVisit) { alert("Будь ласка, знайдіть та оберіть автомобіль!"); return; }
    
    const payload = {
      visit: selectedVisit.id, brand: selectedPart.brand, article: selectedPart.article,
      name: selectedPart.name, buy_price: selectedPart.buy_price, sell_price: addToVisitData.sell_price,
      supplier: selectedPart.source, status: selectedPart.is_local ? 'ARRIVED' : 'WAITING'
    };

    try {
      await axios.post(`${API_BASE}/api/order-parts/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Запчастину додано до ${selectedVisit.plate}!`);
      setSelectedPart(null);
    } catch (error) { alert("Помилка додавання."); }
  };

  const getBadgeStyle = (sourceName, isLocal) => {
    if (isLocal) return "bg-slate-800 text-white whitespace-nowrap";
    const name = sourceName.toUpperCase();
    if (name.includes('VESNA')) return "bg-emerald-600 text-white shadow-md shadow-emerald-200 whitespace-nowrap";
    if (name.includes('OMEGA') || name.includes('ОМЕГА')) return "bg-blue-600 text-white shadow-md shadow-blue-200 whitespace-nowrap";
    if (name.includes('TEHNO') || name.includes('ТЕХНО')) return "bg-rose-600 text-white shadow-md shadow-rose-200 whitespace-nowrap";
    return "bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap";
  };

  const availableLocations = useMemo(() => {
    const locs = new Set();
    results.forEach(r => {
      if (r.warehouses) {
        r.warehouses.forEach(w => {
          const parts = w.name.split(/[\s-]/);
          if (parts[0].length > 2) locs.add(parts[0]);
          else locs.add(w.name);
        });
      }
    });
    return Array.from(locs).sort();
  }, [results]);

  const displayedResults = useMemo(() => {
    let processed = [...results];
    
    if (locationFilter) {
      processed = processed.filter(item => {
        if (item.is_local) return true;
        return item.warehouses?.some(w => w.name.toLowerCase().includes(locationFilter.toLowerCase()));
      });
      
      processed = processed.map(item => {
        if (item.is_local || !item.warehouses) return item;
        const matched = item.warehouses.filter(w => w.name.toLowerCase().includes(locationFilter.toLowerCase()));
        const others = item.warehouses.filter(w => !w.name.toLowerCase().includes(locationFilter.toLowerCase()));
        
        if (matched.length > 0) {
          return {
            ...item,
            warehouses: [...matched, ...others],
            selectedWhIdx: 0 // Скидаємо вибраний склад на перший підходящий
          };
        }
        return item;
      });
    }
    
    processed.sort((a, b) => {
      const priceA = a.warehouses ? a.warehouses[a.selectedWhIdx].buy_price : a.buy_price;
      const priceB = b.warehouses ? b.warehouses[b.selectedWhIdx].buy_price : b.buy_price;
      return priceA - priceB;
    });
    
    return processed;
  }, [results, locationFilter]);

  // Функція для зміни вибраного складу для конкретного рядка
  const updateSelectedWarehouse = (itemId, whIndex) => {
    setResults(prev => prev.map(item => 
      item.id === itemId ? { ...item, selectedWhIdx: parseInt(whIndex) } : item
    ));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 min-h-screen flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-800 mb-2">Глобальний пошук</h1>
          <p className="text-slate-500 font-bold text-sm">Шукайте запчастини на власному складі та у всіх постачальників одночасно.</p>
        </div>
        
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-3 flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Banknote size={20}/></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Курс € (Vesna/Technomir)</p>
            {isEditingEuro ? (
              <div className="flex items-center gap-2 mt-1">
                <input type="number" step="0.01" className="w-20 font-black text-sm border-b-2 border-amber-400 outline-none" value={euroRateInput} onChange={e => setEuroRateInput(e.target.value)} autoFocus />
                <button onClick={handleSaveEuroRate} className="text-emerald-500 hover:text-emerald-600"><Check size={16}/></button>
                <button onClick={() => {setIsEditingEuro(false); setEuroRateInput(companyInfo?.euro_rate || '42.00')}} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-black text-slate-800">{companyInfo?.euro_rate || '0.00'} ₴</span>
                <button onClick={() => setIsEditingEuro(true)} className="text-slate-300 hover:text-blue-500 transition-colors"><Edit3 size={14}/></button>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="relative w-full mb-8 shadow-xl shadow-slate-200/50 rounded-2xl">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
        <input 
          type="text" 
          placeholder="Введіть артикул..." 
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-lg font-black uppercase text-slate-800">Результати пошуку: {displayedResults.length}</h2>
            
            {availableLocations.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select 
                  value={locationFilter} 
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-transparent text-slate-700 text-sm font-bold outline-none cursor-pointer"
                >
                  <option value="">Усі склади (за найдешевшою ціною)</option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>Фільтр: {loc}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-36">Джерело</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Артикул / Бренд</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Опис</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Наявність та Склад</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Закупка</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {displayedResults.map(item => {
                  // Визначаємо поточний вибраний склад для цього рядка
                  const currentWh = item.warehouses ? item.warehouses[item.selectedWhIdx] : null;
                  const currentPrice = currentWh ? currentWh.buy_price : item.buy_price;
                  const currentQty = currentWh ? currentWh.quantity : item.quantity;
                  
                  return (
                  <React.Fragment key={item.id}>
                    <tr className={`border-b border-slate-50 transition-colors ${item.is_local ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-3 align-top pt-4">
                        <div className="flex flex-col gap-2 items-start w-32">
                          <span className={`inline-flex items-center justify-center w-full gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${getBadgeStyle(item.source, item.is_local)}`}>
                            {item.is_local ? <Box size={12}/> : <Truck size={12}/>} {item.source}
                          </span>
                          
                          {/* КНОПКА АНАЛОГІВ ЗЛІВА */}
                          {!item.is_local && (
                            <button onClick={() => toggleAnalogs(item.id)} className="w-full text-slate-500 hover:text-blue-600 bg-white px-2 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider border border-slate-200 shadow-sm whitespace-nowrap">
                              {expandedAnalogs.has(item.id) ? <><ChevronUp size={12}/> Сховати</> : <><ChevronDown size={12}/> Аналоги</>}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 pt-4 align-top">
                        <p className="font-black text-sm text-slate-800">{item.article}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase mt-1">{item.brand}</p>
                      </td>
                      <td className="p-3 pt-4 align-top">
                        <div className="flex items-start gap-2">
                          <p className="font-bold text-sm text-slate-700 leading-snug max-w-xs">{item.name}</p>
                          <button onClick={() => setInfoPart(item)} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-full transition-colors border border-slate-100 shrink-0" title="Детальна інформація"><Info size={16}/></button>
                        </div>
                      </td>
                      <td className="p-3 pt-4 text-center align-top">
                        {/* ВИПАДАЮЧИЙ СПИСОК СКЛАДІВ СПРАВА */}
                        {item.warehouses && item.warehouses.length > 1 ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-slate-600 text-sm">{currentQty} шт</span>
                            <select 
                              className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-1 outline-none w-32 cursor-pointer"
                              value={item.selectedWhIdx}
                              onChange={(e) => updateSelectedWarehouse(item.id, e.target.value)}
                            >
                              {item.warehouses.map((wh, idx) => (
                                <option key={idx} value={idx}>{wh.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-600 text-sm bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block">{currentQty}</span>
                        )}
                      </td>
                      <td className="p-3 pt-4 text-right align-top">
                        <span className="font-black text-slate-800 text-base block">{currentPrice.toLocaleString()} ₴</span>
                      </td>
                      <td className="p-3 pt-4 text-right align-top">
                        <button onClick={() => openAddModal(item, item.selectedWhIdx)} className="bg-emerald-500 text-white p-2.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200 inline-block" title="Додати в замовлення">
                          <Plus size={18}/>
                        </button>
                      </td>
                    </tr>
                    
                    {/* РОЗКРИТТЯ АНАЛОГІВ */}
                    {expandedAnalogs.has(item.id) && (
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan="6" className="p-4">
                          <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                            <Box className="mx-auto text-slate-300 mb-2" size={32}/>
                            <h3 className="font-black text-slate-500 uppercase tracking-widest text-sm mb-1">Пошук аналогів</h3>
                            <p className="text-slate-400 text-xs">Функція завантаження крос-кодів (аналогів) для {item.article} знаходиться в розробці...</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
            {displayedResults.length === 0 && !loading && (
              <div className="text-center py-20 text-slate-400 font-bold uppercase">За вашим запитом нічого не знайдено</div>
            )}
          </div>
        </div>
      )}

      {/* МОДАЛКА З ІНФО */}
      {infoPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 relative shadow-2xl">
            <button onClick={() => setInfoPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Info className="text-blue-500"/> Інформація про товар</h2>
            
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="w-full md:w-2/5 aspect-square bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                {infoPart.image_url ? (
                  <img src={infoPart.image_url} alt="Part" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center text-slate-300">
                    <ImageIcon size={48} className="mb-2"/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Немає фото</span>
                  </div>
                )}
              </div>
              
              <div className="w-full md:w-3/5 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Бренд</p>
                  <p className="font-black text-blue-600 uppercase text-lg">{infoPart.brand}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Артикул</p>
                  <p className="font-black text-slate-800 text-xl">{infoPart.article}</p>
                </div>
                <div className="flex gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">SKU</p>
                    <p className="font-bold text-slate-700 text-sm">{infoPart.sku || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Мін. замовлення</p>
                    <p className="font-bold text-slate-700 text-sm">{infoPart.min_qty} шт</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Опис з каталогу</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                {infoPart.description || infoPart.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ДОДАВАННЯ В ЧЕК */}
      {selectedPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 relative mt-10 mb-10 shadow-2xl">
            <button onClick={() => setSelectedPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Plus className="text-emerald-500"/> Додати в авто</h2>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 relative overflow-hidden">
              <div className={`absolute top-0 right-0 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-xl ${getBadgeStyle(selectedPart.source, selectedPart.is_local)}`}>
                {selectedPart.source}
              </div>

              <p className="font-black text-slate-800 text-lg leading-tight mb-1">{selectedPart.article}</p>
              <p className="text-xs font-bold text-slate-500 uppercase mb-3 pr-20">{selectedPart.brand} | {selectedPart.name}</p>
              <div className="flex justify-between items-end border-t border-slate-200 pt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Закупка:</span>
                <span className="font-black text-slate-800 text-lg">{selectedPart.buy_price.toLocaleString()} ₴</span>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Знайдіть авто (Номер або VIN)</label>
                {!selectedVisit ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Напр. АА1234..." className="w-full bg-white border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-700 uppercase" value={visitSearchQuery} onChange={(e) => setVisitSearchQuery(e.target.value)} />
                    {visitSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                        {visitSearchResults.map(v => (
                          <button key={v.id} onClick={() => { setSelectedVisit(v); setVisitSearchResults([]); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
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
                  <input required type="number" step="0.01" className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-black text-xl text-emerald-600" value={addToVisitData.sell_price} onChange={e => setAddToVisitData({...addToVisitData, sell_price: e.target.value})} />
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded whitespace-nowrap">
                    Націнка: {companyInfo?.global_margin_percent}%
                  </div>
                </div>
              </div>

              <button onClick={handleAddToVisit} disabled={!selectedVisit} className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm mt-4 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:grayscale">
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
