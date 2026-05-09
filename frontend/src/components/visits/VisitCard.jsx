import React from 'react';
import { Car, Phone } from 'lucide-react';

const VisitCard = ({ visit, onClick }) => {
  // Кольори для статусів
  const statusColors = {
    'PENDING': 'bg-slate-100 text-slate-600 border-slate-200',
    'SELECTION': 'bg-slate-100 text-slate-600 border-slate-200',
    'IN_PROGRESS': 'bg-blue-50 text-blue-600 border-blue-200',
    'DONE': 'bg-green-50 text-green-600 border-green-200'
  };
  
  const statusLabels = {
    'PENDING': 'В черзі',
    'SELECTION': 'В черзі',
    'IN_PROGRESS': 'В роботі',
    'DONE': 'Готово'
  };

  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer hover:border-blue-300">
      <div className="absolute top-0 right-0 p-3">
         <Car className="text-slate-100 group-hover:text-blue-50/50 transition-colors" size={48} />
      </div>
      
      <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Номерний знак</p>
      <h3 className="text-lg font-black text-slate-900 mb-4">{visit.plate}</h3>
      
      <div className="space-y-3 mb-5">
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Клієнт / Автомобіль</p>
          <p className="text-sm font-bold text-slate-700 truncate">{visit.client}</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Phone size={12}/>
          <span className="text-xs font-medium">{visit.phone}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative z-10">
        <span className={`text-[10px] font-black px-3 py-1 rounded-full text-center uppercase border ${statusColors[visit.status]}`}>
          {statusLabels[visit.status]}
        </span>
        <button className="w-full bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-900 py-2 rounded-xl text-[11px] font-black uppercase transition-all">
          Відкрити картку
        </button>
      </div>
    </div>
  );
};

export default VisitCard;
