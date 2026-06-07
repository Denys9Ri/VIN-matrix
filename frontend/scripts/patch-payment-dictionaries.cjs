const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/components/visits/VisitPaymentDock.jsx');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('const fallbackPaymentTypes = [')) {
  src = src.replace(
    "const payTypeLabels = { cash: 'Готівка', card: 'Карта', transfer: 'Переказ', terminal: 'Термінал', other: 'Інше' };",
    "const fallbackPaymentTypes = [\n  { key: 'cash', label: 'Готівка' },\n  { key: 'card', label: 'Картка' },\n  { key: 'transfer', label: 'Переказ' },\n  { key: 'terminal', label: 'Термінал' },\n  { key: 'other', label: 'Інше' },\n];\nconst payTypeLabels = Object.fromEntries(fallbackPaymentTypes.map((item) => [item.key, item.label]));"
  );
}

if (!src.includes('const [paymentTypes, setPaymentTypes] = useState(fallbackPaymentTypes);')) {
  src = src.replace(
    "  const [payments, setPayments] = useState([]);\n  const [form, setForm] = useState({ amount: '', payment_type: 'cash', comment: '' });",
    "  const [payments, setPayments] = useState([]);\n  const [paymentTypes, setPaymentTypes] = useState(fallbackPaymentTypes);\n  const [form, setForm] = useState({ amount: '', payment_type: 'cash', comment: '' });"
  );
}

if (!src.includes('const normalizedPaymentTypes = useMemo(() => {')) {
  const block = `
  const normalizedPaymentTypes = useMemo(() => {
    const list = Array.isArray(paymentTypes) && paymentTypes.length ? paymentTypes : fallbackPaymentTypes;
    return list.map((item) => ({ key: item.key || item.value, label: item.label || item.name || item.key })).filter((item) => item.key);
  }, [paymentTypes]);

  const paymentLabelMap = useMemo(() => Object.fromEntries([...fallbackPaymentTypes, ...normalizedPaymentTypes].map((item) => [item.key, item.label])), [normalizedPaymentTypes]);

  const loadPaymentTypes = async () => {
    try {
      const res = await api.get('/api/settings/dictionaries/?mode=both');
      const list = Array.isArray(res.data?.payment_type) ? res.data.payment_type : [];
      setPaymentTypes(list.length ? list : fallbackPaymentTypes);
    } catch {
      setPaymentTypes(fallbackPaymentTypes);
    }
  };
`;
  src = src.replace('  const visible = useMemo(() => Boolean(visitId && modalRoot), [visitId, modalRoot]);', `  const visible = useMemo(() => Boolean(visitId && modalRoot), [visitId, modalRoot]);\n${block}`);
}

if (!src.includes('useEffect(() => { loadPaymentTypes(); }, []);')) {
  src = src.replace('  useEffect(() => { if (visitId) load(visitId); }, [visitId]);', '  useEffect(() => { loadPaymentTypes(); }, []);\n  useEffect(() => { if (visitId) load(visitId); }, [visitId]);');
}

if (!src.includes('res.data?.payment_types')) {
  src = src.replace(
    "      setFinance(nextFinance);\n      if (Number(nextFinance?.debt_amount || 0) > 0) {",
    "      setFinance(nextFinance);\n      if (res.data?.payment_types && typeof res.data.payment_types === 'object') {\n        const fromApi = Object.entries(res.data.payment_types).map(([key, label]) => ({ key, label }));\n        setPaymentTypes(fromApi.length ? fromApi : fallbackPaymentTypes);\n      }\n      if (Number(nextFinance?.debt_amount || 0) > 0) {"
  );
}

if (!src.includes('fromApi.length ? fromApi : fallbackPaymentTypes') || !src.includes('afterPayment')) {
  // no-op guard
}

if (!src.includes('setPaymentTypes(fromApi.length ? fromApi : fallbackPaymentTypes);\n    }\n    const left')) {
  src = src.replace(
    "    setFinance(res.data?.finance || finance);\n    const left = Number(res.data?.finance?.debt_amount || 0);",
    "    setFinance(res.data?.finance || finance);\n    if (res.data?.payment_types && typeof res.data.payment_types === 'object') {\n      const fromApi = Object.entries(res.data.payment_types).map(([key, label]) => ({ key, label }));\n      setPaymentTypes(fromApi.length ? fromApi : fallbackPaymentTypes);\n    }\n    const left = Number(res.data?.finance?.debt_amount || 0);"
  );
}

src = src.replace(
  "setForm({ amount: left > 0 ? String(left) : '', payment_type: 'cash', comment: '' });",
  "setForm((prev) => ({ amount: left > 0 ? String(left) : '', payment_type: prev.payment_type || normalizedPaymentTypes[0]?.key || 'cash', comment: '' }));"
);

const hardcodedSelect = `                  <select value={form.payment_type} onChange={(e)=>setForm({...form, payment_type:e.target.value})} className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-xs font-black outline-none focus:border-blue-500">
                    <option value="cash">Готівка</option>
                    <option value="card">Карта</option>
                    <option value="transfer">Переказ</option>
                    <option value="terminal">Термінал</option>
                    <option value="other">Інше</option>
                  </select>`;
const dynamicSelect = `                  <select value={form.payment_type} onChange={(e)=>setForm({...form, payment_type:e.target.value})} className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-xs font-black outline-none focus:border-blue-500">
                    {normalizedPaymentTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                  </select>`;
if (src.includes(hardcodedSelect)) {
  src = src.replace(hardcodedSelect, dynamicSelect);
}

src = src.replace(
  "{payTypeLabels[p.payment_type] || p.payment_type} · {p.created_at ? new Date(p.created_at).toLocaleString('uk-UA') : ''}",
  "{p.payment_type_label || paymentLabelMap[p.payment_type] || p.payment_type} · {p.created_at ? new Date(p.created_at).toLocaleString('uk-UA') : ''}"
);

fs.writeFileSync(file, src);
console.log('VisitPaymentDock.jsx patched: payment types are dictionary-driven.');
