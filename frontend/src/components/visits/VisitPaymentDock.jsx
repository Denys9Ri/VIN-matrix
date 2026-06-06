import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, CreditCard, Loader2, Plus, RefreshCcw, X } from 'lucide-react';
import api from '../../api/axios';

const money = (v) => `${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;
const num = (v) => Number(String(v || '').replace(',', '.')) || 0;
const payTypeLabels = { cash: 'Готівка', card: 'Карта', transfer: 'Переказ', terminal: 'Термінал' };
const purposeLabels = { partial: 'Часткова оплата', final: 'Закриття боргу', legacy: 'Стара передплата' };

function findVisitIdFromScreen() {
  const text = document.body?.innerText || '';
  const modalMatch = text.match(/Візит\s*№\s*(\d+)/i) || text.match(/#\s*Візит\s*№\s*(\d+)/i);
  if (modalMatch?.[1]) return modalMatch[1];
  const params = new URLSearchParams(window.location.search);
  return params.get('visit_id') || '';
}

export default function VisitPaymentDock() {
  const [visitId, setVisitId] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finance, setFinance] = useState(null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({ amount: '', payment_type: 'cash', comment: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const update = () => {
      const found = findVisitIdFromScreen();
      setVisitId((prev) => (found && found !== prev ? found : found || prev));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(update, 1200);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, []);

  const visible = useMemo(() => {
    if (!visitId) return false;
    return (document.body?.innerText || '').includes(`Візит №${visitId}`) || new URLSearchParams(window.location.search).get('visit_id') === String(visitId);
  }, [visitId, open, finance]);

  const load = async (id = visitId) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/payments/?visit=${encodeURIComponent(id)}`);
      setPayments(Array.isArray(res.data?.results) ? res.data.results : []);
      setFinance(res.data?.finance || null);
      if (!form.amount && Number(res.data?.finance?.debt_amount || 0) > 0) {
        setForm((p) => ({ ...p, amount: String(res.data.finance.debt_amount) }));
      }
    } catch {
      setMessage('Не вдалося завантажити оплату.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visitId) load(visitId); }, [visitId]);

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
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
      setFinance(res.data?.finance || finance);
      const left = Number(res.data?.finance?.debt_amount || 0);
      setForm({ amount: left > 0 ? String(left) : '', payment_type: 'cash', comment: '' });
      setMessage(left > 0 ? 'Оплату додано. Борг оновлено.' : 'Оплату додано. Борг закрито.');
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
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
      setFinance(res.data?.finance || finance);
      setForm({ amount: '', payment_type: 'cash', comment: '' });
      setMessage('Борг закрито.');
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

  return (
    <div className="fixed right-3 bottom-3 sm:right-6 sm:bottom-6 z-[90] w-[calc(100vw-24px)] sm:w-[420px] pointer-events-none">
      {!open && (
        <button onClick={() => { setOpen(true); load(); }} className={`pointer-events-auto w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-3 rounded-3xl px-5 py-4 font-black text-xs uppercase shadow-2xl ${debt > 0 ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-emerald-600 text-white shadow-emerald-200'}`}>
          <CreditCard size={18}/>
          Оплата візиту №{visitId}
          <span className="rounded-2xl bg-white/20 px-3 py-1">{debt > 0 ? `Борг ${money(debt)}` : 'Закрито'}</span>
        </button>
      )}

      {open && (
        <div className="pointer-events-auto bg-white border border-slate-200 rounded-[28px] shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-blue-100">Фінанси СТО</p>
              <h3 className="text-xl font-black uppercase">Оплата візиту №{visitId}</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={() => load()} className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center"><RefreshCcw size={15}/></button>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center"><X size={16}/></button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[72dvh] overflow-y-auto">
            {message && <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl px-3 py-2 text-xs font-black flex justify-between gap-2"><span>{message}</span><button onClick={() => setMessage('')}><X size={14}/></button></div>}
            {loading ? <div className="py-8 flex justify-center text-blue-600"><Loader2 className="animate-spin"/></div> : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <MoneyCard label="Сума" value={money(total)} />
                  <MoneyCard label="Внесено" value={money(paid)} good={paid > 0}/>
                  <MoneyCard label="Борг" value={money(debt)} bad={debt > 0} good={debt <= 0 && total > 0}/>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2">
                    <input value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})} placeholder="Сума оплати" inputMode="decimal" className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:border-blue-500" />
                    <select value={form.payment_type} onChange={(e)=>setForm({...form, payment_type:e.target.value})} className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-xs font-black outline-none focus:border-blue-500">
                      <option value="cash">Готівка</option>
                      <option value="card">Карта</option>
                      <option value="transfer">Переказ</option>
                      <option value="terminal">Термінал</option>
                    </select>
                  </div>
                  <input value={form.comment} onChange={(e)=>setForm({...form, comment:e.target.value})} placeholder="Коментар: хто заніс, коли домовились, примітка" className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button disabled={saving} onClick={() => addPayment('partial')} className="bg-blue-600 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={14}/> Часткова</button>
                    <button disabled={saving || debt <= 0} onClick={closeDebt} className="bg-emerald-600 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><CheckCircle2 size={14}/> Закрити</button>
                    <button disabled={saving || debt <= 0} onClick={remindDebt} className="bg-amber-500 text-white rounded-2xl px-3 py-3 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Bell size={14}/> Нагадати</button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="font-black uppercase text-xs text-slate-800">Історія оплат</h4>
                    <span className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-black text-slate-500">{payments.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {payments.map((p) => <div key={p.id} className="p-3 flex justify-between gap-3"><div><p className="font-black text-slate-900">{purposeLabels[p.payment_purpose] || 'Оплата'}</p><p className="text-[11px] font-bold text-slate-500">{payTypeLabels[p.payment_type] || p.payment_type} · {p.created_at ? new Date(p.created_at).toLocaleString('uk-UA') : ''}</p>{p.comment && <p className="text-[11px] font-bold text-slate-400 mt-1">{p.comment}</p>}</div><p className="font-black text-emerald-600 whitespace-nowrap">{money(p.amount)}</p></div>)}
                    {!payments.length && <div className="p-6 text-center text-xs font-black uppercase text-slate-400">Оплат ще немає</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MoneyCard({ label, value, good, bad }) {
  return <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3"><p className="text-[9px] font-black uppercase text-slate-400">{label}</p><p className={`font-black text-sm mt-1 ${good ? 'text-emerald-600' : bad ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>;
}
