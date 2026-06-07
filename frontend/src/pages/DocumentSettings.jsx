import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSignature, Save, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

export default function DocumentSettings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [form, setForm] = useState({
    document_requisites: '',
    document_signature: '',
    document_warranty_text: '',
    document_footer: '',
  });

  useEffect(() => {
    let cancelled = false;
    api.get('/api/settings/')
      .then((res) => {
        if (cancelled) return;
        const company = res.data?.company || {};
        setCompanyName(company.name || 'Компанія');
        setForm({
          document_requisites: company.document_requisites || '',
          document_signature: company.document_signature || '',
          document_warranty_text: company.document_warranty_text || '',
          document_footer: company.document_footer || '',
        });
      })
      .catch(() => alert('Не вдалося завантажити налаштування документів.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(`company[${key}]`, value || ''));
    try {
      await api.patch('/api/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Налаштування документів збережено.');
    } catch {
      alert('Помилка збереження налаштувань документів.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Завантаження документів...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
      <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 rounded-2xl px-4 py-3 font-black text-xs uppercase hover:bg-slate-50 transition">
        <ArrowLeft size={16}/> Назад до налаштувань
      </button>

      <div className="bg-gradient-to-r from-slate-900 to-blue-700 text-white rounded-[30px] p-6 md:p-8 shadow-xl shadow-blue-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Документи</p>
            <h1 className="text-3xl md:text-4xl font-black italic uppercase mt-1">Бланки компанії</h1>
            <p className="text-sm font-semibold text-blue-100 mt-2 max-w-2xl">Реквізити, підпис, гарантійний текст і підвал для чеків, накладних, рахунків, актів та гарантійних талонів.</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm font-bold">{companyName}</div>
        </div>
      </div>

      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[28px] border border-slate-200 shadow-sm p-5 md:p-6 space-y-5">
          <Field label="Реквізити компанії" value={form.document_requisites} onChange={(v) => setForm({ ...form, document_requisites: v })} placeholder="ФОП / ТОВ, ЄДРПОУ/ІПН, IBAN, банк, юридична адреса..." rows={5} />
          <Field label="Підпис відповідальної особи" value={form.document_signature} onChange={(v) => setForm({ ...form, document_signature: v })} placeholder="Наприклад: Директор / Менеджер / Майстер-приймальник" rows={2} />
          <Field label="Текст гарантії" value={form.document_warranty_text} onChange={(v) => setForm({ ...form, document_warranty_text: v })} placeholder="Умови гарантії, строки, винятки, правила повернення..." rows={5} />
          <Field label="Текст у підвалі документа" value={form.document_footer} onChange={(v) => setForm({ ...form, document_footer: v })} placeholder="Дякуємо за довіру. Зберігайте документ до завершення гарантійного терміну..." rows={4} />
          <button disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition">
            <Save size={16}/>{saving ? 'Зберігаємо...' : 'Зберегти налаштування документів'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm p-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4"><FileSignature size={23}/></div>
            <h3 className="font-black uppercase text-slate-900">Де це використовується</h3>
            <p className="text-sm font-semibold text-slate-500 mt-2 leading-relaxed">Ці дані автоматично підтягуються в товарний чек, рахунок, накладну, акт виконаних робіт, гарантійний талон і акт повернення.</p>
          </div>
          <div className="bg-emerald-50 rounded-[28px] border border-emerald-100 p-5 text-emerald-700">
            <ShieldCheck size={22}/>
            <p className="font-black uppercase mt-3">Професійний вигляд</p>
            <p className="text-sm font-semibold mt-2">Заповни ці поля один раз — і всі документи будуть виглядати як нормальні бізнес-бланки.</p>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, rows }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">{label}</span>
    <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 resize-none" />
  </label>;
}
