import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { AppPage, Badge, PageHeader, useToast } from '../components/ui';
import { Search, Plus, Box, Truck, X, Loader2, ChevronDown, ChevronUp, CornerDownRight, Info, Image as ImageIcon, Banknote, Edit3, Check, Filter, RefreshCcw, Activity, CarFront, History } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const UniversalSearch = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams(); 
  
  const [query, setQuery] = useState(sessionStorage.getItem('searchQuery') || '');
  const [results, setResults] = useState(JSON.parse(sessionStorage.getItem('searchResults')) || []);
  
  // === НОВИЙ СТАН: ІСТОРІЯ ПОШУКУ ===
  const [searchHistory, setSearchHistory] = useState(
    JSON.parse(localStorage.getItem('partSearchHistory')) || []
  );

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(results.length > 0);
  
  const [expandedAnalogs, setExpandedAnalogs] = useState(new Set()); 
  const [analogResults, setAnalogResults] = useState({});
  const [analogLoading, setAnalogLoading] = useState({});

  const [companyInfo, setCompanyInfo] = useState(null);
  const [isEditingEuro, setIsEditingEuro] = useState(false);
  const [euroRateInput, setEuroRateInput] = useState('');

  const [selectedPart, setSelectedPart] = useState(null);
  const [infoPart, setInfoPart] = useState(null);
  const [detailedInfo, setDetailedInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  
  const [visitSearchQuery, setVisitSearchQuery] = useState('');
  const [visitSearchResults, setVisitSearchResults] = useState([]);
  const [isSearchingVisits, setIsSearchingVisits] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  const [locationFilter, setLocationFilter] = useState('');

  const [addToVisitData, setAddToVisitData] = useState({ sell_price: '' });

  const toast = useToast();
  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings/');
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

  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, [searchParams]);

  const handleSaveEuroRate = async () => {
    try {
      await api.patch('/api/settings/', { "company[euro_rate]": euroRateInput });
      setCompanyInfo({ ...companyInfo, euro_rate: euroRateInput });
      setIsEditingEuro(false);
      if (results.length > 0) performSearch(query);
    } catch (error) {
      toast.error('Помилка збереження курсу');
    }
  };

  const performSearch = async (searchString) => {
    if (!searchString.trim()) return;
    
    // ДОДАЄМО В ІСТОРІЮ ПОШУКУ
    const upperSearch = searchString.trim().toUpperCase();
    setSearchHistory(prev => {
      // Видаляємо такий самий запит, якщо він вже є, щоб перенести його на перше місце
      const filtered = prev.filter(item => item !== upperSearch);
      // Додаємо на початок і залишаємо тільки 6 останніх
      const newHistory = [upperSearch, ...filtered].slice(0, 6);
      localStorage.setItem('partSearchHistory', JSON.stringify(newHistory));
      return newHistory;
    });

    setLoading(true);
    setHasSearched(true);
    setExpandedAnalogs(new Set()); 
    setLocationFilter(''); 
    try {
      const res = await api.get(`/api/search-parts/?q=${encodeURIComponent(searchString.trim())}`);
      const initialResults = res.data.map(item => ({
        ...item,
        selectedWhIdx: 0 
      }));
      setResults(initialResults);
      setSearchParams({}, { replace: true });
    } catch (error) {
      console.error("Помилка пошуку", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFormSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('partSearchHistory');
  };

  const isUtrSource = (sourceName) => {
    const name = String(sourceName || '').toUpperCase();
    return name.includes('ЮНІК') || name.includes('ЮНИК') || name.includes('UNIQ') || name.includes('UNIQUE') || name.includes('UTR');
  };

  const uniqueParts = (items, parent = null) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
      .filter(Boolean)
      .filter((part) => {
        const key = `${String(part.article || '').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').toUpperCase()}::${String(part.brand || '').toUpperCase()}::${String(part.sku || '')}`;
        if (!key.trim() || seen.has(key)) return false;
        seen.add(key);
        if (!parent) return true;
        const sameSku = String(part.sku || '') && String(part.sku || '') === String(parent.sku || '');
        const sameSupplier = String(part.supplier_id || '') === String(parent.supplier_id || '');
        const sameArticle = String(part.article || '').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').toUpperCase() === String(parent.article || '').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '').toUpperCase();
        const sameBrand = String(part.brand || '').toUpperCase() === String(parent.brand || '').toUpperCase();
        return !(sameSupplier && (sameSku || (sameArticle && sameBrand)));
      });
  };

  const fetchAnalogs = async (item) => {
    setAnalogLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const supplierAnalogUrl = `/api/search-parts/?q=${encodeURIComponent(item.article)}&analog=true&supplier_id=${item.supplier_id}&sku=${encodeURIComponent(item.sku || '')}&brand=${encodeURIComponent(item.brand || '')}`;
      const res = await api.get(supplierAnalogUrl);

      let collected = uniqueParts(res.data, item);

      // У Юнік Трейд немає стабільного окремого endpoint для аналогів.
      // Якщо UTR не повернув кроси, робимо fallback на інші підключені
      // джерела й явно показуємо постачальника біля кожного аналога.
      if (collected.length === 0 && isUtrSource(item.source)) {
        try {
          const globalAnalogUrl = `/api/search-parts/?q=${encodeURIComponent(item.article)}&analog=true&brand=${encodeURIComponent(item.brand || '')}`;
          const globalAnalog = await api.get(globalAnalogUrl);
          collected = uniqueParts(globalAnalog.data, item);
        } catch (fallbackErr) {
          console.warn('UTR global analog fallback failed', fallbackErr);
        }
      }

      if (collected.length === 0 && isUtrSource(item.source)) {
        try {
          const globalDirectUrl = `/api/search-parts/?q=${encodeURIComponent(item.article)}`;
          const globalDirect = await api.get(globalDirectUrl);
          collected = uniqueParts(globalDirect.data, item);
        } catch (fallbackErr) {
          console.warn('UTR direct fallback failed', fallbackErr);
        }
      }

      const processed = collected.map(a => ({ ...a, selectedWhIdx: 0 }));

      processed.sort((a, b) => {
        const checkAvailability = (part) => {
          const qStr = String(part.quantity || '');
          if (qStr.includes('Немає') || qStr.includes('?') || qStr === '0') return false;
          const numMatch = qStr.match(/\d+/);
          if (numMatch && parseInt(numMatch[0]) > 0) return true;
          if (qStr.includes('>')) return true;
          return false;
        };

        const availA = checkAvailability(a);
        const availB = checkAvailability(b);

        if (availA && !availB) return -1;
        if (!availA && availB) return 1;

        const priceA = parseFloat(a.buy_price) || 0;
        const priceB = parseFloat(b.buy_price) || 0;
        return priceA - priceB;
      });

      setAnalogResults(prev => ({ ...prev, [item.id]: processed }));
    } catch (err) {
      console.error(err);
      setAnalogResults(prev => ({ ...prev, [item.id]: [] }));
    } finally {
      setAnalogLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };


  const toggleAnalogs = (item) => {
    const id = item.id;
    const newExpanded = new Set(expandedAnalogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
      setExpandedAnalogs(newExpanded);
    } else {
      newExpanded.add(id);
      setExpandedAnalogs(newExpanded);
      if (!analogResults[id]) {
        fetchAnalogs(item);
      }
    }
  };

  const updateAnalogWarehouse = (parentId, analogId, whIndex) => {
    setAnalogResults(prev => {
      const parentAnalogs = prev[parentId] || [];
      const updated = parentAnalogs.map(a => 
        a.id === analogId ? { ...a, selectedWhIdx: parseInt(whIndex) } : a
      );
      return { ...prev, [parentId]: updated };
    });
  };

  const openInfoModal = async (part) => {
    setInfoPart(part);
    setDetailedInfo(null);
    if (part.is_local || !part.supplier_id) return;

    setInfoLoading(true);
    try {
      const res = await api.get(`/api/suppliers/${part.supplier_id}/part_info/?article=${encodeURIComponent(part.article)}&brand=${encodeURIComponent(part.brand)}&sku=${encodeURIComponent(part.sku || '')}`);
      setDetailedInfo(res.data);
    } catch (e) {
      console.error("Не вдалося завантажити інфо", e);
    } finally {
      setInfoLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (visitSearchQuery.length >= 2) {
        setIsSearchingVisits(true);
        try {
          const res = await api.get(`/api/visits/?search=${visitSearchQuery}`);
          setVisitSearchResults(res.data.filter(v => v.status !== 'DONE' && v.status !== 'COMPLETED'));
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
    const safeIdx = whIdx || 0;
    const selectedWh = (part.warehouses && part.warehouses.length > 0) ? (part.warehouses[safeIdx] || part.warehouses[0]) : null;
    
    const finalPart = {
      ...part,
      source: selectedWh ? `${part.source} (${selectedWh.name})` : part.source,
      buy_price: selectedWh ? (selectedWh.buy_price || part.buy_price) : part.buy_price,
      quantity: selectedWh ? `${selectedWh.quantity} шт` : part.quantity
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
    if (!selectedVisit) { toast.warning('Будь ласка, знайдіть та оберіть замовлення/авто!'); return; }
    
    const payload = {
      visit: selectedVisit.id, brand: selectedPart.brand, article: selectedPart.article,
      name: selectedPart.name, buy_price: selectedPart.buy_price, sell_price: addToVisitData.sell_price,
      supplier: selectedPart.source, status: selectedPart.is_local ? 'ARRIVED' : 'WAITING'
    };

    try {
      await api.post('/api/order-parts/', payload);
      toast.success(`Запчастину додано до ${selectedVisit.plate}!`);
      setSelectedPart(null);
    } catch (error) { toast.error('Помилка додавання.'); }
  };

  const getBadgeStyle = (sourceName, isLocal) => {
    if (isLocal) return "bg-slate-800 text-white whitespace-nowrap";
    const name = sourceName.toUpperCase();
    if (name.includes('VESNA')) return "bg-emerald-600 text-white shadow-md shadow-emerald-200 whitespace-nowrap";
    if (name.includes('OMEGA') || name.includes('ОМЕГА')) return "bg-blue-600 text-white shadow-md shadow-blue-200 whitespace-nowrap";
    if (name.includes('TEHNO') || name.includes('ТЕХНО')) return "bg-rose-600 text-white shadow-md shadow-rose-200 whitespace-nowrap";
    if (name.includes('UTR') || name.includes('UNIQ') || name.includes('UNIQUE') || name.includes('ЮНІК') || name.includes('ЮНИК') || name.includes('УНІК') || name.includes('УНИК')) return "bg-orange-400 text-black shadow-md shadow-orange-200 whitespace-nowrap";
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
            selectedWhIdx: 0 
          };
        }
        return item;
      });
    }
    
    processed.sort((a, b) => {
      const getPrice = (item) => {
        if (item.warehouses && item.warehouses.length > 0) {
          const idx = item.selectedWhIdx || 0;
          const wh = item.warehouses[idx] || item.warehouses[0];
          return wh.buy_price || item.buy_price || 0;
        }
        return item.buy_price || 0;
      };
      return getPrice(a) - getPrice(b);
    });
    
    return processed;
  }, [results, locationFilter]);

  const updateSelectedWarehouse = (itemId, whIndex) => {
    setResults(prev => prev.map(item => 
      item.id === itemId ? { ...item, selectedWhIdx: parseInt(whIndex) } : item
    ));
  };

  return (
    <AppPage className="flex flex-col"><div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-8 gap-4 mt-4 md:mt-0">
        <PageHeader title="Глобальний пошук" subtitle="Шукайте запчастини на складі та у всіх постачальників." icon={<Search />} />
        
        <div className="w-full lg:w-auto bg-white border border-slate-200 shadow-sm rounded-2xl p-3 flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600"><Banknote size={20}/></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Курс € (Vesna/Techno)</p>
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
      </div>

      <div className="mb-6 md:mb-8">
        <form onSubmit={handleSearchFormSubmit} className="relative w-full shadow-xl shadow-slate-200/50 rounded-2xl mb-3">
          <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Введіть артикул..." 
            className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 md:pl-16 pr-24 md:pr-32 py-4 md:py-5 outline-none focus:border-blue-500 font-black text-base md:text-lg text-slate-700 transition-all uppercase placeholder:normal-case placeholder:font-medium" 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
          />
          <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black uppercase text-xs md:text-sm hover:bg-blue-700 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Знайти'}
          </button>
        </form>

        {/* ІСТОРІЯ ПОШУКУ (ТЕГИ) */}
        {searchHistory.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
              <History size={12}/> Нещодавні:
            </span>
            {searchHistory.map((item, idx) => (
              <button 
                key={idx}
                onClick={() => {
                  setQuery(item);
                  performSearch(item);
                }}
                className="bg-white border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 hover:bg-blue-50 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm"
              >
                {item}
              </button>
            ))}
            <button 
              onClick={clearHistory}
              className="text-slate-400 hover:text-red-500 p-1 rounded-full transition-colors ml-auto"
              title="Очистити історію"
            >
              <X size={14}/>
            </button>
          </div>
        )}
      </div>

      {hasSearched && (
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 flex-1">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-base md:text-lg font-black uppercase text-slate-800">Результати пошуку: {displayedResults.length}</h2>
            
            {availableLocations.length > 0 && (
              <div className="flex items-center w-full lg:w-auto gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                <Filter size={16} className="text-slate-400 shrink-0" />
                <select 
                  value={locationFilter} 
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-transparent text-slate-700 text-xs md:text-sm font-bold outline-none cursor-pointer w-full"
                >
                  <option value="">Усі склади (за найдешевшою ціною)</option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>Фільтр: {loc}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="hidden md:block overflow-x-auto pb-4">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest min-w-[120px] w-32">Джерело</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest min-w-[120px] w-32">Артикул / Бренд</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest w-full">Опис</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center min-w-[140px] w-40">Наявність та Склад</th>
                  <th className="p-3 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right min-w-[100px] w-24">Закупка</th>
                  <th className="p-3 w-12 min-w-[48px]"></th>
                </tr>
              </thead>
              <tbody>
                {displayedResults.map(item => {
                  const safeIdx = item.selectedWhIdx || 0;
                  const currentWh = (item.warehouses && item.warehouses.length > 0) ? (item.warehouses[safeIdx] || item.warehouses[0]) : null;
                  const currentPrice = currentWh ? (currentWh.buy_price || item.buy_price || 0) : (item.buy_price || 0);
                  const currentQty = currentWh ? currentWh.quantity : item.quantity;
                  
                  return (
                  <React.Fragment key={item.id}>
                    <tr className={`border-b border-slate-50 transition-colors ${item.is_local ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-3 align-top pt-4">
                        <div className="flex flex-col gap-2 items-start w-full">
                          <Badge variant="supplier" supplier={item.source} className="w-full justify-center rounded-lg">
                            {item.is_local ? <Box size={12}/> : <Truck size={12}/>} {item.source}
                          </Badge>
                          
                          {!item.is_local && (
                            <button onClick={() => toggleAnalogs(item)} className="w-full text-slate-500 hover:text-blue-600 bg-white px-2 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider border border-slate-200 shadow-sm whitespace-nowrap">
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
                          <button onClick={() => openInfoModal(item)} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-full transition-colors border border-slate-100 shrink-0" title="Характеристики та авто"><Info size={16}/></button>
                        </div>
                      </td>
                      <td className="p-3 pt-4 text-center align-top">
                        {item.warehouses && item.warehouses.length > 1 ? (
                          <div className="flex flex-col items-center gap-1 w-full">
                            <span className="font-bold text-slate-600 text-sm">{currentQty}</span>
                            <select 
                              className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5 outline-none w-full max-w-[140px] cursor-pointer"
                              value={safeIdx}
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
                        <button onClick={() => openAddModal(item, safeIdx)} className="bg-emerald-500 text-white p-2.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200 inline-block" title="Додати в замовлення">
                          <Plus size={18}/>
                        </button>
                      </td>
                    </tr>
                    
                    {expandedAnalogs.has(item.id) && (
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan="6" className="p-4">
                          {analogLoading[item.id] ? (
                            <div className="flex flex-col items-center justify-center py-6 text-blue-500">
                              <Loader2 className="animate-spin mb-2" size={24}/>
                              <span className="text-xs font-bold uppercase tracking-widest">Шукаємо крос-коди...</span>
                            </div>
                          ) : analogResults[item.id] && analogResults[item.id].length > 0 ? (
                            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-inner ml-4 md:ml-12 lg:ml-24">
                              <h4 className="text-xs font-black uppercase text-blue-600 mb-3 flex items-center gap-2"><RefreshCcw size={14}/> Знайдені аналоги ({analogResults[item.id].length})</h4>
                              <div className="space-y-2">
                                {analogResults[item.id].map(analog => {
                                   const analogWhIdx = analog.selectedWhIdx || 0;
                                   const analogWh = (analog.warehouses && analog.warehouses.length > 0) ? analog.warehouses[analogWhIdx] : null;
                                   const analogPrice = analogWh ? analogWh.buy_price : analog.buy_price;
                                   const analogQty = analogWh ? analogWh.quantity : analog.quantity;
                                   
                                   const isAvailable = analogPrice > 0 && !String(analogQty).includes('Немає') && !String(analogQty).includes('?');
                                   
                                   return (
                                     <div key={analog.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all gap-3 md:gap-4 ${!isAvailable ? 'opacity-60 grayscale' : ''}`}>
                                       <div className="w-full sm:w-36 md:w-44 shrink-0 space-y-1.5">
                                         <Badge variant="supplier" supplier={analog.source} className="rounded-md px-2 py-1 text-[8px]">
                                           <Truck size={10}/> {analog.source || 'Постачальник'}
                                         </Badge>
                                         <p 
                                           className={`font-black text-sm hover:text-blue-600 cursor-pointer underline decoration-dashed underline-offset-4 transition-colors ${isAvailable ? 'text-slate-800 decoration-slate-300' : 'text-slate-500 decoration-slate-200'}`}
                                           onClick={() => {
                                             setQuery(analog.article);
                                             performSearch(analog.article);
                                             window.scrollTo({ top: 0, behavior: 'smooth' });
                                           }}
                                           title="Шукати цей артикул скрізь"
                                         >
                                           {analog.article}
                                         </p>
                                         <p className="text-[10px] font-bold text-blue-500 uppercase">{analog.brand}</p>
                                       </div>
                                       
                                       <p className="font-bold text-xs text-slate-600 flex-1 leading-snug">{analog.name}</p>
                                       
                                       <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-4 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                                         {analog.warehouses && analog.warehouses.length > 1 ? (
                                           <select 
                                             className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-1 outline-none w-32 cursor-pointer shadow-sm"
                                             value={analogWhIdx}
                                             onChange={(e) => updateAnalogWarehouse(item.id, analog.id, e.target.value)}
                                           >
                                             {analog.warehouses.map((wh, idx) => (
                                               <option key={idx} value={idx}>{wh.name} - {wh.quantity}</option>
                                             ))}
                                           </select>
                                         ) : (
                                           <span className="font-bold text-slate-600 text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm w-32 text-center inline-block truncate">{analogQty}</span>
                                         )}
                                         <span className="font-black text-slate-800 w-16 text-right">{analogPrice.toLocaleString()} ₴</span>
                                         <button onClick={() => openAddModal(analog, analogWhIdx)} disabled={!isAvailable} className="bg-emerald-500 text-white p-1.5 rounded-lg hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" title={isAvailable ? "Додати в замовлення" : "Немає в наявності"}>
                                           <Plus size={16}/>
                                         </button>
                                       </div>
                                     </div>
                                   );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 text-center ml-4 md:ml-12 lg:ml-24">
                              <Box className="mx-auto text-slate-300 mb-2" size={24}/>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Аналогів не знайдено</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex flex-col gap-4">
            {displayedResults.map(item => {
              const safeIdx = item.selectedWhIdx || 0;
              const currentWh = (item.warehouses && item.warehouses.length > 0) ? (item.warehouses[safeIdx] || item.warehouses[0]) : null;
              const currentPrice = currentWh ? (currentWh.buy_price || item.buy_price || 0) : (item.buy_price || 0);
              const currentQty = currentWh ? currentWh.quantity : item.quantity;
              
              return (
                <div key={`mob_${item.id}`} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                  
                  <div className="flex justify-between items-center">
                    <Badge variant="supplier" supplier={item.source} className="rounded-lg">
                      {item.is_local ? <Box size={12}/> : <Truck size={12}/>} {item.source}
                    </Badge>
                    <button onClick={() => openAddModal(item, safeIdx)} className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-200">
                      <Plus size={18}/>
                    </button>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-base text-slate-800 leading-tight">{item.article}</p>
                      <p className="text-[10px] font-bold text-blue-500 uppercase mt-0.5">{item.brand}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-800 text-lg block">{currentPrice.toLocaleString()} ₴</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="font-bold text-xs text-slate-700 leading-snug flex-1">{item.name}</p>
                    <button onClick={() => openInfoModal(item)} className="text-slate-400 hover:text-blue-600 p-1 rounded-full shrink-0"><Info size={16}/></button>
                  </div>

                  <div className="flex flex-col gap-2 mt-1">
                    {item.warehouses && item.warehouses.length > 1 ? (
                      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-600 text-xs px-2 whitespace-nowrap">{currentQty}</span>
                        <select 
                          className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none flex-1 ml-2 truncate"
                          value={safeIdx}
                          onChange={(e) => updateSelectedWarehouse(item.id, e.target.value)}
                        >
                          {item.warehouses.map((wh, idx) => (
                            <option key={idx} value={idx}>{wh.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 flex justify-center">
                        <span className="font-bold text-slate-600 text-xs">{currentQty}</span>
                      </div>
                    )}

                    {!item.is_local && (
                      <button onClick={() => toggleAnalogs(item)} className="w-full text-slate-500 bg-white px-2 py-2 rounded-xl transition-all flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider border border-slate-200 shadow-sm mt-1">
                        {expandedAnalogs.has(item.id) ? <><ChevronUp size={14}/> Сховати аналоги</> : <><ChevronDown size={14}/> Пошук аналогів</>}
                      </button>
                    )}
                  </div>

                  {expandedAnalogs.has(item.id) && (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 mt-2">
                      {analogLoading[item.id] ? (
                         <div className="flex flex-col items-center justify-center py-4 text-blue-500">
                           <Loader2 className="animate-spin mb-2" size={20}/>
                           <span className="text-[10px] font-bold uppercase tracking-widest">Шукаємо...</span>
                         </div>
                      ) : analogResults[item.id] && analogResults[item.id].length > 0 ? (
                         <div className="space-y-3">
                           <h4 className="text-[10px] font-black uppercase text-blue-600 mb-2 text-center border-b border-slate-200 pb-2">Знайдені аналоги ({analogResults[item.id].length})</h4>
                           {analogResults[item.id].map(analog => {
                             const analogWhIdx = analog.selectedWhIdx || 0;
                             const analogWh = (analog.warehouses && analog.warehouses.length > 0) ? analog.warehouses[analogWhIdx] : null;
                             const analogPrice = analogWh ? analogWh.buy_price : analog.buy_price;
                             const analogQty = analogWh ? analogWh.quantity : analog.quantity;
                             
                             const isAvailable = analogPrice > 0 && !String(analogQty).includes('Немає') && !String(analogQty).includes('?');
                             
                             return (
                               <div key={analog.id} className={`bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2 relative ${!isAvailable ? 'opacity-60 grayscale' : ''}`}>
                                  <button onClick={() => openAddModal(analog, analogWhIdx)} disabled={!isAvailable} className="absolute right-3 top-3 bg-emerald-500 text-white p-1.5 rounded-lg hover:bg-emerald-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={14}/></button>
                                  <div className="pr-8 space-y-1.5">
                                    <Badge variant="supplier" supplier={analog.source} className="rounded-md px-2 py-1 text-[8px]">
                                      <Truck size={10}/> {analog.source || 'Постачальник'}
                                    </Badge>
                                    <p 
                                      className={`font-black text-sm leading-tight hover:text-blue-600 cursor-pointer underline decoration-dashed underline-offset-4 transition-colors ${isAvailable ? 'text-slate-800 decoration-slate-300' : 'text-slate-500 decoration-slate-200'}`}
                                      onClick={() => {
                                        setQuery(analog.article);
                                        performSearch(analog.article);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                    >
                                      {analog.article}
                                    </p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase">{analog.brand}</p>
                                  </div>
                                  <p className="font-bold text-[11px] text-slate-600 leading-snug">{analog.name}</p>
                                  
                                  <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-1">
                                    {analog.warehouses && analog.warehouses.length > 1 ? (
                                       <select 
                                         className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-1 py-1 outline-none w-28 truncate"
                                         value={analogWhIdx}
                                         onChange={(e) => updateAnalogWarehouse(item.id, analog.id, e.target.value)}
                                       >
                                         {analog.warehouses.map((wh, idx) => (
                                           <option key={idx} value={idx}>{wh.name}</option>
                                         ))}
                                       </select>
                                     ) : (
                                       <span className="font-bold text-slate-600 text-[10px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 truncate w-24 text-center">{analogQty}</span>
                                     )}
                                     <span className="font-black text-slate-800 text-sm">{analogPrice.toLocaleString()} ₴</span>
                                  </div>
                               </div>
                             );
                           })}
                         </div>
                      ) : (
                         <div className="text-center py-4">
                           <Box className="mx-auto text-slate-300 mb-1" size={20}/>
                           <p className="text-slate-400 text-[10px] font-bold uppercase">Аналогів не знайдено</p>
                         </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {displayedResults.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-400 font-bold uppercase md:hidden">Нічого не знайдено</div>
          )}
        </div>
      )}

      {/* === МОДАЛКА ІНФОРМАЦІЇ === */}
      {infoPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto pt-10 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 md:p-8 relative shadow-2xl m-auto">
            <button onClick={() => setInfoPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Info className="text-blue-500"/> Картка товару</h2>
            
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              <div className="w-full md:w-1/3 aspect-square bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                {(detailedInfo?.images && detailedInfo.images.length > 0) ? (
                  <img src={detailedInfo.images[0]} alt="Part" className="w-full h-full object-contain p-2" />
                ) : infoPart.image_url ? (
                  <img src={infoPart.image_url} alt="Part" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center text-slate-300">
                    <ImageIcon size={48} className="mb-2"/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Немає фото</span>
                  </div>
                )}
              </div>
              
              <div className="w-full md:w-2/3 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Бренд</p>
                  <p className="font-black text-blue-600 uppercase text-lg md:text-2xl">{infoPart.brand}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Артикул</p>
                  <p className="font-black text-slate-800 text-xl md:text-3xl tracking-wide">{infoPart.article}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-sm font-medium text-slate-700 leading-snug">{infoPart.description || infoPart.name}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* ХАРАКТЕРИСТИКИ */}
                <div>
                  <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-500"/> Характеристики</h3>
                  {infoLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-blue-500">
                      <Loader2 className="animate-spin mb-3" size={32}/>
                      <span className="text-xs font-bold uppercase tracking-widest">Завантаження...</span>
                    </div>
                  ) : detailedInfo && detailedInfo.properties && detailedInfo.properties.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {detailedInfo.properties.map((prop, idx) => (
                        <div key={idx} className="flex flex-col bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{prop.name}</span>
                          <span className="text-xs md:text-sm font-black text-slate-700 leading-tight">{prop.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Характеристики недоступні</p>
                    </div>
                  )}
                </div>

                {/* ЗАСТОСОВНІСТЬ */}
                <div>
                  <h3 className="font-black uppercase text-slate-800 mb-4 flex items-center gap-2"><CarFront size={18} className="text-blue-500"/> Застосовність (Авто)</h3>
                  {infoLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-blue-500">
                      <Loader2 className="animate-spin mb-3" size={32}/>
                      <span className="text-xs font-bold uppercase tracking-widest">Завантаження...</span>
                    </div>
                  ) : detailedInfo && detailedInfo.applicability && detailedInfo.applicability.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {detailedInfo.applicability.map((car, idx) => (
                        <div key={idx} className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs md:text-sm font-bold text-blue-800">
                          {car}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Список авто недоступний</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 relative mt-10 mb-10 shadow-2xl">
            <button onClick={() => setSelectedPart(null)} className="absolute right-4 top-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2"><Plus className="text-emerald-500"/> Додати в замовлення</h2>
            
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
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Знайдіть замовлення / авто</label>
                {!selectedVisit ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Пошук..." className="w-full bg-white border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-blue-500 font-bold text-slate-700 uppercase" value={visitSearchQuery} onChange={(e) => setVisitSearchQuery(e.target.value)} />
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

    </AppPage>
  );
};

export default UniversalSearch;
