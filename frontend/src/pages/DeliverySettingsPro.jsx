import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
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

export default function DeliverySettingsPro() {
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
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 p-3 pb-24 md:p-8 md:pb-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft size={16}/>
              <span className="sm:hidden">Налаштування</span>
              <span className="hidden sm:inline">Назад до налаштувань</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <Truck size={14}/> Доставка
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-950 md:text-4xl">Нова пошта</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-500 md:text-base">Керуйте відправниками, API-ключами та основним профілем. Один бізнес може мати кілька ФОП, складів або менеджерів для відправки.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 md:w-auto">
          <Plus size={18}/> Додати профіль
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Профілі" value={profiles.length} icon={<Truck size={20}/>} />
        <StatCard title="Активні" value={activeCount} icon={<BadgeCheck size={20}/>} tone="emerald" />
        <StatCard title="Основний" value={defaultProfile?.name || 'Не вибрано'} icon={<Star size={20}/>} tone="amber" small />
      </section>

      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100"><ShieldCheck size={15}/> Профілі відправника</div>
            <h2 className="mt-2 text-2xl font-black uppercase italic">API-ключі та відправники</h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-blue-50/80">API-ключі не показуються повністю — тільки маска для безпеки. Місто та відділення можна знайти через довідники Нової пошти.</p>
          </div>
          <button type="button" onClick={loadProfiles} disabled={loading} className="min-h-[44px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-black uppercase text-white transition hover:bg-white/20 disabled:opacity-60">{loading ? 'Оновлення...' : 'Оновити'}</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 font-black text-slate-500"><Loader2 className="animate-spin"/> Завантаження профілів...</div>
        ) : profiles.length === 0 ? (
          <div className="p-8 text-center md:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-blue-50 text-blue-600"><PackageCheck size={34}/></div>
            <h3 className="mt-5 text-2xl font-black text-slate-900">Профілів ще немає</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-500">Додайте перший API-ключ Нової пошти, щоб створювати ТТН, перевіряти статуси та бачити трекінг прямо в замовленні.</p>
            <button type="button" onClick={openCreate} className="mt-6 inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase text-white"><Plus size={18}/> Додати профіль</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:p-6 xl:grid-cols-2">
            {profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} busy={busyId === profile.id} onTest={testProfile} onEdit={openEdit} onMakeDefault={(item) => patchProfile(item, { is_default: true }, 'Основний профіль змінено.')} onToggle={(item) => patchProfile(item, { is_active: !item.is_active }, item.is_active ? 'Профіль вимкнено.' : 'Профіль увімкнено.')} onDelete={setDeleteTarget} />)}
          </div>
        )}
      </section>

      {modal && <DeliveryProfileModal title={modal.title} form={form} setForm={setForm} onClose={() => setModal(null)} onSubmit={submitProfile} isEdit={modal.type === 'edit'} saving={saving} />}
      {deleteTarget && <ConfirmDelete profile={deleteTarget} busy={busyId === deleteTarget.id} onClose={() => setDeleteTarget(null)} onConfirm={deleteProfile} />}
    </div>
  );
}

function Notice({ notice, onClose }) {
  const isError = notice.type === 'error';
  return <div className={`${isError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-blue-100 bg-blue-50 text-blue-800'} flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold`}><span className="break-words">{notice.text}</span><button type="button" onClick={onClose} className="shrink-0 opacity-70 transition hover:opacity-100" aria-label="Закрити"><X size={16}/></button></div>;
}

function StatCard({ title, value, icon, tone = 'blue', small = false }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700' };
  return <div className="flex items-center justify-between gap-4 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p><p className={`${small ? 'text-lg' : 'text-3xl'} mt-1 max-w-[240px] truncate font-black text-slate-900`}>{value}</p></div><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</div></div>;
}

