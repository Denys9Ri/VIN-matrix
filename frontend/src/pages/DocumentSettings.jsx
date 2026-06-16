import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSignature, Save, ShieldCheck, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { Alert, AppPage, Button, Card, PageHeader, useToast } from '../components/ui';

const emptyForm = {
  document_requisites: '',
  document_signature: '',
  document_warranty_text: '',
  document_footer: '',
};

export default function DocumentSettings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
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
      .catch(() => {
        if (!cancelled) setError('Не вдалося завантажити налаштування документів.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(`company[${key}]`, value || ''));
    try {
      await api.patch('/api/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Налаштування документів збережено.');
    } catch {
      toast.error('Помилка збереження налаштувань документів.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppPage>
        <div className="min-h-[55vh] flex items-center justify-center text-slate-500 font-bold">
          <Loader2 className="animate-spin mr-2" /> Завантаження документів...
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage className="max-w-6xl pb-24 space-y-6">
      <Button variant="secondary" onClick={() => navigate('/settings')} icon={<ArrowLeft size={16} />}>Назад до налаштувань</Button>

      <PageHeader
        icon={<FileSignature />}
        title="Бланки компанії"
        subtitle="Реквізити, підпис, гарантійний текст і підвал для чеків, накладних, рахунків, актів та гарантійних талонів."
        actions={<div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">{companyName}</div>}
      />

      {error && <Alert variant="error" title="Документи">{error}</Alert>}

      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-6">
        <Card className="space-y-5" padding="lg">
          <Field label="Реквізити компанії" value={form.document_requisites} onChange={(v) => setForm({ ...form, document_requisites: v })} placeholder="ФОП / ТОВ, ЄДРПОУ/ІПН, IBAN, банк, юридична адреса..." rows={5} />
          <Field label="Підпис відповідальної особи" value={form.document_signature} onChange={(v) => setForm({ ...form, document_signature: v })} placeholder="Наприклад: Директор / Менеджер / Майстер-приймальник" rows={2} />
          <Field label="Текст гарантії" value={form.document_warranty_text} onChange={(v) => setForm({ ...form, document_warranty_text: v })} placeholder="Умови гарантії, строки, винятки, правила повернення..." rows={5} />
          <Field label="Текст у підвалі документа" value={form.document_footer} onChange={(v) => setForm({ ...form, document_footer: v })} placeholder="Дякуємо за довіру. Зберігайте документ до завершення гарантійного терміну..." rows={4} />
          <Button type="submit" loading={saving} icon={<Save size={16} />} className="w-full h-14 rounded-2xl font-black uppercase text-xs">
            Зберегти налаштування документів
          </Button>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3" padding="lg">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><FileSignature size={23}/></div>
            <h3 className="font-black uppercase text-slate-900">Де це використовується</h3>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed">Ці дані автоматично підтягуються в товарний чек, рахунок, накладну, акт виконаних робіт, гарантійний талон і акт повернення.</p>
          </Card>
          <Alert variant="success" title="Професійний вигляд">Заповни ці поля один раз — і всі документи будуть виглядати як нормальні бізнес-бланки.</Alert>
          <Card className="space-y-2" padding="lg">
            <ShieldCheck className="text-emerald-600" />
            <p className="font-black uppercase text-slate-900">Безпека</p>
            <p className="text-sm font-semibold text-slate-500">Документні реквізити зберігаються через існуючий api client і не мають hardcoded URL.</p>
          </Card>
        </div>
      </form>
    </AppPage>
  );
}

function Field({ label, value, onChange, placeholder, rows }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">{label}</span>
    <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none" />
  </label>;
}
