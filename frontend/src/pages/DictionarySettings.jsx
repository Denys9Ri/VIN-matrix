import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Plus, RefreshCcw, Save, Search, Settings2, SlidersHorizontal, Trash2, X, Loader2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Alert, AppPage, Button, Card, EmptyState, PageHeader, useToast } from '../components/ui';

const GROUPS = [
  { key: 'store_order_status', title: 'Статуси магазину', desc: 'Колонки дошки замовлень магазину', mode: 'store' },
  { key: 'sto_visit_status', title: 'Статуси СТО', desc: 'Етапи роботи з візитом СТО', mode: 'sto' },
  { key: 'part_status', title: 'Статуси товарів', desc: 'Статуси запчастин і позицій у замовленні', mode: 'both' },
  { key: 'payment_type', title: 'Типи оплат', desc: 'Готівка, картка, ФОП, післяплата', mode: 'both' },
  { key: 'order_source', title: 'Джерела', desc: 'Телефон, авторинок, сайт, соцмережі', mode: 'both' },
  { key: 'cancel_reason', title: 'Причини відмов', desc: 'Причини скасування і відмов клієнтів', mode: 'both' },
  { key: 'client_status', title: 'Статуси клієнтів', desc: 'Новий, активний, постійний, VIP', mode: 'both' },
  { key: 'product_category', title: 'Категорії товарів', desc: 'Базовий довідник категорій для складу', mode: 'both' },
];
const COLORS = ['blue', 'emerald', 'amber', 'orange', 'rose', 'indigo', 'purple', 'slate', 'cyan', 'green', 'pink', 'sky', 'yellow'];
const MODES = [['store', 'Магазин'], ['sto', 'СТО'], ['both', 'Обидва'], ['system', 'Система']];
const stripeMap = { blue:'bg-blue-500', emerald:'bg-emerald-500', amber:'bg-amber-500', orange:'bg-orange-500', rose:'bg-rose-500', indigo:'bg-indigo-500', purple:'bg-purple-500', slate:'bg-slate-500', cyan:'bg-cyan-500', green:'bg-green-500', pink:'bg-pink-500', sky:'bg-sky-500', yellow:'bg-yellow-400' };

export default function DictionarySettings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeGroup, setActiveGroup] = useState('store_order_status');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [form, setForm] = useState(emptyForm('store_order_status'));
  const group = GROUPS.find((g) => g.key === activeGroup) || GROUPS[0];

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/settings/options/?group=${activeGroup}&grouped=false`);
      setItems(res.data?.items || []);
    } catch {
      toast.error('Не вдалося завантажити довідники.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); setForm(emptyForm(activeGroup)); setEditing(null); }, [activeGroup]);

  const visibleItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => !q || [item.label, item.key, item.description, item.semantic_role].join(' ').toLowerCase().includes(q));
  }, [items, search]);

  const saveItem = async (event) => {
    event.preventDefault();
    const payload = { ...form, group: activeGroup, sort_order: Number(form.sort_order) || 100, metadata: parseMetadata(form.metadata) };
    try {
      if (editing?.id) await api.patch(`/api/settings/options/${editing.id}/`, payload);
      else await api.post('/api/settings/options/', payload);
      setForm(emptyForm(activeGroup));
      setEditing(null);
      toast.success(editing ? 'Пункт довідника оновлено.' : 'Пункт довідника додано.');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Не вдалося зберегти пункт довідника.');
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    setForm({
      mode: item.mode || group.mode || 'both', key: item.key || '', label: item.label || '', description: item.description || '', color: item.color || 'slate', icon: item.icon || '', sort_order: item.sort_order ?? 100, is_active: item.is_active !== false, is_default: item.is_default === true, semantic_role: item.semantic_role || '', metadata: JSON.stringify(item.metadata || {}, null, 2),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (item) => {
    try { await api.patch(`/api/settings/options/${item.id}/`, { is_active: !item.is_active }); toast.success(item.is_active ? 'Пункт вимкнено.' : 'Пункт увімкнено.'); await load(); }
    catch { toast.error('Не вдалося змінити активність.'); }
  };

  const removeItem = async (item) => {
    try { await api.delete(`/api/settings/options/${item.id}/`); setConfirmAction(null); toast.success(item.is_system ? 'Системний пункт вимкнено.' : 'Пункт видалено.'); await load(); }
    catch { toast.error('Не вдалося видалити пункт.'); }
  };

  const restoreDefaults = async () => {
    try { await api.post('/api/settings/options/bulk/', { action: 'restore_defaults' }); setConfirmAction(null); toast.success('Стандартні пункти відновлено.'); await load(); }
    catch { toast.error('Не вдалося відновити дефолти.'); }
  };

  return <AppPage className="max-w-7xl pb-24 space-y-6">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate('/settings')} icon={<ArrowLeft size={16}/>}>Назад до налаштувань</Button>
        <PageHeader icon={<Settings2/>} title="Статуси і довідники" subtitle="Налаштовуйте назви, кольори, порядок, активність і системну роль статусів без зміни коду." />
      </div>
      <Button variant="dark" onClick={() => setConfirmAction({ type: 'restore' })} icon={<RefreshCcw size={16}/>}>Відновити дефолти</Button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] gap-6 items-start">
      <aside className="bg-white rounded-[30px] border border-slate-200 shadow-sm p-3 space-y-2 lg:sticky lg:top-20">
        {GROUPS.map((g) => <button key={g.key} onClick={() => setActiveGroup(g.key)} className={`w-full rounded-2xl p-4 text-left border transition ${activeGroup === g.key ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-white hover:border-blue-100'}`}>
          <div className="flex items-center gap-3"><SlidersHorizontal size={18}/><span className="font-black uppercase text-sm">{g.title}</span></div>
          <p className={`text-xs font-bold mt-1 ${activeGroup === g.key ? 'text-blue-100' : 'text-slate-400'}`}>{g.desc}</p>
        </button>)}
      </aside>

      <main className="space-y-5 min-w-0">
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div><h2 className="font-black uppercase text-slate-900 flex items-center gap-2"><Settings2 size={20} className="text-blue-600"/> {group.title}</h2><p className="text-sm font-semibold text-slate-500 mt-1">{group.desc}</p></div>
            <div className="relative w-full xl:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Пошук у довіднику..." className="w-full rounded-2xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></div>
          </div>

          <form onSubmit={saveItem} className="bg-slate-50 border border-slate-200 rounded-[26px] p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Input label="Назва" value={form.label} required onChange={(v) => setForm({ ...form, label: v })} />
            <Input label="Ключ" value={form.key} placeholder="можна лишити пустим" onChange={(v) => setForm({ ...form, key: v })} disabled={Boolean(editing)} />
            <Select label="Режим" value={form.mode} onChange={(v) => setForm({ ...form, mode: v })} options={MODES} />
            <Select label="Колір" value={form.color} onChange={(v) => setForm({ ...form, color: v })} options={COLORS.map((c) => [c, c])} />
            <Input label="Іконка" value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
            <Input label="Порядок" type="number" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
            <Input label="Системна роль" value={form.semantic_role} onChange={(v) => setForm({ ...form, semantic_role: v })} />
            <Input label="Опис" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <Check label="Активний" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            <Check label="За замовчуванням" checked={form.is_default} onChange={(v) => setForm({ ...form, is_default: v })} />
            <div className="md:col-span-2 xl:col-span-2 flex gap-2"><Button type="submit" icon={<Save size={16}/>} className="flex-1">{editing ? 'Зберегти' : 'Додати'}</Button>{editing && <Button type="button" variant="secondary" icon={<X size={16}/>} iconOnly onClick={() => { setEditing(null); setForm(emptyForm(activeGroup)); }} />}</div>
          </form>

          <div className="space-y-3">
            {loading ? <EmptyState title="Завантаження..." /> : visibleItems.map((item) => <OptionCard key={item.id} item={item} onEdit={() => startEdit(item)} onToggle={() => toggleActive(item)} onDelete={() => setConfirmAction({ type: 'delete', item })} />)}
            {!loading && visibleItems.length === 0 && <EmptyState title="Нічого не знайдено" />}
          </div>
        </Card>
      </main>
    </div>

    {confirmAction?.type === 'delete' && <ConfirmModal title={confirmAction.item?.is_system ? 'Вимкнути системний пункт?' : 'Видалити пункт?'} text={confirmAction.item?.is_system ? 'Системний пункт буде вимкнено, а не видалено.' : `Пункт “${confirmAction.item?.label}” буде видалено з довідника.`} onClose={() => setConfirmAction(null)} onConfirm={() => removeItem(confirmAction.item)} />}
    {confirmAction?.type === 'restore' && <ConfirmModal title="Відновити дефолти?" text="Системні пункти будуть відновлені. Ваші власні пункти залишаться." onClose={() => setConfirmAction(null)} onConfirm={restoreDefaults} />}
  </AppPage>;
}

