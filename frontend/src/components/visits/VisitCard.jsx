import React from 'react';
import { Clock, Wrench, CheckCircle2, Package, Truck, Phone } from 'lucide-react';

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
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="overflow-hidden">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{isStore ? 'Замовлення' : 'Номер / Час'}</p>
          <h4 className="font-black text-slate-800 text-base md:text-lg truncate">{visit.plate}</h4>
        </div>
        <div className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider shrink-0 ${getStatusStyle(visit.status)}`}>
          {getStatusText(visit.status)}
        </div>
      </div>
      
      <p className="text-xs font-bold text-slate-600 truncate">{visit.client}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate"><Phone size={10} className="shrink-0"/> {visit.phone}</p>
      
      <div className="mt-3 flex justify-between items-center border-t border-slate-50 pt-2">
        {isStore ? (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded flex items-center gap-1 truncate">
            {visit.delivery_type === 'np' ? <Truck size={10} className="text-blue-500 shrink-0"/> : <Package size={10} className="shrink-0"/>}
            {visit.delivery_type === 'np' ? 'Нова Пошта' : visit.delivery_type === 'courier' ? 'Кур\'єр' : 'Самовивіз'}
          </span>
        ) : (
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 shrink-0">
            <Clock size={12}/> {timeString}
          </span>
        )}
      </div>
    </div>
  );
};

export default VisitCard;
