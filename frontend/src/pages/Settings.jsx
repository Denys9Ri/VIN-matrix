import React from 'react';
import { LogOut, Shield, User, Bell } from 'lucide-react';

const Settings = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-black uppercase mb-8 italic">Налаштування</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><User size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Мій профіль</p>
              <p className="text-slate-400 text-sm">Денис (Адмін)</p>
            </div>
          </div>
          <button className="text-blue-600 font-bold text-sm">Редагувати</button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl text-red-600"><LogOut size={24}/></div>
            <div>
              <p className="font-black text-slate-900">Вихід із системи</p>
              <p className="text-slate-400 text-sm">Завершити поточну сесію</p>
            </div>
          </div>
          <button className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">Вийти</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
