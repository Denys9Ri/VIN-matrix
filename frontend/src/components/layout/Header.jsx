import React, { useEffect, useState } from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import ClientCodeBadge from './ClientCodeBadge';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const Header = ({ toggleMenu }) => {
  const [query, setQuery] = useState('');
  const [clientCode, setClientCode] = useState(null);
  const navigate = useNavigate();

  const handleQuickSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      // Передаємо запит через параметр q
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery(''); // Очищаємо поле після переходу
    }
  };

  useEffect(() => {
    const loadClientCode = async () => {
      try {
        const res = await api.get('/api/platform-clients/');
        if (Array.isArray(res.data) && res.data.length === 1) {
          setClientCode(res.data[0]?.client_code || null);
        }
      } catch (e) {}
    };
    loadClientCode();
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 shadow-sm w-full">
      <div className="flex items-center gap-2 md:gap-3 flex-1">
        <button 
          onClick={toggleMenu} 
          className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
        >
          <Menu size={24} />
        </button>

        {/* Компактний швидкий пошук */}
        <div className="relative w-full max-w-[160px] sm:max-w-[200px] md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Артикул..."
            className="w-full pl-8 pr-3 py-1.5 md:py-2 bg-slate-100 border border-slate-200 rounded-full text-xs md:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-700 uppercase placeholder:normal-case placeholder:font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleQuickSearch}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 ml-2 shrink-0">
        <ClientCodeBadge clientCode={clientCode} />

        <div className="hidden lg:flex items-center gap-4 border-r pr-6 border-slate-200">
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Обіг сьогодні</p>
            <p className="text-sm font-black text-slate-900">29,933 ₴</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Маржа</p>
            <p className="text-sm font-black text-emerald-500">+4,500 ₴</p>
          </div>
        </div>

        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 md:w-9 md:h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shrink-0 shadow-md shadow-blue-200">
          DR
        </div>
      </div>
    </header>
  );
};

export default Header;
