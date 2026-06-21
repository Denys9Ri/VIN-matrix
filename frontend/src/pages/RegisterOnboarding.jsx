import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, UserRound } from 'lucide-react';
import api from '../api/axios';

const initialForm = { full_name: '', phone: '', email: '', company_name: '', referral_code: '', username: '', password: '' };

function landingLeadDraft() {
  try {
    const raw = localStorage.getItem('vin_matrix_marketing_lead_draft');
    if (!raw) return {};
    const lead = JSON.parse(raw);
    return {
      full_name: String(lead.name || '').trim(),
      phone: String(lead.phone || '').trim(),
      company_name: lead.business === 'store' ? 'Магазин запчастин' : lead.business === 'both' ? 'СТО + магазин' : '',
    };
  } catch {
    return {};
  }
}

export default function RegisterOnboarding() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...initialForm, ...landingLeadDraft() }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/register/', form);
      const auth = await api.post('/token/', { username: form.username, password: form.password });
      localStorage.setItem('access_token', auth.data.access);
      localStorage.setItem('refresh_token', auth.data.refresh);
      localStorage.removeItem('vin_matrix_marketing_lead_draft');
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Не вдалося створити акаунт. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 md:py-12 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_460px] overflow-hidden rounded-[34px] bg-white shadow-2xl shadow-slate-950/50">
        <section className="hidden lg:flex bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-10 text-white flex-col justify-between">
          <div><div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center"><Building2 size={27}/></div><p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-blue-200">VIN-matrix</p><h1 className="mt-3 text-5xl font-black uppercase italic leading-none">Запустіть<br/>автобізнес<br/>за кілька хвилин.</h1><p className="mt-6 max-w-md text-sm font-semibold leading-relaxed text-blue-50/85">Після реєстрації відкриється короткий майстер: оберете СТО або магазин, заповните дані та зробите першу дію.</p></div><div className="space-y-3">{['Безпечний trial на 14 днів', 'СТО та магазин в одному продукті', 'Без зайвих обов’язкових полів'].map((item) => <div key={item} className="flex gap-2 text-sm font-bold text-blue-50"><CheckCircle2 size={18} className="text-cyan-300 shrink-0"/>{item}</div>)}</div>
        </section>
        <form onSubmit={submit} className="p-6 md:p-9">
          <div className="mb-7"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Новий акаунт</p><h2 className="mt-2 text-3xl font-black uppercase italic text-slate-950">Реєстрація бізнесу</h2><p className="mt-2 text-sm font-semibold text-slate-500">Початкові дані, решту допоможе налаштувати майстер.</p></div>
          {error && <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormInput required label="ПІБ" value={form.full_name} onChange={(v) => update('full_name', v)} placeholder="Іван Петренко"/>
            <FormInput required label="Телефон" value={form.phone} onChange={(v) => update('phone', v)} placeholder="+380..."/>
            <FormInput label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} placeholder="name@email.com"/>
            <FormInput label="Назва бізнесу" value={form.company_name} onChange={(v) => update('company_name', v)} placeholder="АвтоГараж Плюс"/>
            <FormInput label="Код партнера" value={form.referral_code} onChange={(v) => update('referral_code', v)} placeholder="P6001"/>
            <FormInput required label="Логін" value={form.username} onChange={(v) => update('username', v)} placeholder="IvanAuto1"/>
          </div>
          <div className="mt-3"><FormInput required label="Пароль" type="password" value={form.password} onChange={(v) => update('password', v)} placeholder="Мінімум 8 символів"/></div>
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-400">Логін: мінімум 4 англійські літери, велика літера та цифра. Пароль: щонайменше 8 символів, велика літера, цифра і спецсимвол.</p>
          <button disabled={loading} className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-xs font-black uppercase text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">{loading ? 'Створюємо...' : <>Створити акаунт <ArrowRight size={16}/></>}</button>
          <p className="mt-5 text-center text-sm font-semibold text-slate-500">Вже є акаунт? <Link to="/login" className="font-black text-blue-600 hover:underline">Увійти</Link></p>
        </form>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = 'text', required }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}{required ? ' *' : ''}</span><div className="relative"><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></div></label>;
}