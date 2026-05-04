import React from 'react';
import { Search, Moon } from 'lucide-react';

const Header = () => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
      
      {/* Ліва частина: Рядок пошуку */}
      <div className="flex items-center gap-4 flex-1">
        <span className="font-semibold text-slate-700 whitespace-nowrap">Universal Search</span>
        <div className="relative w-full max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="VIN: Enter 17-char VIN... or Article: Number"
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Права частина: Фінанси та Тема */}
      <div className="flex items-center gap-8 ml-4">
        {/* Блок з грошима (З макета) */}
        <div className="flex flex-col text-xs font-medium">
          <span className="text-slate-500 mb-1">Daily financial summary</span>
          <div className="flex gap-4">
            <div>
              <span className="text-slate-500 block text-[10px]">Revenue UAH</span>
              <span className="text-slate-900 text-sm">29,933 ₴</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Costs UAH</span>
              <span className="text-red-500 text-sm">0,00 ₴</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Margin UAH</span>
              <span className="text-green-500 text-sm">0,00 ₴</span>
            </div>
          </div>
        </div>

        {/* Перемикач теми (Тимчасова заглушка) */}
        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <Moon size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
