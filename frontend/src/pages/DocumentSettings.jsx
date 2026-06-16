import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, FileSignature, Image, Loader2, MapPin, Phone, Save, ShieldCheck, Upload } from 'lucide-react';
import api from '../api/axios';
import { Alert, AppPage, Button, Card, PageHeader, useToast } from '../components/ui';

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  logo: null,
  logo_url: '',
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
          name: company.name || '',
          phone: company.phone || '',
          address: company.address || '',
          logo: null,
          logo_url: company.logo || '',
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
    ['name', 'phone', 'address', 'document_requisites', 'document_signature', 'document_warranty_text', 'document_footer'].forEach((key) => {
      data.append(`company[${key}]`, form[key] || '');
    });
    if (form.logo instanceof File) data.append('company[logo]', form.logo);
    try {
      await api.patch('/api/settings/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCompanyName(form.name || 'Компанія');
      toast.success('Налаштування документів збережено.');
    } catch {
      toast.error('Помилка збереження налаштувань документів.');
    } finally {
      setSaving(false);
    }
  };

  const logoPreview = form.logo instanceof File ? URL.createObjectURL(form.logo) : form.logo_url;

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
        subtitle="Логотип, контакти, реквізити, гарантія, підписи та футер для чеків, рахунків, накладних, актів і гарантійних талонів."
        actions={<div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">{companyName}</div>}
      />

      {error && <Alert variant="error" title="Документи">{error}</Alert>}

      <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="space-y-6">
          <Card className="space-y-5" padding="lg">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Брендинг</p>
              <h3 className="text-xl font-black uppercase text-slate-900 mt-1">Шапка документа</h3>
              <p className="text-sm font-semibold text-slate-500 mt-1">Ці дані видно у верхній частині кожного документа.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4 items-start">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-center">
                <div className="w-28 h-28 rounded-3xl border border-slate-200 bg-white mx-auto flex items-center justify-center overflow-hidden">
                  {logoPreview ? <img src={logoPreview} alt="Логотип" className="w-full h-full object-contain p-3" /> : <Image className="text-slate-300" size={38} />}
                </div>
                <label className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white hover:bg-blue-700">
                  <Upload size={15}/> Логотип
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => setForm({ ...form, logo: event.target.files?.[0] || null })} />
                </label>
              </div>
              <div className="space-y-3">
                <Input icon={<Building2 size={15}/>} label="Назва компанії" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="VIN-matrix / Назва СТО / Назва магазину" />
                <Input icon={<Phone size={15}/>} label="Телефон" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+380..." />
                <Input icon={<MapPin size={15}/>} label="Адреса" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Місто, вулиця, номер" />
              </div>
            </div>
          </Card>

          <Card className="space-y-5" padding="lg">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Юридичний блок</p>
              <h3 className="text-xl font-black uppercase text-slate-900 mt-1">Реквізити і тексти</h3>
            </div>
            <Field label="Реквізити компанії" value={form.document_requisites} onChange={(v) => setForm({ ...form, document_requisites: v })} placeholder="ФОП / ТОВ, ЄДРПОУ/ІПН, IBAN, банк, юридична адреса..." rows={5} />
            <Field label="Підпис відповідальної особи" value={form.document_signature} onChange={(v) => setForm({ ...form, document_signature: v })} placeholder="Наприклад: Директор / Менеджер / Майстер-приймальник" rows={2} />
            <Field label="Текст гарантії" value={form.document_warranty_text} onChange={(v) => setForm({ ...form, document_warranty_text: v })} placeholder="Умови гарантії, строки, винятки, правила повернення..." rows={5} />
            <Field label="Текст у підвалі документа" value={form.document_footer} onChange={(v) => setForm({ ...form, document_footer: v })} placeholder="Дякуємо за довіру. Зберігайте документ до завершення гарантійного терміну..." rows={4} />
            <Button type="submit" loading={saving} icon={<Save size={16} />} fullWidth size="xl" important>
              Зберегти налаштування документів
            </Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3" padding="lg">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><FileSignature size={23}/></div>
            <h3 className="font-black uppercase text-slate-900">Де це використовується</h3>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed">Ці дані автоматично підтягуються в товарний чек, рахунок, накладну, акт виконаних робіт, гарантійний талон і акт повернення.</p>
          </Card>
          <Alert variant="success" title="Професійний вигляд">Заповніть ці поля один раз — і всі документи будуть виглядати як нормальні бізнес-бланки з логотипом, реквізитами та підписами.</Alert>
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

function Input({ label, value, onChange, placeholder, icon }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">{label}</span>
    <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
      {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" />
    </div>
  </label>;
}

function Field({ label, value, onChange, placeholder, rows }) {
  return <label className="block">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">{label}</span>
    <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 resize-none" />
  </label>;
}
