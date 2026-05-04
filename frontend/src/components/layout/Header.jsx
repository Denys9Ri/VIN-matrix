import React from 'react';
import { Search, Moon } from 'lucide-react';

const Header = () => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <span className="font-semibold text-slate-700 whitespace-nowrap">Швидкий пошук</span>
      </div>

      <div className="flex items-center gap-8 ml-4">
        <div className="flex flex-col text-xs font-medium">
          <span className="text-slate-500 mb-1">Фінансове зведення</span>
          <div className="flex gap-4">
            <div>
              <span className="text-slate-500 block text-[10px]">Обіг UAH</span>
              <span className="text-slate-900 text-sm">29,933 ₴</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Маржа UAH</span>
              <span className="text-green-500 text-sm">4,500 ₴</span>
            </div>
          </div>
        </div>

        <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <Moon size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