function emptyForm(group) { return { mode: group === 'store_order_status' ? 'store' : group === 'sto_visit_status' ? 'sto' : 'both', key: '', label: '', description: '', color: 'slate', icon: '', sort_order: 100, is_active: true, is_default: false, semantic_role: '', metadata: '{}' }; }
function parseMetadata(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function Input({ label, value, onChange, required, type = 'text', placeholder, disabled }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">{label}</span><input disabled={disabled} required={required} type={type} placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"/></label>; }
function Select({ label, value, onChange, options }) { return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>; }
function Check({ label, checked, onChange }) { return <label className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 font-black text-xs uppercase text-slate-600"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}/> {label}</label>; }
function OptionCard({ item, onEdit, onToggle, onDelete }) { return <div className={`rounded-3xl border p-4 bg-white shadow-sm ${item.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div className="min-w-0 flex items-start gap-3"><span className={`mt-1 w-4 h-12 rounded-full ${stripeMap[item.color] || stripeMap.slate} shadow-sm`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900 break-words">{item.label}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{item.key}</span>{item.is_system && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase text-blue-700">system</span>}{item.is_default && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">default</span>}</div><p className="text-sm font-semibold text-slate-500 mt-1">{item.description || 'Без опису'}</p><div className="flex flex-wrap gap-2 mt-2 text-[10px] font-black uppercase text-slate-400"><span>mode: {item.mode}</span><span>role: {item.semantic_role || '—'}</span><span>sort: {item.sort_order}</span><span>color: {item.color}</span></div></div></div><div className="flex gap-2 shrink-0"><button type="button" onClick={onToggle} className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center">{item.is_active ? <Eye size={16}/> : <EyeOff size={16}/>}</button><button type="button" onClick={onEdit} className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center"><Pencil size={16}/></button><button type="button" onClick={onDelete} className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center"><Trash2 size={16}/></button></div></div></div>; }
function ConfirmModal({ title, text, onClose, onConfirm }) { return <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md p-6"><h3 className="text-xl font-black text-slate-900 uppercase">{title}</h3><p className="text-sm font-bold text-slate-500 mt-2">{text}</p><div className="grid grid-cols-2 gap-3 mt-6"><Button variant="secondary" onClick={onClose}>Скасувати</Button><Button variant="danger" onClick={onConfirm}>Підтвердити</Button></div></div></div>; }
