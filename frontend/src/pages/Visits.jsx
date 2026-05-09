import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Trash2 } from 'lucide-react';

const Visits = () => {
  const [visits, setVisits] = useState([]);
  const [role, setRole] = useState('mechanic');
  const [loading, setLoading] = useState(true);
  
  // Модалка і вибраний візит
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // Дані для додавання нових елементів
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const fetchData = async () => {
    try {
      const [visitsRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setVisits(visitsRes.data);
      setRole(settingsRes.data.role);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Оновлення статусу (В черзі -> В роботі -> Готово)
  const updateStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      if (selectedVisit) setSelectedVisit({ ...selectedVisit, status: newStatus });
    } catch (error) { alert("Помилка оновлення статусу"); }
  };

  // --- ЛОГІКА ДОДАВАННЯ (Тільки для Власника) ---
  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/order-services/`, { ...newService, visit: selectedVisit.id }, { headers: { Authorization: `Bearer ${token}` } });
      setNewService({ name: '', price: '' });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/order-parts/`, { ...newPart, visit: selectedVisit.id }, { headers: { Authorization: `Bearer ${token}` } });
      setNewPart({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const refreshSelectedVisit = async () => {
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
    setSelectedVisit(res.data);
    fetchData(); // Оновлюємо фон
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">R16 ЗАВАНТАЖЕННЯ...</div>;

  // Розділяємо візити по колонках
  const pending = visits.filter(v => v.status === 'PENDING' || v.status === 'SELECTION');
  const inProgress = visits.filter(v => v.status === 'IN_PROGRESS');
  const done = visits.filter(v => v.status === 'DONE');

  const Column = ({ title, icon, items, colorClass }) => (
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col h-full border border-slate-100">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>
        {icon} {title} <span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-3 flex-1 overflow-y-auto">
        {items.map(visit => (
          <div 
            key={visit.id} 
            onClick={() => setSelectedVisit(visit)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-300 transition-all hover:shadow-md group"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-black text-slate-800 text-lg bg-slate-100 px-2 py-1 rounded-lg">{visit.plate}</span>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{new Date(visit.created_at).toLocaleDateString()}</span>
            </div>
            {role === 'owner' && <p className="text-sm font-bold text-slate-600 flex items-center gap-2"><CarFront size={14}/> {visit.client}</p>}
            <div className="mt-3 flex gap-2">
              <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">Роботи: {visit.services?.length || 0}</span>
              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md">Запчастини: {visit.parts?.length || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black uppercase italic">Дошка Візитів</h1>
        {role === 'owner' && (
           <button className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200">
             <Plus size={18}/> Нове авто
           </button>
        )}
      </div>

      {/* КАНБАН ДОШКА */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Column title="В черзі / Підбір" icon={<Clock size={18}/>} items={pending} colorClass="text-slate-600" />
        <Column title="В роботі" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
        <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
      </div>

      {/* МОДАЛКА ВІЗИТУ */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-3xl font-black uppercase">{selectedVisit.plate}</h2>
                {role === 'owner' && <p className="text-slate-500 font-bold flex items-center gap-2 mt-1"><CarFront size={16}/> {selectedVisit.client} | <Phone size={16}/> {selectedVisit.phone}</p>}
              </div>
              <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20} /></button>
            </div>

            {/* ПАНЕЛЬ СТАТУСІВ */}
            <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl mb-6">
              <button onClick={() => updateStatus(selectedVisit.id, 'PENDING')} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
              <button onClick={() => updateStatus(selectedVisit.id, 'IN_PROGRESS')} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow-md shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
              <button onClick={() => updateStatus(selectedVisit.id, 'DONE')} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow-md shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* КОЛОНКА РОБІТ */}
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Wrench size={18}/> Завдання (Роботи)</h3>
                <div className="space-y-2 mb-4">
                  {selectedVisit.services?.length === 0 && <p className="text-sm text-slate-400 italic">Роботи ще не додані</p>}
                  {selectedVisit.services?.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between">
                      <span className="font-bold text-slate-700">{s.name}</span>
                      {role === 'owner' && <span className="font-black text-slate-900">{s.price} ₴</span>}
                    </div>
                  ))}
                </div>
                {/* Форма додавання тільки для власника */}
                {role === 'owner' && (
                  <form onSubmit={handleAddService} className="flex gap-2">
                    <input required type="text" placeholder="Що зробити?" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                    <input required type="number" placeholder="Ціна" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                    <button type="submit" className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Plus size={18}/></button>
                  </form>
                )}
              </div>

              {/* КОЛОНКА ЗАПЧАСТИН */}
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Store size={18}/> Запчастини</h3>
                <div className="space-y-2 mb-4">
                  {selectedVisit.parts?.length === 0 && <p className="text-sm text-slate-400 italic">Запчастини не потрібні</p>}
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-700">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.brand} | Арт: {p.article}</p>
                      </div>
                      {role === 'owner' && <span className="font-black text-slate-900">{p.sell_price} ₴</span>}
                    </div>
                  ))}
                </div>
                {/* Форма додавання тільки для власника */}
                {role === 'owner' && (
                  <form onSubmit={handleAddPart} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <input required type="text" placeholder="Назва запчастини" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                    <div className="flex gap-2">
                      <input type="text" placeholder="Бренд" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.brand} onChange={e => setNewPart({...newPart, brand: e.target.value})} />
                      <input type="text" placeholder="Артикул" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.article} onChange={e => setNewPart({...newPart, article: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <input required type="number" placeholder="Закупка" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.buy_price} onChange={e => setNewPart({...newPart, buy_price: e.target.value})} />
                      <input required type="number" placeholder="Продаж" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-black text-blue-600" value={newPart.sell_price} onChange={e => setNewPart({...newPart, sell_price: e.target.value})} />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm mt-2">Додати запчастину</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
