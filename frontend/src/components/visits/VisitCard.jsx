import React from 'react';
import { Clock, Wrench, CheckCircle2, Package, Truck, Phone, Car } from 'lucide-react';

const VisitCard = ({ visit, onClick, isStore }) => {
  // Кольори для різних статусів (Магазин vs СТО)
  const getStatusStyle = (status) => {
    if (isStore) {
        if (status === 'PENDING' || status === 'SELECTION') return 'bg-slate-100 text-slate-600';
        if (status === 'IN_PROGRESS') return 'bg-orange-100 text-orange-600';
        if (status === 'DONE') return 'bg-blue-100 text-blue-600';
        if (status === 'COMPLETED') return 'bg-green-100 text-green-600';
    } else {
        if (status === 'PENDING' || status === 'SELECTION') return 'bg-slate-100 text-slate-600';
        if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-600';
        if (status === 'DONE') return 'bg-green-100 text-green-600';
    }
    return 'bg-slate-100 text-slate-600';
  };

  const getStatusText = (status) => {
    if (isStore) {
        if (status === 'PENDING' || status === 'SELECTION') return 'Нове';
        if (status === 'IN_PROGRESS') return 'Чекає деталі';
        if (status === 'DONE') return 'Відправка';
        if (status === 'COMPLETED') return 'Виконано';
    } else {
        if (status === 'PENDING' || status === 'SELECTION') return 'В черзі';
        if (status === 'IN_PROGRESS') return 'В роботі';
        if (status === 'DONE') return 'Готово';
    }
    return status;
  };

  const timeString = visit.scheduled_datetime 
    ? new Date(visit.scheduled_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    : new Date(visit.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  return (
    <div onClick={onClick} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
      
      {/* Верхній блок: Ім'я клієнта та Статус */}
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="overflow-hidden">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
            {isStore ? 'Клієнт (Замовлення)' : 'Клієнт'}
          </p>
          <h4 className="font-black text-slate-800 text-sm md:text-base truncate">
            {visit.client || 'Невідомий клієнт'}
          </h4>
        </div>
        <div className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider shrink-0 ${getStatusStyle(visit.status)}`}>
          {getStatusText(visit.status)}
        </div>
      </div>
      
      {/* Середній блок: Авто та Номер телефону */}
      <div className="flex flex-col gap-1 mt-1">
        <p className="text-xs font-bold text-slate-700 bg-slate-50 p-1.5 rounded flex items-center gap-1.5 border border-slate-100">
          <Car size={12} className="text-slate-400 shrink-0"/> 
          {visit.plate} {visit.vin_code ? <span className="text-[10px] text-slate-400 font-normal ml-1">({visit.vin_code.slice(-6)})</span> : ''}
        </p>
        <p className="text-[10px] text-slate-400 flex items-center gap-1 pl-1">
          <Phone size={10} className="shrink-0"/> {visit.phone || '—'}
        </p>
      </div>
      
      {/* Нижній блок: Час / Доставка */}
      <div className="mt-3 flex justify-between items-center border-t border-slate-50 pt-2">
        {isStore ? (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded flex items-center gap-1 truncate">
            {visit.delivery_type === 'np' ? <Truck size={10} className="text-blue-500 shrink-0"/> : <Package size={10} className="shrink-0"/>}
            {visit.delivery_type === 'np' ? 'Нова Пошта' : visit.delivery_type === 'courier' ? 'Кур\'єр' : 'Самовивіз'}
          </span>
        ) : (
          <div className="flex justify-between w-full items-center">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 shrink-0">
              <Clock size={12}/> {timeString}
            </span>
            {/* Виведення пробігу на картку, якщо він є */}
            {visit.mileage && (
              <span className="text-[10px] font-medium text-slate-400">
                {visit.mileage} км
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitCard;
