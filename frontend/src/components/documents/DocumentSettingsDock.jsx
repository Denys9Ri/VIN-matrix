import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSignature, Save, X } from 'lucide-react';
import api from '../../api/axios';

export default function DocumentSettingsDock() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    document_requisites: '',
    document_signature: '',
    document_warranty_text: '',
    document_footer: '',
  });

  useEffect(() => {
    const update = () => setVisible(window.location.pathname === '/settings');
    update();
    window.addEventListener('popstate', update);
    const timer = setInterval(update, 700);
    return () => { window.removeEventListener('popstate', update); clearInterval(timer); };
  }, []);

  const load = async () => {
    try {
      const res = await api.get('/api/settings/');
      const company = res.data?.company || {};
      setForm({
        document_requisites: company.document_requisites || '',
        document_signature: company.document_signature || '',
        document_warranty_text: company.document_warranty_text || '',
        document_footer: company.document_footer || '',
      });
      setOpen(true);
    } catch {
      alert('Не вдалося завантажити налаштування документів.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(`company[${key}]`, value || ''));
    try {
      await api.patch('/api/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Налаштування документів збережено.');
      setOpen(false);
    } catch {
      alert('Помилка збереження налаштувань документів.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return <>
    <button onClick={load} className="fixed right-5 bottom-24 z-[60] md:right-8 md:bottom-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 font-black text-xs uppercase transition">
      <FileSignature size={17}/> Документи
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="bg-white w-full md:max-w-2xl rounded-t-[28px] md:rounded-[28px] shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white p-5 flex justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Брендинг документів</p>
            <h2 className="text-2xl font-black uppercase">Налаштування бланків</h2>
            <p className="text-xs font-bold text-blue-100 mt-1">Реквізити, підпис, гарантія і текст унизу документів.</p>
          </div>
          <button onClick={() => setOpen(false)} className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center"><X size={18}/></button>
        </div>
        <form onSubmit={save} className="p-4 md:p-6 space-y-4">
          <Field label="Реквізити компанії" value={form.document_requisites} onChange={(v) => setForm({ ...form, document_requisites: v })} placeholder="ФОП / ТОВ, ЄДРПОУ/ІПН, IBAN, банк..." rows={4} />
          <Field label="Підпис відповідальної особи" value={form.document_signature} onChange={(v) => setForm({ ...form, document_signature: v })} placeholder="Наприклад: Директор / Менеджер / Майстер-приймальник" rows={2} />
          <Field label="Текст гарантії" value={form.document_warranty_text} onChange={(v) => setForm({ ...form, document_warranty_text: v })} placeholder="Умови гарантії, винятки, строки, правила повернення..." rows={4} />
          <Field label="Текст у підвалі документа" value={form.document_footer} onChange={(v) => setForm({ ...form, document_footer: v })} placeholder="Дякуємо за покупку. Зберігайте документ..." rows={3} />
          <button disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
            <Save size={16}/>{saving ? 'Зберігаємо...' : 'Зберегти налаштування документів'}
          </button>
        </form>
      </div>
    </div>, document.body)}
  </>;
}

function Field({ label, value, onChange, placeholder, rows }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">{label}</span>
    <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 resize-none" />
  </label>;
}
