import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CarFront, Phone, Clock, CheckCircle2, Wrench, X, Store, Pencil, List } from 'lucide-react';
import VisitCard from '../components/visits/VisitCard'; 

const Visits = () => {
  const [visits, setVisits] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]); // Стан для прайс-листа
  const [role, setRole] = useState('mechanic');
  const [loading, setLoading] = useState(true);
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isCreatingVisit, setIsCreatingVisit] = useState(false); 
  const [showManualPartForm, setShowManualPartForm] = useState(false); // Тогл для ручного додавання запчастин
  
  const [newVisitData, setNewVisitData] = useState({ plate: '', client: '', phone: '' });
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newPart, setNewPart] = useState({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });

  const API_BASE = "http://c7flj95csavoasntnnxolemw.95.217.211.207.sslip.io";
  const token = localStorage.getItem('access_token');

  const fetchData = async () => {
    try {
      const [visitsRes, settingsRes, servicesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/visits/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/api/services/`, { headers: { Authorization: `Bearer ${token}` } }) // Завантажуємо прайс
      ]);
      setVisits(visitsRes.data);
      setRole(settingsRes.data.role);
      setCatalogServices(servicesRes.data);
    } catch (error) { console.error(error); } 
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

  const updateStatus = async (id, newStatus) => {
    try {
      await axios.patch(`${API_BASE}/api/visits/${id}/`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      if (selectedVisit) setSelectedVisit({ ...selectedVisit, status: newStatus });
    } catch (error) { alert("Помилка оновлення статусу"); }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if(!newService.name || !newService.price) return;
    try {
      await axios.post(`${API_BASE}/api/order-services/`, { ...newService, visit: selectedVisit.id }, { headers: { Authorization: `Bearer ${token}` } });
      setNewService({ name: '', price: '' });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка при додаванні послуги"); }
  };

  const handleAddPart = async (e) => {
    e.preventDefault();
    // Страхуємось від пустих значень, щоб бекенд не видавав помилку
    const payload = {
      ...newPart,
      visit: selectedVisit.id,
      brand: newPart.brand || '-',
      article: newPart.article || '-',
      buy_price: newPart.buy_price || 0,
      sell_price: newPart.sell_price || 0,
      supplier: 'Вручну'
    };

    try {
      await axios.post(`${API_BASE}/api/order-parts/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setNewPart({ name: '', brand: '', article: '', buy_price: '', sell_price: '', supplier: '' });
      setShowManualPartForm(false); // Ховаємо форму після успішного додавання
      refreshSelectedVisit();
    } catch (error) { alert("Помилка при додаванні деталі. Перевірте поля."); }
  };

  // Видалення завдання (послуги)
  const handleDeleteService = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/order-services/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка видалення"); }
  };

  // Видалення запчастини
  const handleDeletePart = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/order-parts/${id}/`, { headers: { Authorization: `Bearer ${token}` } });
      refreshSelectedVisit();
    } catch (error) { alert("Помилка видалення"); }
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
        {role === 'owner' && (
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

      {/* МОДАЛКА: СТВОРЕННЯ НОВОГО АВТО */}
      {isCreatingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsCreatingVisit(false)} className="absolute right-4 top-4 text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><X size={20} /></button>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><CarFront className="text-blue-600"/> Новий візит</h2>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <input required type="text" placeholder="Номер авто (АА1234ВВ)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-black uppercase" value={newVisitData.plate} onChange={e => setNewVisitData({...newVisitData, plate: e.target.value.toUpperCase()})}/>
              <input required type="text" placeholder="Клієнт (марка авто або ім'я)" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.client} onChange={e => setNewVisitData({...newVisitData, client: e.target.value})}/>
              <input required type="text" placeholder="Телефон" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 outline-none focus:border-blue-500 font-medium" value={newVisitData.phone} onChange={e => setNewVisitData({...newVisitData, phone: e.target.value})}/>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-wide mt-6 shadow-lg shadow-blue-200 transition-all">Відкрити замовлення</button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА ВІЗИТУ */}
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

            {/* ПАНЕЛЬ СТАТУСІВ */}
            <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl mb-6">
              <button onClick={() => updateStatus(selectedVisit.id, 'PENDING')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'PENDING' ? 'bg-white shadow-md text-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>В черзі</button>
              <button onClick={() => updateStatus(selectedVisit.id, 'IN_PROGRESS')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'IN_PROGRESS' ? 'bg-blue-600 shadow-md shadow-blue-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>В роботі</button>
              <button onClick={() => updateStatus(selectedVisit.id, 'DONE')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm uppercase transition-all ${selectedVisit.status === 'DONE' ? 'bg-green-500 shadow-md shadow-green-200 text-white' : 'text-slate-400 hover:bg-slate-200'}`}>Готово</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* === ЗАВДАННЯ (ПОСЛУГИ) === */}
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Wrench size={18}/> Завдання</h3>
                <div className="space-y-2 mb-4">
                  {selectedVisit.services?.length === 0 && <p className="text-sm text-slate-400 italic">Роботи ще не додані</p>}
                  {selectedVisit.services?.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center group">
                      <span className="font-bold text-slate-700 text-sm">{s.name}</span>
                      <div className="flex items-center gap-3">
                        {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{s.price} ₴</span>}
                        {role === 'owner' && <button onClick={() => handleDeleteService(s.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Вибір послуги з прайсу або вручну */}
                {role === 'owner' && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 mt-4">
                    <div className="relative">
                      <List className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none cursor-pointer text-slate-600 font-medium appearance-none"
                        onChange={(e) => {
                          const s = catalogServices.find(cat => cat.id === parseInt(e.target.value));
                          if (s) setNewService({ name: s.name, price: s.price });
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Оберіть послугу з прайсу...</option>
                        {catalogServices.map(s => (
                          <option key={s.id} value={s.id}>{s.name} - {s.price} ₴</option>
                        ))}
                      </select>
                    </div>
                    
                    <form onSubmit={handleAddService} className="flex gap-2">
                      <input required type="text" placeholder="Або введіть свою назву" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-medium" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                      <input required type="number" placeholder="Ціна" className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-black" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} />
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 shadow-sm"><Plus size={18}/></button>
                    </form>
                  </div>
                )}
              </div>

              {/* === ЗАПЧАСТИНИ === */}
              <div>
                <h3 className="font-black uppercase text-slate-700 mb-4 flex items-center gap-2"><Store size={18}/> Запчастини</h3>
                <div className="space-y-2 mb-4">
                  {selectedVisit.parts?.length === 0 && <p className="text-sm text-slate-400 italic">Запчастини не потрібні</p>}
                  {selectedVisit.parts?.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start group">
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{p.name}</p>
                        <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{p.brand} | Арт: {p.article}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {role === 'owner' && <span className="font-black text-slate-900 bg-white px-2 py-1 rounded-md text-sm">{p.sell_price} ₴</span>}
                        {role === 'owner' && <button onClick={() => handleDeletePart(p.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>}
                      </div>
                    </div>
                  ))}
                </div>

                {role === 'owner' && (
                  <div className="mt-4">
                    {!showManualPartForm ? (
                      <button 
                        onClick={() => setShowManualPartForm(true)} 
                        className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all w-full p-3 justify-center border-2 border-dashed border-slate-200 rounded-xl"
                      >
                        <Pencil size={14}/> Додати запчастину вручну
                      </button>
                    ) : (
                      <form onSubmit={handleAddPart} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                        <button type="button" onClick={() => setShowManualPartForm(false)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 bg-white rounded-full p-1"><X size={14}/></button>
                        <p className="text-xs font-black uppercase text-slate-500 mb-2">Ручне введення</p>
                        <input required type="text" placeholder="Назва запчастини (напр. Колодки)" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none font-bold" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                        <div className="flex gap-2">
                          <input type="text" placeholder="Бренд" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.brand} onChange={e => setNewPart({...newPart, brand: e.target.value})} />
                          <input type="text" placeholder="Артикул" className="w-1/2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newPart.article} onChange={e => setNewPart({...newPart, article: e.target.value})} />
                        </div>
                        <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-slate-200">
                          <input type="number" placeholder="Закупка" className="w-1/2 bg-transparent border-none px-3 py-2 text-sm outline-none" value={newPart.buy_price} onChange={e => setNewPart({...newPart, buy_price: e.target.value})} />
                          <span className="text-slate-300">|</span>
                          <input type="number" placeholder="Продаж" className="w-1/2 bg-transparent border-none px-3 py-2 text-sm outline-none font-black text-blue-600" value={newPart.sell_price} onChange={e => setNewPart({...newPart, sell_price: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white font-black uppercase text-xs tracking-widest py-3 rounded-lg mt-2 hover:bg-blue-700 shadow-sm transition-colors">Зберегти деталь</button>
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
