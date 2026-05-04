import React from 'react';
import { Car } from 'lucide-react';

const VisitCard = ({ visit }) => {
  // Функція, яка підбирає кольори залежно від статусу
  const getStatusStyle = (status) => {
    switch (status) {
      case 'ORDERED':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'IN_TRANSIT':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'SELECTION':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'ARRIVED':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  // Визначаємо, яку іконку показувати в статусі (крапка або прапорець)
  const renderStatusIcon = (status) => {
    if (status === 'ARRIVED') {
      return <span className="mr-2">🏁</span>;
    }
    // Кольорова крапка для інших статусів
    const dotColor = status === 'ORDERED' ? 'bg-red-500' : 
                     status === 'IN_TRANSIT' ? 'bg-amber-500' : 'bg-green-500';
    return <span className={`w-2 h-2 rounded-full ${dotColor} mr-2`}></span>;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-colors">
      
      {/* Шапка: Іконка авто і Номер */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-slate-500 dark:text-slate-400">
          <Car size={40} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Номерний знак</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{visit.plate}</p>
        </div>
      </div>

      {/* Інформація про клієнта */}
      <div className="text-sm mb-4 space-y-1">
        <p className="text-slate-600 dark:text-slate-300">
          Client Name: <span className="font-semibold text-slate-900 dark:text-white">{visit.client}</span>
        </p>
        <p className="text-slate-600 dark:text-slate-300">
          Phone: <span className="font-semibold text-slate-900 dark:text-white">{visit.phone}</span>
        </p>
      </div>

      {/* Статус (Світлофор) */}
      <div className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold mb-4 w-max ${getStatusStyle(visit.status)}`}>
        {renderStatusIcon(visit.status)}
        {visit.statusText}
      </div>

      {/* Етап роботи */}
      <div className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold py-2 rounded-md text-center mb-4">
        {visit.step}
      </div>

      {/* Кнопка */}
      <button className="mt-auto w-full py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
        VIEW BASKET
      </button>
      
    </div>
  );
};

export default VisitCard;
