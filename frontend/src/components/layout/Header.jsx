import React, { useState } from 'react';
import { Search, Moon, Sun, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleQuickSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      navigate(`/search?part_number=${query}`);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Швидкий пошук (Артикул + Enter)"
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleQuickSearch}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden lg:flex items-center gap-4 border-r pr-6 border-slate-200">
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Обіг сьогодні</p>
            <p className="text-sm font-black text-slate-900">29,933 ₴</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-400 font-bold">Маржа</p>
            <p className="text-sm font-black text-green-600">+4,500 ₴</p>
          </div>
        </div>

        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
          DR
        </div>
      </div>
    </header>
  );
};

export default Header;