function ProfileCard({ profile, busy, onTest, onEdit, onMakeDefault, onToggle, onDelete }) {
  return <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/60 transition hover:shadow-xl hover:shadow-blue-100/40">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xl font-black text-slate-900">{profile.name}</h3>{profile.is_default && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase text-amber-700"><Star size={12}/> Основний</span>}<span className={`${profile.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'} rounded-full px-3 py-1 text-[10px] font-black uppercase`}>{profile.is_active ? 'Активний' : 'Вимкнений'}</span></div><p className="mt-2 text-xs font-bold text-slate-400">Ключ: {profile.api_key_masked || 'не вказано'}</p></div><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Truck size={22}/></div></div>
    <div className="grid grid-cols-1 gap-3 p-5 text-sm sm:grid-cols-2"><Info label="Відправник" value={profile.sender_name || '—'} /><Info label="Телефон" value={profile.sender_phone || '—'} /><Info label="Місто" value={profile.sender_city || '—'} icon={<MapPin size={14}/>} /><Info label="Відділення" value={profile.sender_warehouse || '—'} /></div>
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white p-4"><ActionButton disabled={busy} onClick={() => onTest(profile)}>{busy ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>} Перевірити ключ</ActionButton><ActionButton disabled={busy} onClick={() => onEdit(profile)}><Pencil size={15}/> Редагувати</ActionButton>{!profile.is_default && <ActionButton disabled={busy} onClick={() => onMakeDefault(profile)}><Star size={15}/> Зробити основним</ActionButton>}<ActionButton disabled={busy} onClick={() => onToggle(profile)}><Power size={15}/> {profile.is_active ? 'Вимкнути' : 'Увімкнути'}</ActionButton><ActionButton disabled={busy} danger onClick={() => onDelete(profile)}><Trash2 size={15}/> Видалити</ActionButton></div>
  </article>;
}

function Info({ label, value, icon }) {
  return <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3"><p className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">{icon}{label}</p><p className="mt-1 break-words font-black text-slate-800">{value}</p></div>;
}

function ActionButton({ children, onClick, disabled, danger = false }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`${danger ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'} inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black uppercase disabled:opacity-60`}>{children}</button>;
}

