import React, { useState } from 'react';
import VisitCard from '../components/visits/VisitCard';
import { Plus, X } from 'lucide-react';

const Dashboard = () => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [visits, setVisits] = useState([
    { id: 1, plate: 'AA1234BB', client: 'Skoda Octavia A7', phone: '093-325-63-87', status: 'ORDERED', statusText: 'ОЧІКУЄ ЗАПЧАСТИНИ', step: 'В роботі: Сервіс' },
  ]);

  const [newVisit, setNewVisit] = useState({ plate: '', client: '', phone: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    const id = visits.length + 1;
    setVisits([...visits, { ...newVisit, id, status: 'SELECTION', statusText: 'НОВИЙ ВІЗИТ', step: 'Тільки що додано' }]);
    setModalOpen(false);
    setNewVisit({ plate: '', client: '', phone: '' });
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-black uppercase italic">Активні Візити</h1>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={18}/> НОВИЙ ВІЗИТ
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visits.map(v => <VisitCard key={v.id} visit={v} />)}
      </div>

      {/* МОДАЛЬНЕ ВІКНО ДОДАВАННЯ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-red-500"><X/></button>
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Реєстрація авто</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Держ. Номер</label>
                <input required value={newVisit.plate} onChange={e => setNewVisit({...newVisit, plate: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" placeholder="AA0000BB"/>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Марка / Модель</label>
                <input required value={newVisit.client} onChange={e => setNewVisit({...newVisit, client: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" placeholder="BMW X5"/>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Телефон клієнта</label>
                <input required value={newVisit.phone} onChange={e => setNewVisit({...newVisit, phone: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" placeholder="067..."/>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase mt-4 hover:bg-black transition-colors">Створити візит</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
