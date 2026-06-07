import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowRight, Boxes, Building2, CarFront, Loader2, Package, Search, Truck, UserRound, X } from 'lucide-react';
import api from '../../api/axios';

const iconMap = {
  order: Package,
  car: CarFront,
  client: UserRound,
  part: Boxes,
  stock: Archive,
  supplier: Building2,
  search: Search,
  delivery: Truck,
};

const kindLabel = {
  visit: 'Замовлення / візит',
  client: 'Клієнти',
  order_part: 'Товари в замовленнях',
  inventory: 'Склад',
  supplier: 'Постачальники',
  external_parts: 'Пошук запчастин',
};

export default function GlobalSearchBox({ compact = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setGroups({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/global-search/?q=${encodeURIComponent(q)}&limit=28`);
        setResults(res.data?.results || []);
        setGroups(res.data?.groups || {});
        setActiveIndex(0);
        setOpen(true);
      } catch (e) {
        console.error('Global search error', e);
        setResults([]);
        setGroups({});
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [query]);

  const groupedResults = useMemo(() => {
    const map = {};
    results.forEach((item) => {
      if (!map[item.kind]) map[item.kind] = [];
      map[item.kind].push(item);
    });
    return map;
  }, [results]);

  const flatResults = results;

  const openResult = (item) => {
    if (!item?.url) return;
    setOpen(false);
    setQuery('');
    navigate(item.url);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && flatResults[activeIndex]) {
        openResult(flatResults[activeIndex]);
      } else if (query.trim()) {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        setQuery('');
        setOpen(false);
      }
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(flatResults.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${compact ? 'w-full max-w-[170px] sm:max-w-[260px] md:max-w-xl' : 'w-full'}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        type="text"
        placeholder="Пошук: №, телефон, клієнт, VIN, авто, артикул, ТТН..."
        className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-full text-xs md:text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-slate-800 placeholder:normal-case placeholder:font-semibold"
        value={query}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" size={16} />}
      {!loading && query && <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-slate-200 text-slate-400 flex items-center justify-center"><X size={14}/></button>}

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-[calc(100%+10px)] w-[min(92vw,760px)] bg-white border border-slate-200 rounded-[26px] shadow-2xl z-[80] overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-slate-900 uppercase text-sm">Глобальний пошук</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">Шукає по замовленнях, клієнтах, складу, товарах, ТТН і постачальниках.</p>
              </div>
              <span className="bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-black text-slate-600 shrink-0">{results.length}</span>
            </div>
            {Object.keys(groups).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.entries(groups).map(([key, count]) => <span key={key} className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500">{kindLabel[key] || key}: {count}</span>)}
              </div>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading && <div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Шукаємо...</div>}
            {!loading && results.length === 0 && (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-3xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3"><Search size={24}/></div>
                <p className="font-black text-slate-800">Нічого не знайдено</p>
                <p className="text-sm font-semibold text-slate-500 mt-1">Натисни Enter, щоб пошукати як артикул у постачальників.</p>
              </div>
            )}
            {!loading && Object.entries(groupedResults).map(([kind, items]) => (
              <div key={kind} className="mb-2">
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{kindLabel[kind] || kind}</p>
                {items.map((item) => {
                  const globalIndex = flatResults.indexOf(item);
                  const Icon = iconMap[item.icon] || Search;
                  const active = globalIndex === activeIndex;
                  return (
                    <button key={`${item.kind}-${item.url}-${item.title}-${globalIndex}`} onClick={() => openResult(item)} onMouseEnter={() => setActiveIndex(globalIndex)} className={`w-full text-left rounded-2xl p-3 flex items-center gap-3 transition ${active ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50 border-transparent'} border`}>
                      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={18}/></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-slate-900 truncate">{item.title}</span>
                        {item.subtitle && <span className="block text-sm font-semibold text-slate-600 truncate mt-0.5">{item.subtitle}</span>}
                        {item.meta && <span className="block text-xs font-semibold text-slate-400 truncate mt-0.5">{item.meta}</span>}
                      </span>
                      {item.badge && <span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 shrink-0">{item.badge}</span>}
                      <ArrowRight size={17} className="text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
