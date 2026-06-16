import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, Loader2, MapPin, PackageCheck, Pencil, Plus, Power, Search, ShieldCheck, Star, Trash2, Truck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const emptyProfile = {
  name: '',
  api_key: '',
  sender_name: '',
  sender_phone: '',
  sender_city: '',
  sender_city_ref: '',
  sender_warehouse: '',
  sender_warehouse_ref: '',
  is_default: false,
  is_active: true,
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  return data?.details || data?.error || data?.detail || error?.message || 'Невідома помилка';
};

const DeliverySettings = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyProfile);

  const activeCount = useMemo(() => profiles.filter((item) => item.is_active).length, [profiles]);
  const defaultProfile = useMemo(() => profiles.find((item) => item.is_default), [profiles]);

  const showNotice = (type, text) => setNotice({ type, text });

  const loadProfiles = async ({ keepNotice = false } = {}) => {
    setLoading(true);
    if (!keepNotice) setNotice(null);
    try {
      const res = await api.get('/api/delivery/novapost/profiles/');
      setProfiles(Array.isArray(res.data?.results) ? res.data.results : []);
    } catch (error) {
      showNotice('error', `Не вдалося завантажити профілі: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfiles(); }, []);

  const openCreate = () => {
    setForm({ ...emptyProfile, is_default: profiles.length === 0 });
    setModal({ type: 'create', title: 'Додати профіль Нової пошти' });
  };

  const openEdit = (profile) => {
    setForm({ ...emptyProfile, ...profile, api_key: '' });
    setModal({ type: 'edit', title: `Редагувати: ${profile.name}` });
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const payload = { ...form };
    if (modal?.type === 'edit' && !payload.api_key) delete payload.api_key;
    try {
      if (modal?.type === 'edit') {
        await api.patch(`/api/delivery/novapost/profiles/${form.id}/`, payload);
        showNotice('success', 'Профіль Нової пошти оновлено.');
      } else {
        await api.post('/api/delivery/novapost/profiles/', payload);
        showNotice('success', 'Профіль Нової пошти додано.');
      }
      setModal(null);
      await loadProfiles({ keepNotice: true });
    } catch (error) {
      showNotice('error', `Не вдалося зберегти профіль: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const patchProfile = async (profile, payload, message) => {
    setBusyId(profile.id);
    setNotice(null);
    try {
      await api.patch(`/api/delivery/novapost/profiles/${profile.id}/`, payload);
      showNotice('success', message);
      await loadProfiles({ keepNotice: true });
    } catch (error) {
      showNotice('error', `Помилка: ${getErrorMessage(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const deleteProfile = async () => {
    if (!deleteTarget?.id) return;
    setBusyId(deleteTarget.id);
    setNotice(null);
    try {
      await api.delete(`/api/delivery/novapost/profiles/${deleteTarget.id}/`);
      showNotice('success', 'Профіль Нової пошти видалено.');
      setDeleteTarget(null);
      await loadProfiles({ keepNotice: true });
    } catch (error) {
      showNotice('error', `Не вдалося видалити профіль: ${getErrorMessage(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  const testProfile = async (profile) => {
    setBusyId(profile.id);
    setNotice(null);
    try {
      const res = await api.post(`/api/delivery/novapost/profiles/${profile.id}/test/`);
      showNotice('success', res.data?.message || 'API-ключ працює.');
    } catch (error) {
      showNotice('error', `Перевірка не пройдена: ${getErrorMessage(error)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-8 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <button onClick={() => navigate('/settings')} className="mb-4 inline-flex items-center gap-2 text-slate-500 hover:text-blue-700 font-black text-xs uppercase">
            <ArrowLeft size={16}/> Назад до налаштувань
          </button>
          <div className="inline-flex items-center gap-2 text-blue-700 text-[10px] font-black uppercase tracking-widest"><Truck size={15}/> Доставка</div>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-slate-900 mt-2">Нова пошта</h1>
          <p className="text-slate-500 font-semibold mt-2 max-w-3xl">Керуйте відправниками, API-ключами та основним профілем. Один бізнес може мати декілька ФОП, складів або менеджерів для відправки.</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase shadow-lg shadow-blue-100 inline-flex items-center justify-center gap-2">
          <Plus size={18}/> Додати профіль
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Профілі" value={profiles.length} icon={<Truck size={20}/>} />
        <StatCard title="Активні" value={activeCount} icon={<BadgeCheck size={20}/>} tone="emerald" />
        <StatCard title="Основний" value={defaultProfile?.name || 'Не вибрано'} icon={<Star size={20}/>} tone="amber" small />
      </section>

      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-100 text-[10px] font-black uppercase tracking-widest"><ShieldCheck size={15}/> Профілі відправника</div>
            <h2 className="text-2xl font-black uppercase italic mt-2">API-ключі та відправники</h2>
            <p className="text-blue-50/80 font-semibold text-sm mt-1">API-ключі не показуються повністю — тільки маска для безпеки. Місто та відділення можна знайти через довідники Нової пошти.</p>
          </div>
          <button onClick={loadProfiles} className="bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase disabled:opacity-60" disabled={loading}>{loading ? 'Оновлення...' : 'Оновити'}</button>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-slate-500 font-black"><Loader2 className="animate-spin"/> Завантаження профілів...</div>
        ) : profiles.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <div className="w-20 h-20 rounded-[28px] bg-blue-50 text-blue-600 flex items-center justify-center mx-auto"><PackageCheck size={34}/></div>
            <h3 className="text-2xl font-black text-slate-900 mt-5">Профілів ще немає</h3>
            <p className="text-slate-500 font-semibold mt-2 max-w-xl mx-auto">Додайте перший API-ключ Нової пошти, щоб потім створювати ТТН, перевіряти статуси та бачити трекінг прямо в замовленні.</p>
            <button onClick={openCreate} className="mt-6 bg-blue-600 text-white rounded-2xl px-6 py-3 text-xs font-black uppercase inline-flex items-center gap-2"><Plus size={18}/> Додати профіль</button>
          </div>
        ) : (
          <div className="p-4 md:p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} busy={busyId === profile.id} onTest={testProfile} onEdit={openEdit} onMakeDefault={(item) => patchProfile(item, { is_default: true }, 'Основний профіль змінено.')} onToggle={(item) => patchProfile(item, { is_active: !item.is_active }, item.is_active ? 'Профіль вимкнено.' : 'Профіль увімкнено.')} onDelete={setDeleteTarget} />)}
          </div>
        )}
      </section>

      {modal && <ProfileModal title={modal.title} form={form} setForm={setForm} onClose={() => setModal(null)} onSubmit={submitProfile} isEdit={modal.type === 'edit'} saving={saving} />}
      {deleteTarget && <ConfirmDelete profile={deleteTarget} busy={busyId === deleteTarget.id} onClose={() => setDeleteTarget(null)} onConfirm={deleteProfile} />}
    </div>
  );
};

function Notice({ notice, onClose }) {
  const isError = notice.type === 'error';
  return <div className={`${isError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-blue-100 bg-blue-50 text-blue-800'} rounded-2xl border px-4 py-3 text-sm font-bold flex items-center justify-between gap-3`}><span>{notice.text}</span><button type="button" onClick={onClose} className="opacity-70 hover:opacity-100"><X size={16}/></button></div>;
}

function StatCard({ title, value, icon, tone = 'blue', small = false }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' };
  return <div className="bg-white rounded-[26px] border border-slate-200 p-5 shadow-sm flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p><p className={`${small ? 'text-lg' : 'text-3xl'} font-black text-slate-900 mt-1 truncate max-w-[240px]`}>{value}</p></div><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tones[tone]}`}>{icon}</div></div>;
}

function ProfileCard({ profile, busy, onTest, onEdit, onMakeDefault, onToggle, onDelete }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-slate-50/60 overflow-hidden hover:shadow-xl hover:shadow-blue-100/40 transition-all">
      <div className="bg-white p-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 truncate">{profile.name}</h3>
            {profile.is_default && <span className="bg-amber-50 text-amber-700 rounded-full px-3 py-1 text-[10px] font-black uppercase inline-flex items-center gap-1"><Star size={12}/> Основний</span>}
            <span className={`${profile.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'} rounded-full px-3 py-1 text-[10px] font-black uppercase`}>{profile.is_active ? 'Активний' : 'Вимкнений'}</span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-2">Ключ: {profile.api_key_masked || 'не вказано'}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Truck size={22}/></div>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Info label="Відправник" value={profile.sender_name || '—'} />
        <Info label="Телефон" value={profile.sender_phone || '—'} />
        <Info label="Місто" value={profile.sender_city || '—'} icon={<MapPin size={14}/>} />
        <Info label="Відділення" value={profile.sender_warehouse || '—'} />
      </div>
      <div className="p-4 bg-white border-t border-slate-100 flex flex-wrap justify-end gap-2">
        <ActionButton disabled={busy} onClick={() => onTest(profile)}>{busy ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>} Перевірити ключ</ActionButton>
        <ActionButton disabled={busy} onClick={() => onEdit(profile)}><Pencil size={15}/> Редагувати</ActionButton>
        {!profile.is_default && <ActionButton disabled={busy} onClick={() => onMakeDefault(profile)}><Star size={15}/> Зробити основним</ActionButton>}
        <ActionButton disabled={busy} onClick={() => onToggle(profile)}><Power size={15}/> {profile.is_active ? 'Вимкнути' : 'Увімкнути'}</ActionButton>
        <ActionButton disabled={busy} danger onClick={() => onDelete(profile)}><Trash2 size={15}/> Видалити</ActionButton>
      </div>
    </article>
  );
}

function Info({ label, value, icon }) {
  return <div className="bg-white rounded-2xl border border-slate-100 p-3 min-w-0"><p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">{icon}{label}</p><p className="font-black text-slate-800 mt-1 break-words">{value}</p></div>;
}

function ActionButton({ children, onClick, disabled, danger = false }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`${danger ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'} rounded-xl px-3 py-2 text-[11px] font-black uppercase inline-flex items-center gap-1 disabled:opacity-60`}>{children}</button>;
}

function ProfileModal({ title, form, setForm, onClose, onSubmit, isEdit, saving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const selectCity = (city) => setForm({ ...form, sender_city: city.description, sender_city_ref: city.ref, sender_warehouse: '', sender_warehouse_ref: '' });
  const selectWarehouse = (warehouse) => setForm({ ...form, sender_warehouse: warehouse.description || warehouse.short_address, sender_warehouse_ref: warehouse.ref });
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-white rounded-[32px] shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white flex items-start justify-between gap-4">
          <div><p className="text-blue-100 text-[10px] font-black uppercase tracking-widest">Нова пошта</p><h2 className="text-2xl font-black uppercase italic mt-1">{title}</h2><p className="text-sm font-semibold text-blue-50/80 mt-2">Дані зберігаються тільки для вашої компанії. Місто та відділення можна знайти через API Нової пошти.</p></div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center"><X size={20}/></button>
        </div>
        <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Назва профілю" value={form.name} onChange={(value) => update('name', value)} placeholder="ФОП Іваненко / Склад Київ" required />
          <Field label={isEdit ? 'Новий API-ключ (необовʼязково)' : 'API-ключ'} value={form.api_key || ''} onChange={(value) => update('api_key', value)} placeholder="Вставте API-ключ Нової пошти" required={!isEdit} />
          <Field label="Відправник" value={form.sender_name} onChange={(value) => update('sender_name', value)} placeholder="ПІБ або назва ФОП" />
          <Field label="Телефон" value={form.sender_phone} onChange={(value) => update('sender_phone', value)} placeholder="0670000000" />
          <NovaPostLookup label="Місто відправника" placeholder="Почніть вводити місто" endpoint="/api/delivery/novapost/cities/" queryKey="q" value={form.sender_city} onManual={(value) => setForm({ ...form, sender_city: value, sender_city_ref: '' })} onSelect={selectCity} renderItem={(item) => <><b>{item.description}</b>{item.area && <span> · {item.area}</span>}{item.settlement_type && <span> · {item.settlement_type}</span>}</>} />
          <NovaPostLookup label="Відділення відправника" placeholder={form.sender_city_ref ? 'Введіть номер або адресу' : 'Спочатку виберіть місто'} endpoint="/api/delivery/novapost/warehouses/" queryKey="q" disabled={!form.sender_city_ref} extraParams={{ city_ref: form.sender_city_ref }} value={form.sender_warehouse} onManual={(value) => setForm({ ...form, sender_warehouse: value, sender_warehouse_ref: '' })} onSelect={selectWarehouse} renderItem={(item) => <><b>{item.description}</b>{item.short_address && <span> · {item.short_address}</span>}</>} />
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <RefBox label="Ref міста" value={form.sender_city_ref} />
            <RefBox label="Ref відділення" value={form.sender_warehouse_ref} />
          </div>
          <label className="md:col-span-2 flex flex-wrap gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm font-black text-slate-700">
            <span className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.is_default} onChange={(e) => update('is_default', e.target.checked)} /> Основний профіль</span>
            <span className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Активний</span>
          </label>
        </div>
        <div className="px-5 md:px-6 pb-5 md:pb-6 flex flex-col sm:flex-row justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black uppercase disabled:opacity-60">Скасувати</button>
          <button disabled={saving} className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase disabled:opacity-60">{saving ? 'Зберігаємо...' : 'Зберегти профіль'}</button>
        </div>
      </form>
    </div>
  );
}

function NovaPostLookup({ label, value, onManual, onSelect, placeholder, endpoint, queryKey, extraParams = {}, disabled = false, renderItem }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (disabled || q.length < 2) { setResults([]); setError(''); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ ...extraParams, [queryKey]: q });
        const res = await api.get(`${endpoint}?${params.toString()}`);
        setResults(Array.isArray(res.data?.results) ? res.data.results : []);
      } catch (err) {
        setResults([]);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, endpoint, queryKey, disabled, JSON.stringify(extraParams)]);

  return (
    <label className="relative">
      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</span>
      <div className={`flex items-center gap-2 rounded-2xl border ${disabled ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'} px-4 py-3 focus-within:border-blue-500`}>
        <Search size={16} className="text-slate-400 shrink-0" />
        <input disabled={disabled} value={query} onChange={(e) => { setQuery(e.target.value); onManual(e.target.value); }} placeholder={placeholder} className="w-full bg-transparent font-bold text-slate-800 outline-none disabled:text-slate-400" />
        {loading && <Loader2 size={16} className="animate-spin text-blue-600" />}
      </div>
      {error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}
      {results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((item) => <button type="button" key={item.ref} onClick={() => { onSelect(item); setResults([]); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-b-0 text-sm font-semibold text-slate-700">{renderItem(item)}</button>)}
        </div>
      )}
    </label>
  );
}

function RefBox({ label, value }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-600 break-all">{value || 'Заповниться після вибору'}</p></div>;
}

function Field({ label, value, onChange, placeholder, required }) {
  return <label><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</span><input required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none focus:border-blue-500" /></label>;
}

function ConfirmDelete({ profile, busy, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[30px] shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0"><AlertTriangle size={22}/></div>
          <div><h3 className="text-xl font-black uppercase text-slate-900">Видалити профіль?</h3><p className="text-sm font-bold text-slate-600 mt-1">Профіль “{profile.name}” буде видалено з налаштувань доставки.</p></div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-black uppercase disabled:opacity-60">Скасувати</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="rounded-2xl bg-rose-600 text-white px-4 py-3 text-xs font-black uppercase disabled:opacity-60">{busy ? 'Видаляємо...' : 'Видалити'}</button>
        </div>
      </div>
    </div>
  );
}

export default DeliverySettings;
