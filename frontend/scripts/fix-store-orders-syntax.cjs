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

// Settings.jsx: show editable client link in billing card.
const settingsFile = path.resolve(__dirname, '../src/pages/Settings.jsx');
let settingsSrc = fs.readFileSync(settingsFile, 'utf8');
if (!settingsSrc.includes('clientLink, setClientLink')) {
  settingsSrc = settingsSrc.replace("const [billingNotice, setBillingNotice] = useState('');", "const [billingNotice, setBillingNotice] = useState('');\n  const [clientLink, setClientLink] = useState(null);");
}
if (!settingsSrc.includes("/api/billing/client-link/")) {
  settingsSrc = settingsSrc.replace(
    "const profileRes = await axios.get(`${API_BASE}/api/settings/`, { headers: authHeaders });",
    "const profileRes = await axios.get(`${API_BASE}/api/settings/`, { headers: authHeaders });\n      axios.get(`${API_BASE}/api/billing/client-link/`, { headers: authHeaders }).then((res) => setClientLink(res.data?.client_link_settings || null)).catch(() => setClientLink(null));"
  );
}
settingsSrc = settingsSrc.replace(
  "<BillingCard billing={billing} tone={tone} notice={billingNotice} loading={billingLoading} onPayment={requestPayment} />",
  "<BillingCard billing={billing} clientLink={clientLink} tone={tone} notice={billingNotice} loading={billingLoading} onPayment={requestPayment} />"
);
const billingCardRe = /const BillingCard = \(\{ billing = \{\}, tone, notice, loading, onPayment \}\) => \([\s\S]*?\n\);\n\nconst BillingMetric =/;
const newBillingCard = `const BillingCard = ({ billing = {}, clientLink = null, tone, notice, loading, onPayment }) => {
  const link = clientLink || {};
  const clientCode = link.client_comment || link.client_code || billing.client_code_display || billing.client_code || 'C6003';
  const price = link.monthly_value || billing.price || 2000;
  return (
    <div className={\`rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/60 bg-gradient-to-r \${tone.box} text-white\`}>
      <div className="p-5 md:p-6 grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-5 items-stretch">
        <div>
          <div className="flex items-center gap-2 text-white/80 text-[10px] font-black uppercase tracking-widest"><CreditCard size={15}/> Тариф і оплата</div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><h2 className="text-2xl md:text-3xl font-black uppercase italic">{billing.plan_name || 'VIN-matrix Full'}</h2><span className={\`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase \${tone.badge}\`}>{billing.label || 'Активний'}</span></div>
          <p className="mt-3 text-sm md:text-base font-bold text-white/90 max-w-2xl">{billing.message || '14 днів безкоштовно, потім 2000 грн/місяць. Усі функції включені.'}</p>
          <div className="mt-4 bg-white/15 border border-white/20 rounded-3xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-white/70">Оплата тарифу</p><h3 className="text-lg font-black">{link.title || 'VIN-matrix підписка'}</h3><p className="text-xs font-bold text-white/75 mt-1">{link.instruction || 'При оплаті вкажіть код клієнта.'} <span className="font-black text-white">{clientCode}</span></p></div><span className="bg-white text-slate-900 rounded-2xl px-3 py-2 text-[10px] font-black uppercase whitespace-nowrap">{money(price, 'UAH')} / міс</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><button type="button" disabled={!link.public_url} onClick={() => link.public_url && window.open(link.public_url, '_blank', 'noopener,noreferrer')} className="bg-white text-slate-900 rounded-2xl px-4 py-3 text-xs font-black uppercase hover:bg-slate-50 disabled:opacity-60">Перейти до оплати</button><button type="button" onClick={() => copyValue(clientCode)} className="bg-slate-900/35 border border-white/20 text-white rounded-2xl px-4 py-3 text-xs font-black uppercase hover:bg-slate-900/50">Скопіювати код</button></div>
            <div className="bg-slate-900/25 border border-white/15 rounded-2xl p-3 text-xs font-bold text-white/85 space-y-1"><p><span className="text-white/60">Коментар до оплати:</span> {clientCode}</p>{link.public_note && <p><span className="text-white/60">Реквізити:</span> {link.public_note}</p>}{!link.public_url && <p className="text-amber-100">Посилання на оплату ще не додано адміністратором.</p>}</div>
          </div>
          {notice && <div className="mt-4 bg-white/15 border border-white/20 rounded-2xl px-4 py-3 text-sm font-bold">{notice}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3"><BillingMetric icon={<DollarSign size={16}/>} label="Сума" value={money(price, billing.currency || 'UAH')} /><BillingMetric icon={tone.icon} label="Статус" value={billing.label || 'Активний'} /><BillingMetric icon={<CalendarDays size={16}/>} label="Дата" value={billing.subscription_end_display || billing.trial_until_display || '14 днів тест'} /><BillingMetric icon={<Clock3 size={16}/>} label="Днів" value={billing.days_left !== null && billing.days_left !== undefined ? \`\${billing.days_left} дн.\` : billing.grace_days_left ? \`\${billing.grace_days_left} дн.\` : '—'} /></div>
      </div>
      <div className="bg-white/12 border-t border-white/15 p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3"><p className="text-xs font-bold text-white/80">Після оплати натисніть “Я оплатив”. Адміністратор перевірить оплату і підтвердить доступ.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto"><button disabled={loading} onClick={() => onPayment('monobank_jar')} className="bg-white text-slate-900 rounded-2xl px-5 py-3 text-xs font-black uppercase hover:bg-slate-50 disabled:opacity-60">{loading ? 'Зачекайте...' : 'Я оплатив'}</button><button disabled={loading} onClick={() => onPayment('cash')} className="bg-slate-900/35 border border-white/20 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase hover:bg-slate-900/50 disabled:opacity-60">Оплата готівкою</button></div></div>
    </div>
  );
};

const BillingMetric =`;
settingsSrc = settingsSrc.replace(billingCardRe, newBillingCard);
fs.writeFileSync(settingsFile, settingsSrc);

