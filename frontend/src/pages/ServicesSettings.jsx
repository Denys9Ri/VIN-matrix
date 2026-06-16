import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, DollarSign, Plus, Save, Search, Trash2, Pencil, X, Wrench, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { AppPage, Button, Card, EmptyState, PageHeader, useToast } from '../components/ui';

export default function ServicesSettings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceData, setEditServiceData] = useState({ name: '', price: '' });
  const [showAllServices, setShowAllServices] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/services/');
      setServices((Array.isArray(res.data) ? res.data : []).sort((a, b) => b.id - a.id));
    } catch {
      toast.error('Не вдалося завантажити послуги.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newService.name || !newService.price) return toast.warning('Вкажіть назву і ціну послуги.');
    try {
      await api.post('/api/services/', newService);
      setNewService({ name: '', price: '' });
      toast.success('Послугу додано.');
      fetchServices();
    } catch {
      toast.error('Помилка додавання послуги.');
    }
  };

  const handleUpdateService = async (id) => {
    try {
      await api.patch(`/api/services/${id}/`, editServiceData);
      setEditingServiceId(null);
      toast.success('Послугу оновлено.');
      fetchServices();
    } catch {
      toast.error('Помилка оновлення послуги.');
    }
  };

  const handleDeleteService = async () => {
    if (!confirmDelete?.id) return;
    try {
      await api.delete(`/api/services/${confirmDelete.id}/`);
      setConfirmDelete(null);
      toast.success('Послугу видалено.');
      fetchServices();
    } catch {
      toast.error('Помилка видалення послуги.');
    }
  };

  const filteredServices = useMemo(() => services.filter((s) => String(s.name || '').toLowerCase().includes(searchQuery.toLowerCase())), [services, searchQuery]);
  const displayedServices = showAllServices || searchQuery ? filteredServices : filteredServices.slice(0, 8);

  if (loading) return <AppPage><div className="min-h-[55vh] flex items-center justify-center text-slate-500 font-bold"><Loader2 className="animate-spin mr-2"/> Завантаження послуг...</div></AppPage>;

  return (
    <AppPage className="max-w-6xl pb-24 space-y-6">
      <Button variant="secondary" onClick={() => navigate('/settings')} icon={<ArrowLeft size={16} />}>Назад до налаштувань</Button>
      <PageHeader icon={<Wrench />} title="Послуги СТО" subtitle="Додавайте, редагуйте та видаляйте стандартні роботи. Ці позиції швидко підтягуються у візити." actions={<Card padding="sm" className="px-4 py-3 text-sm font-bold flex items-center gap-2"><Wrench size={17}/> {services.length} послуг</Card>} />

      <Card className="overflow-hidden" padding="none">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/60">
          <div>
            <h2 className="font-black uppercase text-slate-900 flex items-center gap-2"><DollarSign size={19} className="text-green-600"/> Список послуг</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Окрема сторінка для керування прайсом без зайвого шуму в налаштуваннях.</p>
          </div>
          <div className="relative w-full md:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input type="text" placeholder="Пошук послуги..." className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </div>

        <div className="p-5 md:p-6">
          <form onSubmit={handleAddService} className="bg-slate-50 border border-slate-200 rounded-[24px] p-4 md:p-5 mb-5 grid grid-cols-1 md:grid-cols-[1fr_160px_56px] gap-3">
            <input required type="text" placeholder="Назва послуги" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-bold" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
            <input required type="number" step="0.01" placeholder="Ціна" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-black" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center h-12 md:h-auto shadow-lg shadow-blue-100"><Plus size={22}/></button>
          </form>

          <div className="space-y-3">
            {displayedServices.length === 0 && <EmptyState title="Послуг не знайдено" />}
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
                    <div className="min-w-0"><p className="font-black text-slate-900 break-words">{s.name}</p><p className="text-xs font-bold text-slate-400 mt-1">ID #{s.id}</p></div>
                    <div className="flex items-center justify-between md:justify-end gap-3">
                      <span className="font-black text-slate-900 text-lg whitespace-nowrap">{s.price} ₴</span>
                      <button type="button" onClick={() => { setEditingServiceId(s.id); setEditServiceData({ name: s.name, price: s.price }); }} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center"><Pencil size={16}/></button>
                      <button type="button" onClick={() => setConfirmDelete(s)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><Trash2 size={16}/></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filteredServices.length > 8 && <button type="button" onClick={() => setShowAllServices(!showAllServices)} className="w-full py-4 mt-5 text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition">{showAllServices ? <><ChevronUp size={16}/> Показати коротко</> : <><ChevronDown size={16}/> Показати всі ({filteredServices.length})</>}</button>}
        </div>
      </Card>
      {confirmDelete && <ConfirmModal title="Видалити послугу?" text={`Послуга “${confirmDelete.name}” буде видалена з прайсу.`} onClose={() => setConfirmDelete(null)} onConfirm={handleDeleteService} />}
    </AppPage>
  );
}

function ConfirmModal({ title, text, onClose, onConfirm }) {
  return <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md p-6"><h3 className="text-xl font-black text-slate-900 uppercase">{title}</h3><p className="text-sm font-bold text-slate-500 mt-2">{text}</p><div className="grid grid-cols-2 gap-3 mt-6"><Button variant="secondary" onClick={onClose}>Скасувати</Button><Button variant="danger" onClick={onConfirm}>Видалити</Button></div></div></div>;
}
