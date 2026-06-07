import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, DollarSign, Plus, Save, Search, Trash2, Pencil, X, Wrench } from 'lucide-react';
import api from '../api/axios';

export default function ServicesSettings() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({ name: '', price: '' });
  const [showAllServices, setShowAllServices] = useState(true);

  const fetchServices = async () => {
    try {
      const res = await api.get('/api/services/');
      setServices((res.data || []).sort((a, b) => b.id - a.id));
    } catch {
      alert('Не вдалося завантажити послуги.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newService.name || !newService.price) return;
    try {
      await api.post('/api/services/', newService);
      setNewService({ name: '', price: '' });
      fetchServices();
    } catch {
      alert('Помилка додавання послуги.');
    }
  };

  const handleUpdateService = async (id) => {
    try {
      await api.patch(`/api/services/${id}/`, editServiceData);
      setEditingServiceId(null);
      fetchServices();
    } catch {
      alert('Помилка оновлення послуги.');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Видалити послугу?')) return;
    try {
      await api.delete(`/api/services/${id}/`);
      fetchServices();
    } catch {
      alert('Помилка видалення послуги.');
    }
  };

  const filteredServices = services.filter((s) => String(s.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const displayedServices = showAllServices || searchQuery ? filteredServices : filteredServices.slice(0, 8);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Завантаження послуг...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
      <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-2xl px-4 py-3 font-black text-xs uppercase hover:bg-slate-50 transition">
        <ArrowLeft size={16}/> Назад до налаштувань
      </button>

      <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white rounded-[30px] p-6 md:p-8 shadow-xl shadow-blue-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Прайс послуг</p>
            <h1 className="text-3xl md:text-4xl font-black italic uppercase mt-1">Послуги СТО</h1>
            <p className="text-sm font-semibold text-blue-100 mt-2 max-w-2xl">Додавайте, редагуйте та видаляйте стандартні роботи. Ці позиції потім швидко підтягуються у візити.</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm font-bold flex items-center gap-2"><Wrench size={17}/> {services.length} послуг</div>
        </div>
      </div>

      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/60">
          <div>
            <h2 className="font-black uppercase text-slate-900 flex items-center gap-2"><DollarSign size={19} className="text-green-600"/> Список послуг</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Окрема сторінка для керування прайсом без зайвого шуму в налаштуваннях.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input type="text" placeholder="Пошук послуги..." className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="p-5 md:p-6">
          <form onSubmit={handleAddService} className="bg-slate-50 border border-slate-200 rounded-[24px] p-4 md:p-5 mb-5 grid grid-cols-1 md:grid-cols-[1fr_160px_56px] gap-3">
            <input required type="text" placeholder="Назва послуги" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-bold" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
            <input required type="number" step="0.01" placeholder="Ціна" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 font-black" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center h-12 md:h-auto shadow-lg shadow-blue-100"><Plus size={22}/></button>
          </form>

          <div className="space-y-3">
            {displayedServices.length === 0 && <div className="rounded-2xl bg-slate-50 border border-slate-100 p-8 text-center font-black text-slate-400 uppercase">Послуг не знайдено</div>}
            {displayedServices.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:border-blue-100 transition">
                {editingServiceId === s.id ? (
                  <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_140px_104px] gap-2">
                    <input type="text" className="bg-slate-50 border-2 border-blue-100 rounded-xl px-3 py-3 outline-none font-bold" value={editServiceData.name} onChange={(e) => setEditServiceData({ ...editServiceData, name: e.target.value })} />
                    <input type="number" step="0.01" className="bg-slate-50 border-2 border-blue-100 rounded-xl px-3 py-3 outline-none font-black" value={editServiceData.price} onChange={(e) => setEditServiceData({ ...editServiceData, price: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => handleUpdateService(s.id)} className="bg-green-100 text-green-700 rounded-xl flex items-center justify-center"><Save size={18}/></button>
                      <button type="button" onClick={() => setEditingServiceId(null)} className="bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center"><X size={18}/></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-black text-slate-900">{s.name}</p>
                      <p className="text-xs font-bold text-slate-400 mt-1">ID #{s.id}</p>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-3">
                      <span className="font-black text-slate-900 text-lg">{s.price} ₴</span>
                      <button onClick={() => { setEditingServiceId(s.id); setEditServiceData({ name: s.name, price: s.price }); }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center"><Pencil size={16}/></button>
                      <button onClick={() => handleDeleteService(s.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 size={16}/></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filteredServices.length > 8 && (
            <button onClick={() => setShowAllServices(!showAllServices)} className="w-full py-4 mt-5 text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition">
              {showAllServices ? <><ChevronUp size={16}/> Показати коротко</> : <><ChevronDown size={16}/> Показати всі ({filteredServices.length})</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
