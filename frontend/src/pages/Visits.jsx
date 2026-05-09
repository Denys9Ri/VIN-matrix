import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard'; 

const Visits = () => {
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]); 
  const [role, setRole] = useState(null); // Початково null, щоб знати, що дані вантажаться
  const [loading, setLoading] = useState(true);
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false); 
  const [showManualPartForm, setShowManualPartForm] = useState(false); 
  
  const [newVisitData, setNewVisitData] = useState({ plate: '', client: '', phone: '' });
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const partStatusColors = { 'WAITING': 'text-orange-600 bg-orange-100', 'IN_TRANSIT': 'text-blue-600 bg-blue-100', 'ARRIVED': 'text-green-600 bg-green-100', 'UNAVAILABLE': 'text-red-600 bg-red-100' };
  const serviceStatusColors = { 'PENDING': 'text-slate-600 bg-slate-100', 'IN_PROGRESS': 'text-blue-600 bg-blue-100', 'DONE': 'text-green-600 bg-green-100' };

  const fetchData = async () => {
    try {
      const [visitsRes, settingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/services/`, { headers: { Authorization: `Bearer ${token}` } }) 
      ]);
      setVisits(visitsRes.data || []);
      setRole(settingsRes.data.role);
      setCatalogServices(servicesRes.data || []);
    } catch (error) { 
        console.error("Помилка завантаження даних", error);
        // Якщо помилка 401 - на логін
        if (error.response?.status === 401) navigate('/login');
        // Якщо інша помилка - ставимо дефолтну роль, щоб сторінка не пуста була
        setRole('owner'); 
    } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateVisit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/visits/`, newVisitData, { headers: { Authorization: `Bearer ${token}` } });
      setIsCreatingVisit(false);
      setNewVisitData({ plate: '', client: '', phone: '' });
      fetchData(); 
    } catch (error) { alert("Помилка створення візиту"); }
  };

  const updateVisitStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      if (selectedVisit) setSelectedVisit({ ...selectedVisit, status: newStatus });
    } catch (error) { alert("Помилка статусу"); }
  };

  const updateServiceStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/order-services/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const updatePartStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/order-parts/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

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
      await axios.post(`${API_BASE}/api/order-parts/`, { ...newPart, visit: selectedVisit.id, supplier: newPart.supplier || 'Вручну' }, { headers: { Authorization: `Bearer ${token}` } });
      setNewPart({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });
      setShowManualPartForm(false);
      refreshSelectedVisit();
    } catch (error) { alert("Помилка"); }
  };

  const handleDeleteService = async (id) => {
    if(window.confirm("Видалити послугу?")) {
        await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        refreshSelectedVisit();
    }
  };

  const handleDeletePart = async (id) => {
    if(window.confirm("Видалити запчастину?")) {
        await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
        refreshSelectedVisit();
    }
  };

  const refreshSelectedVisit = async () => {
    const res = await axios.get(`${API_BASE}/api/visits/${selectedVisit.id}/`, { headers: { Authorization: `Bearer ${token}` } });
    setSelectedVisit(res.data);
    fetchData(); 
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black italic">R16 ЗАВАНТАЖЕННЯ...</div>;

  const pending = visits.filter(v => v.status === 'PENDING' || v.status === 'SELECTION');
  const inProgress = visits.filter(v => v.status === 'IN_PROGRESS');
  const done = visits.filter(v => v.status === 'DONE');

  const Column = ({ title, icon, items, colorClass }) => (
    <div className="bg-slate-50/50 rounded-3xl p-4 flex flex-col h-full border border-slate-100">
      <h3 className={`font-black uppercase tracking-wider text-sm flex items-center gap-2 mb-4 ${colorClass}`}>
        {icon} {title} <span className="ml-auto bg-white px-2 py-1 rounded-lg shadow-sm text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-4 flex-1 overflow-y-auto pr-1 pb-10">
        {items.map(visit => (
          <VisitCard key={visit.id} visit={visit} onClick={() => setSelectedVisit(visit)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 md:pl-72 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black uppercase italic">Дошка Візитів</h1>
        {role !== 'mechanic' && (
           <button onClick={() => setIsCreatingVisit(true)} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]">
             <Plus size={16}/> Нове авто
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Column title="В черзі" icon={<Clock size={18}/>} items={pending} colorClass="text-slate-600" />
        <Column title="В роботі" icon={<Wrench size={18}/>} items={inProgress} colorClass="text-blue-600" />
        <Column title="Готово" icon={<CheckCircle2 size={18}/>} items={done} colorClass="text-green-600" />
      </div>

      {/* МОДАЛКА СТВОРЕННЯ */}
      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsCreatingVisit(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><CarFront className="text-blue-600"/> Новий візит</h2>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <input required type="text" placeholder="Номер авто (АА1234ВВ)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})}/>
              <input required type="text" placeholder="Клієнт / Марка" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
              <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase shadow-lg shadow-blue-200">Відкрити замовлення</button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ДЕТАЛЕЙ (Аналогічно попередній, з вибором статусів) */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-3xl font-black uppercase">{selectedVisit.plate}</h2>
                <p className="text-slate-500 font-bold flex items-center gap-2 mt-1"><CarFront size={16}/> {selectedVisit.client} | <Phone size={16}/> {selectedVisit.phone}</p>
              </div>
              <button onClick={() => setSelectedVisit(null)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl mb-6">
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'PENDING')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'IN_PROGRESS')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow-md shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
              <button onClick={() => updateVisitStatus(selectedVisit.id, 'DONE')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow-md shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Wrench size={18}/> Завдання</h3>
                <div className="space-y-3 mb-4">
                  {selectedVisit.services?.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 group">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                        <div className="flex items-center gap-3">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{s.price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeleteService(s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      <select value={s.status || 'PENDING'} onChange={(e) => updateServiceStatus(s.id, e.target.value)} className={`text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none cursor-pointer border-none w-full ${serviceStatusColors[s.status || 'PENDING']}`}>
                        <option value="PENDING">⏳ Очікує</option>
                        <option value="IN_PROGRESS">🔧 В роботі</option>
                        <option value="DONE">✅ Виконано</option>
                      </select>
                    </div>
                  ))}
                </div>
                {role === 'owner' && (
                  <form onSubmit={handleAddService} className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-2">
                    <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer text-slate-600" onChange={(e) => { const s = catalogServices.find(cat => cat.id === parseInt(e.target.value)); if (s) setNewService({ name: s.name, price: s.price }); }} defaultValue="">
                        <option value="" disabled>Оберіть з прайсу...</option>
                        {catalogServices.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price} ₴</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input required type="text" placeholder="Назва" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                      <input required type="number" placeholder="Ціна" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={18}/></button>
                    </div>
                  </form>
                )}
              </div>

              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Store size={18}/> Запчастини</h3>
                <div className="space-y-3 mb-4">
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{p.name}</p>
                          <p className="text-[9px] uppercase font-bold text-slate-500 mt-1">{p.brand} | {p.article}</p>
                          {role === 'owner' && <p className="text-[9px] uppercase font-bold text-blue-500 mt-1">Де: {p.supplier}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{p.sell_price} ₴</span>}
                          {role === 'owner' && <button onClick={() => handleDeletePart(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                        </div>
                      </div>
                      <select value={p.status || 'WAITING'} onChange={(e) => updatePartStatus(p.id, e.target.value)} className={`text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-2 outline-none cursor-pointer border-none w-full ${partStatusColors[p.status || 'WAITING']}`}>
                        <option value="WAITING">⏳ Очікується</option>
                        <option value="IN_TRANSIT">🚚 В дорозі</option>
                        <option value="ARRIVED">✅ Приїхала</option>
                        <option value="UNAVAILABLE">❌ Не буде</option>
                      </select>
                    </div>
                  ))}
                </div>
                {role === 'owner' && (
                  <div className="mt-4">
                    {!showManualPartForm ? (
                      <button onClick={() => setShowManualPartForm(true)} className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all">✏️ Додати вручну</button>
                    ) : (
                      <form onSubmit={handleAddPart} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                        <button type="button" onClick={() => setShowManualPartForm(false)} className="absolute right-2 top-2 text-slate-400"><X size={14}/></button>
                        <input required type="text" placeholder="Назва деталі" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                        <input required type="text" placeholder="Постачальник / Де замовлено" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.supplier} onChange={e => setNewPart({...newPart, supplier: e.target.value})} />
                        <div className="flex gap-2">
                          <input type="text" placeholder="Бренд" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.brand} onChange={e => setNewPart({...newPart, brand: e.target.value})} />
                          <input type="text" placeholder="Артикул" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.article} onChange={e => setNewPart({...newPart, article: e.target.value})} />
                        </div>
                        <div className="flex gap-2 items-center bg-white p-2 rounded-lg">
                          <input type="number" placeholder="Закупка" className="w-1/2 bg-transparent border-none text-sm outline-none" value={newPart.buy_price} onChange={e => setNewPart({...newPart, buy_price: e.target.value})} />
                          <input type="number" placeholder="Продаж" className="w-1/2 bg-transparent border-none text-sm outline-none font-black text-blue-600" value={newPart.sell_price} onChange={e => setNewPart({...newPart, sell_price: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase text-xs py-3 rounded-lg mt-2">Зберегти</button>
                      </form>
                    )}
                  </div>
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