function DeliveryProfileModal({ title, form, setForm, onClose, onSubmit, isEdit, saving }) {
  const update = (key, value) => setForm({ ...form, [key]: value });
  const selectCity = (city) => setForm({ ...form, sender_city: city.description, sender_city_ref: city.ref, sender_warehouse: '', sender_warehouse_ref: '' });
  const selectWarehouse = (warehouse) => setForm({ ...form, sender_warehouse: warehouse.description || warehouse.short_address, sender_warehouse_ref: warehouse.ref });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex bg-slate-950/65 backdrop-blur-sm md:items-center md:justify-center md:p-6">
      <form onSubmit={onSubmit} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white md:h-auto md:max-h-[90dvh] md:max-w-3xl md:rounded-[32px] md:shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 p-5 text-white md:p-6"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Нова пошта</p><h2 className="mt-1 break-words text-2xl font-black uppercase italic leading-tight">{title}</h2><p className="mt-2 text-sm font-semibold leading-relaxed text-blue-50/85">Дані зберігаються тільки для вашої компанії. Місто та відділення можна знайти через API Нової пошти.</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 transition hover:bg-white/20" aria-label="Закрити"><X size={20}/></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-7 md:p-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Назва профілю" value={form.name} onChange={(value) => update('name', value)} placeholder="ФОП Іваненко / Склад Київ" required /><Field label={isEdit ? 'Новий API-ключ (необовʼязково)' : 'API-ключ'} value={form.api_key || ''} onChange={(value) => update('api_key', value)} placeholder="Вставте API-ключ Нової пошти" required={!isEdit} /><Field label="Відправник" value={form.sender_name} onChange={(value) => update('sender_name', value)} placeholder="ПІБ або назва ФОП" /><Field label="Телефон" value={form.sender_phone} onChange={(value) => update('sender_phone', value)} placeholder="0670000000" /><NovaPostLookup label="Місто відправника" placeholder="Почніть вводити місто" endpoint="/api/delivery/novapost/cities/" queryKey="q" value={form.sender_city} onManual={(value) => setForm({ ...form, sender_city: value, sender_city_ref: '' })} onSelect={selectCity} renderItem={(item) => <><b>{item.description}</b>{item.area && <span> · {item.area}</span>}{item.settlement_type && <span> · {item.settlement_type}</span>}</>} /><NovaPostLookup label="Відділення відправника" placeholder={form.sender_city_ref ? 'Введіть номер або адресу' : 'Спочатку виберіть місто'} endpoint="/api/delivery/novapost/warehouses/" queryKey="q" disabled={!form.sender_city_ref} extraParams={{ city_ref: form.sender_city_ref }} value={form.sender_warehouse} onManual={(value) => setForm({ ...form, sender_warehouse: value, sender_warehouse_ref: '' })} onSelect={selectWarehouse} renderItem={(item) => <><b>{item.description}</b>{item.short_address && <span> · {item.short_address}</span>}</>} /><div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2"><RefBox label="Ref міста" value={form.sender_city_ref} /><RefBox label="Ref відділення" value={form.sender_warehouse_ref} /></div><label className="flex flex-wrap gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-black text-slate-700 md:col-span-2"><span className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.is_default} onChange={(e) => update('is_default', e.target.checked)} /> Основний профіль</span><span className="inline-flex items-center gap-2"><input type="checkbox" checked={!!form.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Активний</span></label></div></div>
        <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-2 md:px-6"><button type="button" onClick={onClose} disabled={saving} className="min-h-[48px] rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700 disabled:opacity-60">Скасувати</button><button disabled={saving} className="min-h-[48px] rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 disabled:opacity-60">{saving ? 'Зберігаємо...' : 'Зберегти профіль'}</button></div>
      </form>
    </div>,
    document.body,
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
    if (disabled || q.length < 2) { setResults([]); setError(''); return undefined; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ ...extraParams, [queryKey]: q });
        const res = await api.get(`${endpoint}?${params.toString()}`);
        setResults(Array.isArray(res.data?.results) ? res.data.results : []);
      } catch (error) {
        setResults([]);
        setError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, endpoint, queryKey, disabled, JSON.stringify(extraParams)]);

  return <label className="relative min-w-0"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span><div className={`flex min-h-[50px] items-center gap-2 rounded-2xl border px-4 py-3 ${disabled ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white focus-within:border-blue-500'}`}><Search size={16} className="shrink-0 text-slate-400"/><input disabled={disabled} value={query} onChange={(event) => { setQuery(event.target.value); onManual(event.target.value); }} placeholder={placeholder} className="w-full bg-transparent text-[16px] font-bold text-slate-800 outline-none placeholder:text-slate-400 disabled:text-slate-400 md:text-sm"/>{loading && <Loader2 size={16} className="animate-spin text-blue-600"/>}</div>{error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}{results.length > 0 && <div className="absolute left-0 right-0 z-[120] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">{results.map((item) => <button type="button" key={item.ref} onClick={() => { onSelect(item); setResults([]); }} className="w-full border-b border-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 last:border-b-0">{renderItem(item)}</button>)}</div>}</label>;
}

function RefBox({ label, value }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 break-all text-xs font-bold text-slate-600">{value || 'Заповниться після вибору'}</p></div>; }
function Field({ label, value, onChange, placeholder, required }) { return <label className="min-w-0"><span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span><input required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-[50px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 placeholder:text-slate-400 md:text-sm"/></label>; }

function ConfirmDelete({ profile, busy, onClose, onConfirm }) {
  return createPortal(<div className="fixed inset-0 z-[110] flex bg-slate-950/65 p-4 backdrop-blur-sm md:items-center md:justify-center"><div role="dialog" aria-modal="true" className="w-full self-end overflow-hidden rounded-[28px] bg-white shadow-2xl md:max-w-md md:self-auto"><div className="flex items-start gap-3 border-b border-rose-100 bg-rose-50 p-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><AlertTriangle size={22}/></div><div><h3 className="text-xl font-black uppercase text-slate-900">Видалити профіль?</h3><p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">Профіль “{profile.name}” буде видалено з налаштувань доставки.</p></div></div><div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2"><button type="button" disabled={busy} onClick={onClose} className="min-h-[46px] rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black uppercase text-slate-700 disabled:opacity-60">Скасувати</button><button type="button" disabled={busy} onClick={onConfirm} className="min-h-[46px] rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-60">{busy ? 'Видаляємо...' : 'Видалити'}</button></div></div></div>, document.body);
}
