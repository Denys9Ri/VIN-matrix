import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, ClipboardList, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/api/onboarding/');
      setData(res.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const dismiss = async () => {
    setBusy(true);
    try {
      await api.patch('/api/onboarding/', { action: 'dismiss_checklist' });
      setData((prev) => prev ? { ...prev, show_checklist: false } : prev);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data?.show_checklist) return null;
  const items = data.checklist || [];
  const done = data.progress?.done || items.filter((item) => item.done).length;
  const total = data.progress?.total || items.length;

  return (
    <section className="mb-6 overflow-hidden rounded-[30px] border border-blue-100 bg-white shadow-sm">
      <div className="p-5 md:p-6 bg-gradient-to-r from-slate-950 via-blue-900 to-cyan-700 text-white flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex gap-3"><div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0"><ClipboardList size={21}/></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">Запуск системи</p><h2 className="mt-1 text-xl md:text-2xl font-black uppercase italic">Налаштуйте VIN-matrix під себе</h2><p className="mt-1 text-sm font-semibold text-blue-50/85">Готово {done} з {total}. Можна завершувати поступово — система вже працює.</p></div></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => navigate('/onboarding')} className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase text-slate-950 hover:bg-blue-50">Відкрити майстер</button><button type="button" disabled={busy} onClick={dismiss} className="rounded-xl p-3 text-blue-100 hover:bg-white/10 disabled:opacity-60" title="Сховати чеклист"><X size={16}/></button></div>
      </div>
      <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{items.map((item) => <button key={item.id} type="button" onClick={() => navigate(item.route || '/onboarding')} className={`text-left rounded-2xl border p-4 transition flex items-start gap-3 ${item.done ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50'}`}><span className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${item.done ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>{item.done ? <Check size={14}/> : <span className="text-[10px] font-black">{item.required ? '!' : '○'}</span>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-900">{item.title}</span><span className="mt-1 block text-xs font-semibold leading-relaxed text-slate-500">{item.subtitle}</span></span>{!item.done && <ChevronRight size={16} className="mt-1 text-slate-400 shrink-0"/>}</button>)}</div>
    </section>
  );
}
