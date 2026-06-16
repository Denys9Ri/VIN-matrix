import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, CheckCircle2, Layers3, Package, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import api from '../api/axios';

const emptyService = { name: '', price: '', quantity: 1 };
const emptyPart = { name: '', brand: '', article: '', buy_price: '', sell_price: '', quantity: 1, supplier: '' };
const emptyForm = { name: '', description: '', is_active: true, services: [{ ...emptyService }], parts: [{ ...emptyPart }] };

const money = (value) => `${Number(value || 0).toFixed(2)} ₴`;
const itemTotal = (item, priceField = 'price') => Number(item?.[priceField] || 0) * Number(item?.quantity || 1);

const inputClass = 'w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all';
const mutedInputClass = 'w-full min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all';

const Complexes = () => {
  const [searchParams] = useSearchParams();
  const visitIdFromUrl = searchParams.get('visit') || '';
  const [complexes, setComplexes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyVisitId, setApplyVisitId] = useState(visitIdFromUrl);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveFromVisitOpen, setSaveFromVisitOpen] = useState(false);

  const filteredComplexes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return complexes;
    return complexes.filter((complex) =>
      [complex.name, complex.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [complexes, search]);

  const formTotal = useMemo(() => {
    const servicesTotal = (form.services || []).reduce((sum, item) => sum + itemTotal(item, 'price'), 0);
    const partsTotal = (form.parts || []).reduce((sum, item) => sum + itemTotal(item, 'sell_price'), 0);
    return servicesTotal + partsTotal;
  }, [form]);

  const fetchComplexes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/complexes/');
      setComplexes(response.data || []);
    } catch (error) {
      setMessage('Не вдалося завантажити комплекси. Перевірте backend після деплою.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplexes();
  }, []);

  useEffect(() => {
    setApplyVisitId(visitIdFromUrl);
  }, [visitIdFromUrl]);

  const openCreateModal = () => {
    setEditing(null);
    setForm(JSON.parse(JSON.stringify(emptyForm)));
    setModalOpen(true);
  };

  const openEditModal = (complex) => {
    setEditing(complex);
    setForm({
      name: complex.name || '',
      description: complex.description || '',
      is_active: complex.is_active !== false,
      services: (complex.services && complex.services.length ? complex.services : [{ ...emptyService }]).map((item) => ({
        name: item.name || '',
        price: item.price || '',
        quantity: item.quantity || 1,
      })),
      parts: (complex.parts && complex.parts.length ? complex.parts : [{ ...emptyPart }]).map((item) => ({
        name: item.name || '',
        brand: item.brand || '',
        article: item.article || '',
        buy_price: item.buy_price || '',
        sell_price: item.sell_price || '',
        quantity: item.quantity || 1,
        supplier: item.supplier || '',
      })),
    });
    setModalOpen(true);
  };

  const updateArrayItem = (key, index, field, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addArrayItem = (key, template) => {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], { ...template }] }));
  };

  const removeArrayItem = (key, index, template) => {
    setForm((prev) => {
      const next = prev[key].filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, [key]: next.length ? next : [{ ...template }] };
    });
  };

  const cleanPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    is_active: form.is_active,
    services: (form.services || [])
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), price: Number(item.price || 0), quantity: Number(item.quantity || 1) })),
    parts: (form.parts || [])
      .filter((item) => item.name.trim() || item.article.trim())
      .map((item) => ({
        name: (item.name || item.article || 'Запчастина').trim(),
        brand: item.brand.trim(),
        article: item.article.trim(),
        buy_price: Number(item.buy_price || 0),
        sell_price: Number(item.sell_price || 0),
        quantity: Number(item.quantity || 1),
        supplier: item.supplier.trim(),
      })),
  });

  const submitComplex = async (event) => {
    event.preventDefault();
    const payload = cleanPayload();
    if (!payload.name) {
      setMessage('Вкажіть назву комплексу.');
      return;
    }
    setBusy(true);
    try {
      if (editing?.id) {
        await api.put(`/api/complexes/${editing.id}/`, payload);
        setMessage('Комплекс оновлено.');
      } else {
        await api.post('/api/complexes/', payload);
        setMessage('Комплекс створено.');
      }
      setModalOpen(false);
      fetchComplexes();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося зберегти комплекс.');
    } finally {
      setBusy(false);
    }
  };

  const deleteComplex = async () => {
    if (!deleteTarget?.id) return;
    setBusy(true);
    try {
      await api.delete(`/api/complexes/${deleteTarget.id}/`);
      setMessage('Комплекс видалено.');
      setDeleteTarget(null);
      fetchComplexes();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося видалити комплекс.');
    } finally {
      setBusy(false);
    }
  };

  const applyComplex = async () => {
    if (!applyTarget?.id) return;
    if (!applyVisitId) {
      setMessage('Вкажіть ID візиту, куди додати комплекс.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/api/complexes/${applyTarget.id}/apply-to-visit/`, { visit_id: applyVisitId });
      setMessage(response.data?.message || 'Комплекс додано у візит.');
      setApplyTarget(null);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося додати комплекс у візит.');
    } finally {
      setBusy(false);
    }
  };

  const saveFromVisit = async (name) => {
    if (!applyVisitId) {
      setMessage('Вкажіть ID візиту, з якого створити комплекс.');
      return;
    }
    const cleanedName = String(name || '').trim();
    if (!cleanedName) return;
    setBusy(true);
    try {
      await api.post('/api/complexes/save-from-visit/', { visit_id: applyVisitId, name: cleanedName });
      setMessage('Комплекс створено з візиту.');
      setSaveFromVisitOpen(false);
      fetchComplexes();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Не вдалося створити комплекс з візиту.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen w-full">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 flex items-center gap-3">
            <Boxes className="text-blue-600" size={30} /> Комплекси
          </h1>
          <p className="text-slate-500 font-semibold mt-1">Шаблони робіт і запчастин для швидкого додавання у візит.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
        >
          <Plus size={16} /> Створити комплекс
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук комплексу..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500 font-medium"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              value={applyVisitId}
              onChange={(event) => setApplyVisitId(event.target.value)}
              placeholder="ID візиту"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500 font-bold min-w-[140px]"
            />
            <button type="button" onClick={() => setSaveFromVisitOpen(true)} className="bg-slate-900 text-white px-4 py-3 rounded-xl text-xs font-black uppercase hover:bg-slate-800">
              Зберегти з візиту
            </button>
          </div>
        </div>
        {visitIdFromUrl && (
          <p className="text-xs font-bold text-blue-600 mt-3">Відкрито з візиту №{visitIdFromUrl}. Оберіть комплекс і натисніть “Додати у візит”.</p>
        )}
      </div>

      {message && (
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 flex items-center justify-between gap-3">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-blue-400 hover:text-blue-700"><X size={16} /></button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl p-10 text-center text-slate-400 font-black border border-slate-200">Завантаження...</div>
      ) : filteredComplexes.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
          <Layers3 className="mx-auto text-slate-300 mb-3" size={42} />
          <p className="font-black text-slate-700">Комплексів поки немає</p>
          <p className="text-sm text-slate-400 font-semibold mt-1">Створіть перший шаблон для типового ремонту або ТО.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredComplexes.map((complex) => (
            <div key={complex.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-black text-xl text-slate-900">{complex.name}</h2>
                  <p className="text-sm text-slate-500 font-semibold mt-1 line-clamp-2">{complex.description || 'Без опису'}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${complex.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {complex.is_active ? 'Активний' : 'Вимкнено'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">Робіт</p>
                  <p className="font-black text-slate-800">{complex.services_count ?? complex.services?.length ?? 0}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">Запчастин</p>
                  <p className="font-black text-slate-800">{complex.parts_count ?? complex.parts?.length ?? 0}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                  <p className="text-[10px] font-black uppercase text-blue-400">Сума</p>
                  <p className="font-black text-blue-700">{money(complex.total_sum)}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {(complex.services || []).slice(0, 3).map((item) => (
                  <p key={`s-${complex.id}-${item.id}`} className="text-xs font-bold text-slate-600 flex items-center gap-2"><Wrench size={13} className="text-blue-500" /> {item.name} · {money(item.price)}</p>
                ))}
                {(complex.parts || []).slice(0, 3).map((item) => (
                  <p key={`p-${complex.id}-${item.id}`} className="text-xs font-bold text-slate-600 flex items-center gap-2"><Package size={13} className="text-emerald-500" /> {item.article || item.name} · {money(item.sell_price)}</p>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" onClick={() => setApplyTarget(complex)} className="bg-slate-900 text-white py-2.5 rounded-xl text-xs font-black uppercase hover:bg-slate-800">Додати у візит</button>
                <button type="button" onClick={() => openEditModal(complex)} className="bg-blue-50 text-blue-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-blue-100">Редагувати</button>
                <button type="button" onClick={() => setDeleteTarget(complex)} className="bg-rose-50 text-rose-700 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-rose-100">Видалити</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-5 overflow-y-auto">
          <form onSubmit={submitComplex} className="bg-white rounded-[28px] shadow-2xl w-full max-w-[1280px] my-4 sm:my-8 overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900">{editing ? 'Редагувати комплекс' : 'Новий комплекс'}</h2>
                <p className="text-sm text-slate-500 font-semibold">Додайте роботи та запчастини, які часто повторюються.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-500 hover:text-slate-900 shrink-0"><X size={18} /></button>
            </div>

            <div className="p-4 sm:p-5 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Назва комплексу" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500 min-w-0" />
                <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-600">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Активний
                </label>
              </div>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Короткий опис" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 min-h-[76px]" />

              <div className="grid grid-cols-1 2xl:grid-cols-[0.9fr_1.1fr] gap-5 items-start">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 min-w-0">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <h3 className="font-black uppercase text-slate-700 flex items-center gap-2 text-sm"><Wrench size={16} /> Роботи</h3>
                    <button type="button" onClick={() => addArrayItem('services', emptyService)} className="text-blue-600 font-black text-xs uppercase whitespace-nowrap">+ Додати</button>
                  </div>
                  <div className="space-y-3">
                    {form.services.map((item, index) => (
                      <div key={`service-form-${index}`} className="bg-white border border-slate-200 rounded-2xl p-3 grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_120px_90px_40px] gap-2 items-center">
                        <input value={item.name} onChange={(e) => updateArrayItem('services', index, 'name', e.target.value)} placeholder="Назва роботи" className={inputClass} />
                        <input type="number" value={item.price} onChange={(e) => updateArrayItem('services', index, 'price', e.target.value)} placeholder="Ціна" className={inputClass} />
                        <input type="number" step="0.1" value={item.quantity} onChange={(e) => updateArrayItem('services', index, 'quantity', e.target.value)} placeholder="К-сть" className={inputClass} />
                        <button type="button" onClick={() => removeArrayItem('services', index, emptyService)} className="h-10 text-rose-500 hover:bg-rose-50 rounded-xl flex items-center justify-center"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 min-w-0">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <h3 className="font-black uppercase text-slate-700 flex items-center gap-2 text-sm"><Package size={16} /> Запчастини</h3>
                    <button type="button" onClick={() => addArrayItem('parts', emptyPart)} className="text-blue-600 font-black text-xs uppercase whitespace-nowrap">+ Додати</button>
                  </div>
                  <div className="space-y-3">
                    {form.parts.map((item, index) => (
                      <div key={`part-form-${index}`} className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2 min-w-0">
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.4fr)_140px_160px] gap-2">
                          <input value={item.name} onChange={(e) => updateArrayItem('parts', index, 'name', e.target.value)} placeholder="Назва" className={mutedInputClass} />
                          <input value={item.brand} onChange={(e) => updateArrayItem('parts', index, 'brand', e.target.value)} placeholder="Бренд" className={mutedInputClass} />
                          <input value={item.article} onChange={(e) => updateArrayItem('parts', index, 'article', e.target.value)} placeholder="Артикул" className={mutedInputClass} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-[120px_120px_90px_minmax(180px,1fr)_40px] gap-2 items-center">
                          <input type="number" value={item.buy_price} onChange={(e) => updateArrayItem('parts', index, 'buy_price', e.target.value)} placeholder="Закуп." className={mutedInputClass} />
                          <input type="number" value={item.sell_price} onChange={(e) => updateArrayItem('parts', index, 'sell_price', e.target.value)} placeholder="Продаж" className={mutedInputClass} />
                          <input type="number" step="0.1" value={item.quantity} onChange={(e) => updateArrayItem('parts', index, 'quantity', e.target.value)} placeholder="К-сть" className={mutedInputClass} />
                          <input value={item.supplier} onChange={(e) => updateArrayItem('parts', index, 'supplier', e.target.value)} placeholder="Постачальник" className={`${mutedInputClass} col-span-2 md:col-span-1`} />
                          <button type="button" onClick={() => removeArrayItem('parts', index, emptyPart)} className="h-10 text-rose-500 hover:bg-rose-50 rounded-xl flex items-center justify-center col-span-2 md:col-span-1"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <p className="text-sm font-black text-slate-700">Орієнтовна сума: <span className="text-blue-600 text-base">{money(formTotal)}</span></p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setModalOpen(false)} disabled={busy} className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-white border border-slate-200 font-black text-xs uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-60">Скасувати</button>
                <button type="submit" disabled={busy} className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-blue-600 font-black text-xs uppercase text-white hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-60">{busy ? 'Зберігаємо...' : 'Зберегти'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {applyTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Додати у візит</h3>
                <p className="text-sm text-slate-500 font-semibold">{applyTarget.name}</p>
              </div>
              <button type="button" onClick={() => setApplyTarget(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
              <p className="text-xs font-black uppercase text-slate-400 mb-1">ID візиту</p>
              <input type="number" value={applyVisitId} onChange={(event) => setApplyVisitId(event.target.value)} placeholder="Наприклад: 24" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm font-bold">
              <div className="bg-blue-50 text-blue-700 rounded-xl p-3">Робіт: {applyTarget.services_count ?? applyTarget.services?.length ?? 0}</div>
              <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3">Запчастин: {applyTarget.parts_count ?? applyTarget.parts?.length ?? 0}</div>
            </div>
            <button type="button" onClick={applyComplex} disabled={busy} className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-60">
              <CheckCircle2 size={16} /> {busy ? 'Додаємо...' : 'Додати комплекс'}
            </button>
          </div>
        </div>
      )}


      {deleteTarget && (
        <ConfirmModal
          title="Видалити комплекс?"
          text={`Комплекс “${deleteTarget.name}” буде видалено зі списку шаблонів.`}
          confirmText="Видалити"
          tone="danger"
          busy={busy}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteComplex}
        />
      )}

      {saveFromVisitOpen && (
        <NamePromptModal
          busy={busy}
          visitId={applyVisitId}
          onClose={() => setSaveFromVisitOpen(false)}
          onConfirm={saveFromVisit}
        />
      )}
    </div>
  );
};


function ConfirmModal({ title, text, confirmText, tone = 'danger', busy, onClose, onConfirm }) {
  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`${isDanger ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'} p-5 border-b flex items-start gap-3`}>
          <div className={`${isDanger ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'} w-12 h-12 rounded-2xl flex items-center justify-center shrink-0`}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-900">{title}</h3>
            <p className="text-sm font-bold text-slate-600 mt-1">{text}</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-2xl text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60`}>
            {busy ? 'Виконується...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function NamePromptModal({ busy, visitId, onClose, onConfirm }) {
  const [name, setName] = useState('');

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(name);
        }}
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-5 bg-slate-50 border-b border-slate-100">
          <h3 className="text-xl font-black uppercase text-slate-900">Назва нового комплексу</h3>
          <p className="text-sm font-bold text-slate-500 mt-1">Комплекс буде створено з візиту №{visitId || '—'}.</p>
        </div>
        <div className="p-5 space-y-4">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Наприклад: ТО з заміною фільтрів"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button>
            <button disabled={busy} className="rounded-2xl bg-blue-600 text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60">{busy ? 'Створюємо...' : 'Створити'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}


export default Complexes;
