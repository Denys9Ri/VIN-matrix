const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/pages/StoreOrdersDictionaryBoard.jsx');
let src = fs.readFileSync(file, 'utf8');

// Surgical fix for PartsPanel JSX: parts.map(...) had one extra closing parenthesis.
src = src.replace(
  'onClick={() => onDelete(p)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600"><Trash2 size={14}/></button></div></div></div>))}</div></Panel>; }',
  'onClick={() => onDelete(p)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600"><Trash2 size={14}/></button></div></div></div>)}</div></Panel>; }'
);

if (!src.includes('const fallbackOrderSources = [')) {
  src = src.replace(
    "const emptyOrder = { client: '', phone: '', plate: '', vin_code: '', source: 'Телефон', delivery_type: 'pickup', payment_status: 'unpaid', comment: '' };",
    "const emptyOrder = { client: '', phone: '', plate: '', vin_code: '', source: 'phone', delivery_type: 'pickup', payment_status: 'unpaid', comment: '' };\nconst fallbackOrderSources = [\n  { key: 'phone', label: 'Телефон' },\n  { key: 'market', label: 'Авторинок' },\n  { key: 'prom', label: 'Prom.ua' },\n  { key: 'rozetka', label: 'Rozetka' },\n  { key: 'instagram', label: 'Instagram' },\n  { key: 'telegram', label: 'Telegram' },\n  { key: 'regular_client', label: 'Постійний клієнт' },\n  { key: 'recommendation', label: 'Рекомендація' },\n];\nconst fallbackCancelReasons = [\n  { key: 'changed_mind', label: 'Клієнт передумав' },\n  { key: 'expensive', label: 'Дорого' },\n  { key: 'no_answer', label: 'Не дозвонились' },\n  { key: 'found_cheaper', label: 'Знайшов дешевше' },\n  { key: 'not_available', label: 'Немає товару' },\n  { key: 'too_long', label: 'Довго чекати' },\n  { key: 'selection_error', label: 'Помилка підбору' },\n  { key: 'other', label: 'Інше' },\n];"
  );
}

if (!src.includes('function optionLabel(options')) {
  src = src.replace(
    "function hint(order, statusLabel) { const d = parseDelivery(order), parts = arr(order.parts); if (d.delivery_status === 'sent') return `Статус: ${statusLabel}. Замовлення відправлено.`; if (!parts.length) return `Статус: ${statusLabel}. Додайте товари, щоб вести замовлення далі.`; if (parts.some((p) => ['WAITING', 'IN_TRANSIT', 'ORDERED'].includes(p.status || 'WAITING'))) return `Статус: ${statusLabel}. Є товари в очікуванні.`; return `Статус: ${statusLabel}. Усі товари отримано.`; }",
    "function hint(order, statusLabel) { const d = parseDelivery(order), parts = arr(order.parts); if (d.delivery_status === 'sent') return `Статус: ${statusLabel}. Замовлення відправлено.`; if (!parts.length) return `Статус: ${statusLabel}. Додайте товари, щоб вести замовлення далі.`; if (parts.some((p) => ['WAITING', 'IN_TRANSIT', 'ORDERED'].includes(p.status || 'WAITING'))) return `Статус: ${statusLabel}. Є товари в очікуванні.`; return `Статус: ${statusLabel}. Усі товари отримано.`; }\nfunction optionLabel(options, key) { const item = arr(options).find((x) => String(x.key) === String(key) || String(x.label) === String(key)); return item?.label || key || '—'; }\nfunction activeOptions(list, fallback) { const source = arr(list).filter((x) => x.is_active !== false); return source.length ? source : fallback; }"
  );
}

src = src.replace(
  "const [statuses, setStatuses] = useState([]), [partStatuses, setPartStatuses] = useState([]);",
  "const [statuses, setStatuses] = useState([]), [partStatuses, setPartStatuses] = useState([]), [orderSources, setOrderSources] = useState(fallbackOrderSources), [cancelReasons, setCancelReasons] = useState(fallbackCancelReasons);"
);

src = src.replace(
  "const loadDictionaries = async () => { try { const r = await api.get('/api/settings/dictionaries/?mode=store'); setStatuses(arr(r.data?.store_order_status)); setPartStatuses(arr(r.data?.part_status)); } catch { setStatuses([]); setPartStatuses([]); } };",
  "const loadDictionaries = async () => { try { const r = await api.get('/api/settings/dictionaries/?mode=store'); setStatuses(arr(r.data?.store_order_status)); setPartStatuses(arr(r.data?.part_status)); setOrderSources(activeOptions(r.data?.order_source, fallbackOrderSources)); setCancelReasons(activeOptions(r.data?.cancel_reason, fallbackCancelReasons)); } catch { setStatuses([]); setPartStatuses([]); setOrderSources(fallbackOrderSources); setCancelReasons(fallbackCancelReasons); } };"
);

src = src.replace(
  "const createOrder = async (e) => { e.preventDefault(); setBusy(true); try { const delivery = { source: orderForm.source, delivery_status: 'draft', mode: 'store' };",
  "const createOrder = async (e) => { e.preventDefault(); setBusy(true); try { const delivery = { source: orderForm.source, source_label: optionLabel(orderSources, orderForm.source), delivery_status: 'draft', mode: 'store' };"
);

