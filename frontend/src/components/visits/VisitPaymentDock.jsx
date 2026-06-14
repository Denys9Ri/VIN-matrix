import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, CreditCard, Loader2, Plus, RefreshCcw, X } from 'lucide-react';
import api from '../../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const num = (v) => Number(String(v || '').replace(',', '.')) || 0;
const fallbackPaymentTypes = [
  { key: 'cash', label: 'Готівка' },
  { key: 'card', label: 'Картка' },
  { key: 'transfer', label: 'Переказ' },
  { key: 'terminal', label: 'Термінал' },
  { key: 'other', label: 'Інше' },
];
const payTypeLabels = Object.fromEntries(fallbackPaymentTypes.map((item) => [item.key, item.label]));
const purposeLabels = { partial: 'Часткова оплата', final: 'Закриття боргу', legacy: 'Стара передплата', prepayment: 'Передплата' };
const norm = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

function findVisitIdFromScreen() {
  const text = norm(document.body?.innerText || '');
  const marker = 'візит №';
  const pos = text.indexOf(marker);
  if (pos >= 0) {
    const tail = text.slice(pos + marker.length).trim();
    const id = tail.match(/^\d+/)?.[0];
    if (id) return id;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('visit_id') || '';
}

function findVisitModalRoot() {
  const candidates = Array.from(document.querySelectorAll('div'));
  return candidates.find((el) => {
    const text = norm(el.innerText || '');
    return text.includes('візит №') && text.includes('огляд') && text.includes('підсумок');
  }) || null;
}

function findTabsBar() {
  const candidates = Array.from(document.querySelectorAll('div'));
  return candidates.find((el) => {
    const buttons = Array.from(el.children).filter((node) => node.tagName === 'BUTTON');
    const labels = norm(buttons.map((b) => b.innerText || '').join('|'));
    return buttons.length >= 6 && labels.includes('огляд') && labels.includes('підсумок') && labels.includes('запчастини');
  }) || null;
}

export default function VisitPaymentDock() {
  const [visitId, setVisitId] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finance, setFinance] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState(fallbackPaymentTypes);
  const [form, setForm] = useState({ amount: '', payment_type: 'cash', comment: '' });
  const [message, setMessage] = useState('');
  const [tabsBar, setTabsBar] = useState(null);
  const [modalRoot, setModalRoot] = useState(null);

  useEffect(() => {
    const update = () => {
      const foundId = findVisitIdFromScreen();
      const foundTabs = findTabsBar();
      const foundRoot = findVisitModalRoot();
      setVisitId(foundId || '');
      setTabsBar(foundTabs);
      setModalRoot(foundRoot);
      if (!foundId || !foundRoot) setOpen(false);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(update, 600);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, []);

  const visible = useMemo(() => Boolean(visitId && modalRoot), [visitId, modalRoot]);

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


  const load = async (id = visitId) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/payments/?visit=${encodeURIComponent(id)}`);
      const nextFinance = res.data?.finance || null;
      setPayments(Array.isArray(res.data?.results) ? res.data.results : []);
      setFinance(nextFinance);
      if (res.data?.payment_types && typeof res.data.payment_types === 'object') {
        const fromApi = Object.entries(res.data.payment_types).map(([key, label]) => ({ key, label }));
        setPaymentTypes(fromApi.length ? fromApi : fallbackPaymentTypes);
      }
      if (Number(nextFinance?.debt_amount || 0) > 0) {
        setForm((p) => ({ ...p, amount: p.amount || String(nextFinance.debt_amount) }));
      }
    } catch {
      setMessage('Не вдалося завантажити оплату.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPaymentTypes(); }, []);
  useEffect(() => { if (visitId) load(visitId); }, [visitId]);

  const afterPayment = (res, fallbackMessage) => {
    setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
    setFinance(res.data?.finance || finance);
    if (res.data?.payment_types && typeof res.data.payment_types === 'object') {
      const fromApi = Object.entries(res.data.payment_types).map(([key, label]) => ({ key, label }));
      setPaymentTypes(fromApi.length ? fromApi : fallbackPaymentTypes);
    }
    const left = Number(res.data?.finance?.debt_amount || 0);
    setForm((prev) => ({ amount: left > 0 ? String(left) : '', payment_type: prev.payment_type || normalizedPaymentTypes[0]?.key || 'cash', comment: '' }));
    setMessage(fallbackMessage || (left > 0 ? 'Оплату додано. Борг оновлено.' : 'Оплату додано. Борг закрито.'));
  };

  const addPayment = async (purpose = 'partial') => {
    if (!visitId || num(form.amount) <= 0) { setMessage('Вкажіть суму оплати.'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/api/visits/${visitId}/add-payment/`, {
        amount: num(form.amount),
        payment_type: form.payment_type,
        payment_purpose: purpose,
        comment: form.comment,
      });
      afterPayment(res);
    } catch (e) {
      setMessage(e.response?.data?.error || 'Не вдалося додати оплату.');
    } finally {
      setSaving(false);
    }
  };

  const closeDebt = async () => {
    if (!visitId) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/visits/${visitId}/mark-paid/`, { payment_type: form.payment_type, comment: form.comment });
      afterPayment(res, 'Борг закрито.');
    } catch (e) {
      setMessage(e.response?.data?.error || 'Не вдалося закрити борг.');
    } finally {
      setSaving(false);
    }
  };

  const remindDebt = async () => {
    if (!visitId) return;
    setSaving(true);
    try {
      await api.post(`/api/visits/${visitId}/debt-reminder/`, { comment: form.comment || `Нагадати про оплату по візиту №${visitId}` });
      setMessage('Нагадування по боргу створено.');
    } catch {
      setMessage('Не вдалося створити нагадування.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const debt = Number(finance?.debt_amount || 0);
  const paid = Number(finance?.paid_amount || 0);
  const total = Number(finance?.grand_total || 0);

  const tabButton = (
    <button type="button" onClick={() => { setOpen(true); load(); }} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase whitespace-nowrap ${open ? 'bg-blue-600 text-white' : debt > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
      <CreditCard size={15}/>
      Оплата
      <span className="rounded-xl bg-white/70 text-slate-700 px-2 py-0.5">{debt > 0 ? money(debt) : 'OK'}</span>
    </button>
  );

  const panel = open ? (
    <div className="fixed inset-0 z-[80] bg-slate-900/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="bg-white border border-slate-200 rounded-[28px] shadow-2xl overflow-hidden w-full max-w-3xl max-h-[88dvh] flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase text-blue-100 tracking-widest">Фінанси СТО</p>
            <h3 className="text-xl md:text-2xl font-black uppercase">Оплата візиту №{visitId}</h3>
            <p className="text-xs font-bold text-blue-100 mt-1">Часткова оплата, закриття боргу та історія платежів</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => load()} className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center hover:bg-white/25"><RefreshCcw size={16}/></button>
            <button type="button" onClick={() => setOpen(false)} className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center hover:bg-white/25"><X size={18}/></button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-4 overflow-y-auto">
          {message && <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl px-3 py-2 text-xs font-black flex justify-between gap-2"><span>{message}</span><button type="button" onClick={() => setMessage('')}><X size={14}/></button></div>}
          {loading ? <div className="py-10 flex justify-center text-blue-600"><Loader2 className="animate-spin"/></div> : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MoneyCard label="Сума візиту" value={money(total)} />
                <MoneyCard label="Внесено" value={money(paid)} good={paid > 0}/>
                <MoneyCard label="Залишок / борг" value={money(debt)} bad={debt > 0} good={debt <= 0 && total > 0}/>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-3 md:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                  <input value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} placeholder="Сума оплати" inputMode="decimal" className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-blue-500" />
                  <select value={form.payment_type} onChange={(e)=>setForm({...form, payment_type:e.target.value})} className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-xs font-black outline-none focus:border-blue-500">
                    {normalizedPaymentTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                  </select>
                </div>
                <input value={form.comment} onChange={(e)=>setForm({...form, comment:e.target.value})} placeholder="Коментар: хто заніс, коли домовились, примітка" className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button disabled={saving} onClick={() => addPayment('partial')} className="bg-blue-600 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={14}/> Додати оплату</button>
                  <button disabled={saving || debt <= 0} onClick={closeDebt} className="bg-emerald-600 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 size={14}/> Закрити борг</button>
                  <button disabled={saving || debt <= 0} onClick={remindDebt} className="bg-amber-500 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Bell size={14}/> Нагадати</button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h4 className="font-black uppercase text-xs text-slate-800">Історія оплат</h4>
                  <span className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-black text-slate-500">{payments.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {payments.map((p) => <div key={p.id} className="p-3 flex justify-between gap-3"><div><p className="font-black text-slate-900">{purposeLabels[p.payment_purpose] || 'Оплата'}</p><p className="text-[11px] font-bold text-slate-500">{p.payment_type_label || paymentLabelMap[p.payment_type] || p.payment_type} · {p.created_at ? new Date(p.created_at).toLocaleString('uk-UA') : ''}</p>{p.comment && <p className="text-[11px] font-bold text-slate-400 mt-1">{p.comment}</p>}</div><p className="font-black text-emerald-600 whitespace-nowrap">{money(p.amount)}</p></div>)}
                  {!payments.length && <div className="p-6 text-center text-xs font-black uppercase text-slate-400">Оплат ще немає</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return <>{tabsBar ? createPortal(tabButton, tabsBar) : null}{createPortal(panel, document.body)}</>;
}

function MoneyCard({ label, value, good, bad }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`font-black text-lg mt-1 ${good ? 'text-emerald-600' : bad ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>;
}
