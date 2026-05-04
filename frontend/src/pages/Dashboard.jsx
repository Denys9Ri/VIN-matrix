import React, { useState, useEffect } from 'react';
import VisitCard from '../components/visits/VisitCard';
import { Plus, X, Loader2 } from 'lucide-react';
import api from '../api/axios'; // Підключення до нашого бекенду

const Dashboard = () => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [visits, setVisits] = useState([]);
  const [newVisit, setNewVisit] = useState({ plate: '', client: '', phone: '' });
  const [loading, setLoading] = useState(true);

  // 1. Завантаження візитів з бази даних при старті
  const fetchVisits = async () => {
    try {
      const res = await api.get('/core/visits/');
      setVisits(res.data);
    } catch (e) {
      console.error("Помилка завантаження візитів", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  // 2. Збереження нового візиту в базу даних
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/core/visits/', newVisit);
      setModalOpen(false);
      setNewVisit({ plate: '', client: '', phone: '' });
      fetchVisits(); // Оновлюємо список, щоб побачити нову машину
    } catch (e) {
      alert("Сталася помилка при збереженні візиту");
      console.error(e);
    }
  };

  // Показуємо спінер, поки дані завантажуються
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold uppercase tracking-widest text-sm">Завантаження візитів...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-black uppercase italic">Активні Візити</h1>
          <p className="text-xs text-slate-400 font-bold uppercase">Оперативне керування СТО</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"
        >
          <Plus size={18}/> НОВИЙ ВІЗИТ
        </button>
      </div>

      {visits.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visits.map(v => <VisitCard key={v.id} visit={v} />)}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
          <p className="text-slate-400 font-bold uppercase text-sm">Список візитів порожній</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-red-500">
              <X />
            </button>
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Реєстрація авто</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <input 
                required 
                value={newVisit.plate} 
                onChange={e => setNewVisit({...newVisit, plate: e.target.value})} 
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all" 
                placeholder="Держ. Номер (AA0000BB)"
              />
              <input 
                required 
                value={newVisit.client} 
                onChange={e => setNewVisit({...newVisit, client: e.target.value})} 
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all" 
                placeholder="Марка / Модель"
              />
              <input 
                required 
                value={newVisit.phone} 
                onChange={e => setNewVisit({...newVisit, phone: e.target.value})} 
                className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all" 
                placeholder="Телефон клієнта"
              />
              <button 
                type="submit" 
                className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black uppercase mt-4 transition-all shadow-lg"
              >
                Створити візит
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