src = src.replace(
  "const cancelOrder = async (reason) => { const delivery = { ...parseDelivery(selected), cancel_reason: reason }; await patchOrder({ status: 'CANCELLED', delivery_data: JSON.stringify(delivery) }); setModal(null); };",
  "const cancelOrder = async (reason) => { const key = reason?.key || reason; const delivery = { ...parseDelivery(selected), cancel_reason: key, cancel_reason_label: reason?.label || optionLabel(cancelReasons, key) }; await patchOrder({ status: 'CANCELLED', delivery_data: JSON.stringify(delivery) }); setModal(null); };"
);

src = src.replace(
  "delivery_data: JSON.stringify({ source: 'Швидкий продаж', mode: 'store', quick_sale: true, delivery_status: 'received' }),",
  "delivery_data: JSON.stringify({ source: 'quick_sale', source_label: 'Швидкий продаж', mode: 'store', quick_sale: true, delivery_status: 'received' }),"
);

src = src.replace(
  "<Drawer order={selected} tab={tab} setTab={setTab} setOrder={setSelected} onPatch={patchOrder} onPay={markPaid}",
  "<Drawer order={selected} tab={tab} setTab={setTab} setOrder={setSelected} orderSources={orderSources} onPatch={patchOrder} onPay={markPaid}"
);

src = src.replace(
  "<OrderForm form={orderForm} setForm={setOrderForm} onSubmit={createOrder} busy={busy} />",
  "<OrderForm form={orderForm} setForm={setOrderForm} onSubmit={createOrder} busy={busy} orderSources={orderSources} />"
);

src = src.replace(
  "<CancelModal onClose={() => setModal(null)} onSubmit={cancelOrder} busy={busy} />",
  "<CancelModal onClose={() => setModal(null)} onSubmit={cancelOrder} busy={busy} cancelReasons={cancelReasons} />"
);

src = src.replace(
  "function Drawer(p) { const { order, tab, setTab, setOrder, onPatch, onPay, onPrepay, onUpdateDelivery, onCancel, partForm, setPartForm, onAddPart, onPartStatus, onDelete, statuses, partStatuses, getStatusLabel } = p;",
  "function Drawer(p) { const { order, tab, setTab, setOrder, orderSources = fallbackOrderSources, onPatch, onPay, onPrepay, onUpdateDelivery, onCancel, partForm, setPartForm, onAddPart, onPartStatus, onDelete, statuses, partStatuses, getStatusLabel } = p;"
);

src = src.replace(
  '<Info label="Джерело" value={d.source || \'-\'} />',
  '<Info label="Джерело" value={d.source_label || optionLabel(orderSources, d.source)} />'
);

const oldOrderForm = `function OrderForm({ form, setForm, onSubmit, busy }) { return <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3"><input required placeholder="Клієнт" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={field} /><input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} /><input placeholder="Авто / номер" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className={field} /><input placeholder="VIN" value={form.vin_code} onChange={(e) => setForm({ ...form, vin_code: e.target.value })} className={field} /><textarea placeholder="Коментар" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={field} /><button disabled={busy} className={primaryBtn}>Створити</button></form>; }`;
const newOrderForm = `function OrderForm({ form, setForm, onSubmit, busy, orderSources = fallbackOrderSources }) { return <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3"><input required placeholder="Клієнт" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={field} /><input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} /><input placeholder="Авто / номер" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className={field} /><input placeholder="VIN" value={form.vin_code} onChange={(e) => setForm({ ...form, vin_code: e.target.value })} className={field} /><select value={form.source || 'phone'} onChange={(e) => setForm({ ...form, source: e.target.value })} className={field}>{orderSources.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select><textarea placeholder="Коментар" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className={field} /><button disabled={busy} className={primaryBtn}>Створити</button></form>; }`;
if (src.includes(oldOrderForm)) src = src.replace(oldOrderForm, newOrderForm);

const oldCancelModal = `function CancelModal({ onClose, onSubmit, busy }) { const [reason, setReason] = useState('Клієнт передумав'); return <Modal title="Скасувати замовлення" onClose={onClose}><select value={reason} onChange={(e) => setReason(e.target.value)} className={field}><option>Клієнт передумав</option><option>Дорого</option><option>Немає в наявності</option><option>Довго чекати</option><option>Інше</option></select><button disabled={busy} onClick={() => onSubmit(reason)} className="mt-3 w-full bg-rose-600 text-white rounded-2xl py-3 font-black uppercase text-xs">Скасувати</button></Modal>; }`;
const newCancelModal = `function CancelModal({ onClose, onSubmit, busy, cancelReasons = fallbackCancelReasons }) { const [reason, setReason] = useState(cancelReasons[0]?.key || 'changed_mind'); const selected = cancelReasons.find((item) => item.key === reason) || cancelReasons[0]; return <Modal title="Скасувати замовлення" onClose={onClose}><select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>{cancelReasons.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button disabled={busy} onClick={() => onSubmit(selected || reason)} className="mt-3 w-full bg-rose-600 text-white rounded-2xl py-3 font-black uppercase text-xs">Скасувати</button></Modal>; }`;
if (src.includes(oldCancelModal)) src = src.replace(oldCancelModal, newCancelModal);

fs.writeFileSync(file, src);
console.log('StoreOrdersDictionaryBoard.jsx syntax/source/cancel dictionary guard applied.');
