import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Settings2, Wrench, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../ui';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const money = (value) => `${Number(value || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

export default function ServiceQuickPrice() {
  const navigate = useNavigate();
  const toast = useToast();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [editingId, setEditingId] = useState(null);
  const [editService, setEditService] = useState({ name: '', price: '' });

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/services/');
      setServices(toList(response.data));
    } catch {
      toast.error('Не вдалося завантажити прайс робіт.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadServices();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsidePointer = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk-UA');
    const rows = [...services].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'uk-UA'));
    if (!query) return rows;
    return rows.filter((service) => String(service.name || '').toLocaleLowerCase('uk-UA').includes(query));
  }, [services, search]);

  const addService = async (event) => {
    event.preventDefault();
    const name = newService.name.trim();
    if (!name || newService.price === '') return toast.warning('Вкажіть назву та ціну роботи.');

    setSaving(true);
    try {
      await api.post('/api/services/', { name, price: Number(newService.price || 0) });
      setNewService({ name: '', price: '' });
      setShowAdd(false);
      await loadServices();
      toast.success('Роботу додано до прайсу.');
    } catch {
      toast.error('Не вдалося додати роботу.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (service) => {
    setEditingId(service.id);
    setEditService({ name: service.name || '', price: service.price ?? '' });
  };

  const saveEdit = async (serviceId) => {
    const name = editService.name.trim();
    if (!name || editService.price === '') return toast.warning('Вкажіть назву та ціну роботи.');

    setSaving(true);
    try {
      await api.patch(`/api/services/${serviceId}/`, { name, price: Number(editService.price || 0) });
      setEditingId(null);
      await loadServices();
      toast.success('Прайс оновлено.');
    } catch {
      toast.error('Не вдалося оновити роботу.');
    } finally {
      setSaving(false);
    }
  };

  const openSettings = () => {
    setOpen(false);
    navigate('/settings/services');
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-10 rounded-full border px-3 flex items-center justify-center gap-2 text-xs font-black transition ${open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
        title="Швидкий прайс робіт"
        aria-label="Відкрити прайс робіт"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Wrench size={16} />
        <span className="hidden xl:inline">Прайс робіт</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-sm md:absolute md:inset-auto md:right-0 md:top-12 md:w-[440px] md:bg-transparent md:backdrop-blur-0">
          <div ref={panelRef} role="dialog" aria-label="Прайс робіт СТО" className="flex h-full w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[80vh] md:rounded-3xl md:border md:border-slate-200 md:shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50 p-4">
              <div className="min-w-0">
                <p className="font-black uppercase text-slate-900">Прайс робіт</p>
                <p className="text-xs font-bold text-slate-500">Швидко назвати ціну клієнту або змінити її</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 md:h-9 md:w-9" aria-label="Закрити прайс"><X size={18} /></button>
            </div>

            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Пошук роботи..."
                  autoFocus
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>
              <button type="button" onClick={() => { setShowAdd((current) => !current); setEditingId(null); }} className="mt-2 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-blue-700">
                {showAdd ? <X size={15} /> : <Plus size={15} />} {showAdd ? 'Скасувати' : 'Додати нову роботу'}
              </button>
            </div>

            {showAdd && (
              <form onSubmit={addService} className="grid grid-cols-[minmax(0,1fr)_110px_44px] gap-2 border-b border-blue-100 bg-blue-50/60 p-3">
                <input required value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} placeholder="Назва роботи" className="min-w-0 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-400" />
                <input required type="number" min="0" step="0.01" value={newService.price} onChange={(event) => setNewService({ ...newService, price: event.target.value })} placeholder="Ціна" className="min-w-0 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-blue-400" />
                <button disabled={saving} type="submit" className="flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60" title="Зберегти"><Check size={18} /></button>
              </form>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto p-3 md:max-h-[500px]">
              {loading && !services.length && <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-8 text-sm font-bold text-slate-500"><Loader2 size={18} className="animate-spin" /> Завантаження...</div>}
              {!loading && filteredServices.length === 0 && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center"><p className="font-black text-slate-700">{search ? 'Нічого не знайдено' : 'Прайс ще порожній'}</p><p className="mt-1 text-xs font-bold text-slate-400">Додайте першу роботу прямо тут або з візиту.</p></div>}

              {filteredServices.map((service) => (
                <div key={service.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-blue-100">
                  {editingId === service.id ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_105px_40px_40px] gap-2">
                      <input value={editService.name} onChange={(event) => setEditService({ ...editService, name: event.target.value })} className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
                      <input type="number" min="0" step="0.01" value={editService.price} onChange={(event) => setEditService({ ...editService, price: event.target.value })} className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/40 px-2 py-2 text-sm font-black outline-none focus:border-blue-500" />
                      <button type="button" disabled={saving} onClick={() => saveEdit(service.id)} className="flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60" title="Зберегти"><Check size={17} /></button>
                      <button type="button" onClick={() => setEditingId(null)} className="flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" title="Скасувати"><X size={17} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-black text-slate-800">{service.name}</p>
                      </div>
                      <span className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">{money(service.price)}</span>
                      <button type="button" onClick={() => startEdit(service)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Редагувати"><Pencil size={15} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 p-3">
              <button type="button" onClick={openSettings} className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase text-slate-600 hover:border-blue-200 hover:text-blue-700">
                <Settings2 size={15} /> Повні налаштування послуг
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
