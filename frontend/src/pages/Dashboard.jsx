import React from 'react';
import VisitCard from '../components/visits/VisitCard';
import { Plus } from 'lucide-react';

const Dashboard = () => {
  const mockVisits = [
    { id: 1, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '093-325-63-87', status: 'ORDERED', statusText: 'ОЧІКУЄ ЗАПЧАСТИНИ', step: 'В роботі: Сервіс' },
    { id: 2, plate: 'BC7777EX', client: 'VW Passat B8', phone: '067-123-45-67', status: 'IN_TRANSIT', statusText: 'В ДОРОЗІ', step: 'Очікує прибуття' },
    { id: 3, plate: 'AI8888HI', client: 'BMW X5 (G05)', phone: '050-999-88-77', status: 'SELECTION', statusText: 'ПІДБІР ЗАПЧАСТИН', step: 'Уточнення аналогів' },
    { id: 4, plate: 'AA0001AA', client: 'Audi A6', phone: '099-000-11-22', status: 'ARRIVED', statusText: 'ГОТОВО ДО ВИДАЧІ', step: 'Фіналізація чеку' },
  ];

  return (
    <div className="max-w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Активні Візити</h1>
          <p className="text-slate-500 text-sm">Керування поточними автомобілями на СТО</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all w-full sm:w-auto justify-center">
          <Plus size={20} />
          <span>НОВИЙ ВІЗИТ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mockVisits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