// PartnerClients.jsx: admin editable client link card.
const partnerFile = path.resolve(__dirname, '../src/pages/PartnerClients.jsx');
let partnerSrc = fs.readFileSync(partnerFile, 'utf8');
if (!partnerSrc.includes('clientLinkForm')) {
  partnerSrc = partnerSrc.replace("const [busyPaymentId, setBusyPaymentId] = useState(null);", "const [busyPaymentId, setBusyPaymentId] = useState(null);\n  const [clientLinkForm, setClientLinkForm] = useState({ title: 'VIN-matrix підписка', monthly_value: 2000, public_url: '', public_note: '', instruction: 'Вкажіть код клієнта. Наприклад: C6003', is_active: true });\n  const [clientLinkSaving, setClientLinkSaving] = useState(false);\n  const [clientLinkNotice, setClientLinkNotice] = useState('');");
  partnerSrc = partnerSrc.replace(
    "api.get('/api/platform-clients/subscription-alerts/'),\n      ]);",
    "api.get('/api/platform-clients/subscription-alerts/'),\n        api.get('/api/billing/admin/client-link/').catch(() => ({ data: {} })),\n      ]);"
  );
  partnerSrc = partnerSrc.replace(
    "const [clientsRes, statsRes, settingsRes, alertsRes] = await Promise.all([",
    "const [clientsRes, statsRes, settingsRes, alertsRes, clientLinkRes] = await Promise.all(["
  );
  partnerSrc = partnerSrc.replace("setAlerts(alertsRes.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });", "setAlerts(alertsRes.data || { expiring_soon: [], expired: [], expiring_count: 0, expired_count: 0 });\n      if (clientLinkRes.data?.client_link_settings) setClientLinkForm(clientLinkRes.data.client_link_settings);");
  partnerSrc = partnerSrc.replace(
    "const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);",
    "const saveClientLinkSettings = async (e) => {\n    e.preventDefault();\n    setClientLinkSaving(true);\n    setClientLinkNotice('');\n    try {\n      const res = await api.patch('/api/billing/admin/client-link/', clientLinkForm);\n      setClientLinkForm(res.data?.client_link_settings || clientLinkForm);\n      setClientLinkNotice(res.data?.message || 'Налаштування оплати збережено.');\n    } catch (error) {\n      setClientLinkNotice(`Не вдалося зберегти: ${getErrorMessage(error)}`);\n    } finally {\n      setClientLinkSaving(false);\n    }\n  };\n\n  const alertList = [...(alerts.expiring_soon || []), ...(alerts.expired || [])].slice(0, 5);"
  );
  partnerSrc = partnerSrc.replace(
    "</div>\n\n      <section className=\"bg-gradient-to-r from-slate-900 via-blue-800 to-cyan-600 rounded-[30px] shadow-xl shadow-blue-100 overflow-hidden text-white\">",
    "</div>\n\n      <ClientLinkSettingsCard form={clientLinkForm} setForm={setClientLinkForm} onSubmit={saveClientLinkSettings} saving={clientLinkSaving} notice={clientLinkNotice} />\n\n      <section className=\"bg-gradient-to-r from-slate-900 via-blue-800 to-cyan-600 rounded-[30px] shadow-xl shadow-blue-100 overflow-hidden text-white\">"
  );
}
if (!partnerSrc.includes('function ClientLinkSettingsCard')) {
  partnerSrc = partnerSrc.replace(
    "function StatCard({ label, value, tone = 'slate' }) {",
    "function ClientLinkSettingsCard({ form, setForm, onSubmit, saving, notice }) {\n  return <form onSubmit={onSubmit} className=\"bg-white rounded-[30px] border border-slate-200 shadow-sm overflow-hidden\"><div className=\"p-5 md:p-6 bg-slate-50/80 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3\"><div><div className=\"inline-flex items-center gap-2 text-blue-700 text-[10px] font-black uppercase tracking-widest\"><CreditCard size={15}/> Налаштування оплати</div><h2 className=\"text-2xl font-black uppercase italic mt-2 text-slate-900\">Посилання для клієнтів</h2><p className=\"text-sm font-semibold text-slate-500 mt-1\">Внесіть посилання, суму та інструкцію. Клієнти побачать це у блоці “Тариф і оплата”.</p></div><label className=\"flex items-center gap-2 text-sm font-black text-slate-700\"><input type=\"checkbox\" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}/> Активно</label></div><div className=\"p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4\"><input className=\"px-4 py-3 rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500\" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder=\"Назва оплати\"/><input type=\"number\" className=\"px-4 py-3 rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500\" value={form.monthly_value || 2000} onChange={(e) => setForm({ ...form, monthly_value: e.target.value })} placeholder=\"Сума за місяць\"/><input className=\"lg:col-span-2 px-4 py-3 rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500\" value={form.public_url || ''} onChange={(e) => setForm({ ...form, public_url: e.target.value })} placeholder=\"Посилання для оплати\"/><textarea className=\"lg:col-span-2 px-4 py-3 rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500 min-h-[84px]\" value={form.public_note || ''} onChange={(e) => setForm({ ...form, public_note: e.target.value })} placeholder=\"Реквізити або додаткова примітка\"/><textarea className=\"lg:col-span-2 px-4 py-3 rounded-2xl border border-slate-200 font-bold outline-none focus:border-blue-500 min-h-[84px]\" value={form.instruction || ''} onChange={(e) => setForm({ ...form, instruction: e.target.value })} placeholder=\"Інструкція для клієнта\"/></div><div className=\"px-5 md:px-6 pb-5 md:pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3\">{notice && <p className=\"text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3\">{notice}</p>}<button disabled={saving} className=\"md:ml-auto bg-slate-900 hover:bg-black text-white rounded-2xl px-6 py-3 text-xs font-black uppercase disabled:opacity-60\">{saving ? 'Зберігаю...' : 'Зберегти налаштування'}</button></div></form>;\n}\n\nfunction StatCard({ label, value, tone = 'slate' }) {"
  );
}
fs.writeFileSync(partnerFile, partnerSrc);

console.log('StoreOrdersDictionaryBoard guard, client payment link UI and admin settings patches applied.');