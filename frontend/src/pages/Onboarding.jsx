import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Boxes, Building2, Check, CheckCircle2, ClipboardList, FileText, ImagePlus, Loader2, Package, Plus, Rocket, ShieldCheck, Sparkles, Store, Truck, Wrench, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

const STEPS = [
  { id: 'business', title: 'Ваш формат роботи', short: 'Бізнес', icon: Store },
  { id: 'profile', title: 'Дані компанії', short: 'Компанія', icon: Building2 },
  { id: 'documents', title: 'Документи', short: 'Документи', icon: FileText },
  { id: 'start', title: 'Як почати', short: 'Старт', icon: Sparkles },
  { id: 'delivery', title: 'Нова пошта', short: 'Доставка', icon: Truck },
  { id: 'firstAction', title: 'Перша дія', short: 'Перша дія', icon: Rocket },
];

const DEFAULT_PRODUCT = { brand: '', article: '', name: '', quantity: 1, buy_price: '', sell_price: '' };
const DEFAULT_VISIT = { client: '', phone: '', plate: '' };

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [profileForm, setProfileForm] = useState({ company_name: '', phone: '', address: '', logo: null });
  const [documents, setDocuments] = useState({ document_requisites: '', document_signature: '', document_footer: '', document_warranty_text: '' });
  const [product, setProduct] = useState(DEFAULT_PRODUCT);
  const [visit, setVisit] = useState(DEFAULT_VISIT);

  const requestedStep = Math.max(1, Math.min(6, Number(searchParams.get('step') || 1)));
  const [step, setStep] = useState(requestedStep);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/onboarding/');
      const next = res.data || {};
      setData(next);
      const company = next.company || {};
      setProfileForm((prev) => ({ ...prev, company_name: company.name || '', phone: company.phone || '', address: company.address || '' }));
      setDocuments({
        document_requisites: company.document_requisites || '',
        document_signature: company.document_signature || '',
        document_footer: company.document_footer || '',
        document_warranty_text: company.document_warranty_text || '',
      });
      if (!next.onboarding_exists) navigate('/', { replace: true });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Не вдалося завантажити onboarding.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setStep(requestedStep); }, [requestedStep]);

  const businessType = data?.company?.business_type || 'sto';
  const progress = data?.progress || { done: 0, total: 5 };
  const checklist = data?.checklist || [];
  const state = data?.state || {};

  const setCurrentStep = (next) => {
    const safe = Math.max(1, Math.min(6, next));
    setStep(safe);
    setSearchParams({ step: String(safe) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (key, request, successText) => {
    setBusy(key);
    setNotice(null);
    try {
      const response = await request();
      const next = response?.data || {};
      if (next.company || next.checklist) setData(next);
      setNotice({ type: 'success', text: successText || next.message || 'Збережено.' });
      if (!next.company) await load();
      return next;
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.error || 'Не вдалося зберегти зміни.' });
      return null;
    } finally {
      setBusy('');
    }
  };

  const chooseBusiness = async (type) => {
    const next = await save(`business-${type}`, () => api.patch('/api/onboarding/', { action: 'business', business_type: type }), 'Готово. Ми підготували статуси та стартову логіку для вашого режиму.');
    if (next) setCurrentStep(2);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const form = new FormData();
    form.append('action', 'profile');
    form.append('company_name', profileForm.company_name);
    form.append('phone', profileForm.phone);
    form.append('address', profileForm.address);
    if (profileForm.logo) form.append('logo', profileForm.logo);
    const next = await save('profile', () => api.patch('/api/onboarding/', form, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Дані компанії збережено.');
    if (next) setCurrentStep(3);
  };

  const saveDocuments = async (event) => {
    event.preventDefault();
    const next = await save('documents', () => api.patch('/api/onboarding/', { action: 'documents', ...documents }), 'Налаштування документів збережено.');
    if (next) setCurrentStep(4);
  };

  const skip = async (which, nextStep) => {
    const next = await save(`skip-${which}`, () => api.patch('/api/onboarding/', { action: 'skip', step: which }), 'Можна повернутися до цього кроку будь-коли з чеклиста.');
    if (next) setCurrentStep(nextStep);
  };

  const seedDemo = async () => {
    const next = await save('demo', () => api.post('/api/onboarding/', { action: 'seed_demo' }), 'Демо-дані додано у вашу компанію. Їх можна видалити пізніше.');
    if (next) setCurrentStep(5);
  };

  const removeDemo = async () => {
    await save('remove-demo', () => api.post('/api/onboarding/', { action: 'remove_demo' }), 'Демо-дані видалено.');
  };

  const createFirstProduct = async (event) => {
    event.preventDefault();
    const payload = { ...product, quantity: Number(product.quantity || 1), buy_price: Number(product.buy_price || 0), sell_price: Number(product.sell_price || 0), min_quantity: 0 };
    const result = await save('first-product', () => api.post('/api/inventory/', payload), 'Перший товар додано на склад.');
    if (result) {
      await save('first-action', () => api.patch('/api/onboarding/', { action: 'first_action_done' }));
      setCurrentStep(6);
    }
  };

  const createFirstVisit = async (event) => {
    event.preventDefault();
    const payload = { ...visit, vin_code: '', status: 'SELECTION', delivery_type: 'pickup', payment_status: 'unpaid' };
    const result = await save('first-visit', () => api.post('/api/visits/', payload), 'Перший запис створено.');
    if (result) {
      await save('first-action', () => api.patch('/api/onboarding/', { action: 'first_action_done' }));
      setCurrentStep(6);
    }
  };

  const complete = async () => {
    const next = await save('complete', () => api.post('/api/onboarding/', { action: 'complete' }), 'Базове налаштування завершено.');
    if (next) navigate('/', { replace: true });
  };

  const deliveryReady = checklist.find((item) => item.id === 'delivery')?.done;
  const firstActionReady = checklist.find((item) => item.id === 'first_action')?.done;

  if (loading) return <FullScreenLoader />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="min-h-screen grid grid-cols-1 xl:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="bg-slate-950 text-white p-5 md:p-8 xl:p-10 xl:min-h-screen">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50"><Sparkles size={20}/></div><div><p className="font-black text-xl tracking-tight">VIN<span className="text-blue-400">-matrix</span></p><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Швидкий старт</p></div></div>
          <div className="mt-9 rounded-[28px] border border-white/10 bg-white/[0.05] p-5"><p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Прогрес налаштування</p><div className="mt-3 flex items-end gap-2"><span className="text-4xl font-black">{progress.done}</span><span className="pb-1 text-sm font-bold text-slate-400">з {progress.total}</span></div><div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all" style={{ width: `${Math.max(8, (progress.done / Math.max(progress.total, 1)) * 100)}%` }} /></div><p className="mt-3 text-xs font-semibold leading-relaxed text-slate-300">Налаштуйте основу один раз — далі система працюватиме під ваш СТО або магазин.</p></div>
          <nav className="mt-8 grid grid-cols-2 gap-2 xl:grid-cols-1">{STEPS.map((item, index) => <StepButton key={item.id} item={item} index={index + 1} active={step === index + 1} done={isStepDone(item.id, checklist, state)} onClick={() => setCurrentStep(index + 1)} />)}</nav>
          <p className="hidden xl:block mt-10 text-xs font-bold leading-relaxed text-slate-500">Обов’язкові лише тип бізнесу й дані компанії. Решту можна безпечно доробити пізніше.</p>
        </aside>

        <main className="min-w-0 p-3 md:p-8 xl:p-12">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between gap-3 mb-6"><div className="text-xs font-black uppercase tracking-widest text-slate-400">Крок {step} з {STEPS.length}</div><button type="button" onClick={() => navigate('/login')} className="text-xs font-black uppercase text-slate-400 hover:text-slate-700">Вийти</button></div>
            {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}
            {step === 1 && <BusinessStep selected={businessType} busy={busy} onChoose={chooseBusiness} />}
            {step === 2 && <ProfileStep form={profileForm} setForm={setProfileForm} busy={busy === 'profile'} onSubmit={saveProfile} onBack={() => setCurrentStep(1)} />}
            {step === 3 && <DocumentsStep form={documents} setForm={setDocuments} busy={busy === 'documents'} onSubmit={saveDocuments} onSkip={() => skip('documents', 4)} onBack={() => setCurrentStep(2)} />}
            {step === 4 && <StartStep businessType={businessType} demoSeeded={Boolean(data?.demo_seeded)} busy={busy} onDemo={seedDemo} onRemoveDemo={removeDemo} onContinue={() => setCurrentStep(5)} onBack={() => setCurrentStep(3)} />}
            {step === 5 && <DeliveryStep ready={deliveryReady} busy={busy} onOpen={() => navigate('/settings/delivery?onboarding=1')} onSkip={() => skip('delivery', 6)} onContinue={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} />}
            {step === 6 && <FirstActionStep businessType={businessType} product={product} setProduct={setProduct} visit={visit} setVisit={setVisit} busy={busy} ready={firstActionReady} onProduct={createFirstProduct} onVisit={createFirstVisit} onSkip={() => skip('first_action', 6)} onComplete={complete} onBack={() => setCurrentStep(5)} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function isStepDone(id, checklist, state) {
  if (id === 'start') return Boolean(state?.demo_seeded) || Boolean(state?.demo_decision_made);
  if (id === 'profile') return Boolean(checklist.find((item) => item.id === 'company')?.done);
  if (id === 'firstAction') return Boolean(checklist.find((item) => item.id === 'first_action')?.done);
  return Boolean(checklist.find((item) => item.id === id)?.done);
}

function StepButton({ item, index, active, done, onClick }) {
  const Icon = item.icon;
  return <button type="button" onClick={onClick} className={`rounded-2xl p-3 text-left transition border flex items-center gap-3 ${active ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/40' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07]'}`}><div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/15' : done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>{done && !active ? <Check size={16}/> : <Icon size={17}/>}</div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{index}</p><p className="font-black text-sm truncate">{item.short}</p></div></button>;
}

function Hero({ eyebrow, title, subtitle, icon }) { return <div className="mb-7"><div className="inline-flex items-center gap-2 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em]">{icon}{eyebrow}</div><h1 className="mt-3 text-3xl md:text-5xl font-black uppercase italic leading-[0.95] tracking-tight text-slate-950">{title}</h1><p className="mt-4 max-w-3xl text-sm md:text-base font-semibold leading-relaxed text-slate-500">{subtitle}</p></div>; }

function BusinessStep({ selected, busy, onChoose }) { return <section><Hero eyebrow="Починаємо з основи" icon={<Sparkles size={15}/>} title="Як працює ваш бізнес?" subtitle="Від цього залежатимуть стартові статуси, формулювання в системі й головна робоча логіка. Змінити режим пізніше можна в налаштуваннях."/><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><BusinessCard type="sto" title="СТО" description="Записи на ремонт, пости, механіки, роботи, запчастини та сервісні рекомендації." icon={<Wrench size={34}/>} selected={selected === 'sto'} busy={Boolean(busy)} onChoose={onChoose}/><BusinessCard type="store" title="Магазин автотоварів" description="Замовлення, підбір деталей, склад, клієнти, доставка та Нова пошта." icon={<Store size={34}/>} selected={selected === 'store'} busy={Boolean(busy)} onChoose={onChoose}/></div><div className="mt-7 rounded-[28px] border border-blue-100 bg-blue-50 p-5 flex gap-3"><ShieldCheck className="text-blue-600 shrink-0"/><p className="text-sm font-bold leading-relaxed text-blue-800">Після вибору ми автоматично додамо стандартні статуси для вашого режиму. Ви зможете їх змінити пізніше в “Статуси і довідники”.</p></div></section>; }
function BusinessCard({ type, title, description, icon, selected, busy, onChoose }) { return <button disabled={busy} onClick={() => onChoose(type)} className={`group text-left rounded-[34px] p-6 md:p-8 border transition-all ${selected ? 'border-blue-600 bg-blue-600 text-white shadow-2xl shadow-blue-200' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100'}`}><div className={`w-16 h-16 rounded-[22px] flex items-center justify-center ${selected ? 'bg-white/15' : 'bg-blue-50 text-blue-600'}`}>{icon}</div><h2 className="mt-6 text-2xl font-black uppercase italic">{title}</h2><p className={`mt-3 text-sm font-semibold leading-relaxed ${selected ? 'text-blue-50' : 'text-slate-500'}`}>{description}</p><div className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase">{selected ? <><CheckCircle2 size={16}/> Обрано</> : <>Обрати <ArrowRight size={15}/></>}</div></button>; }

function ProfileStep({ form, setForm, busy, onSubmit, onBack }) { return <section><Hero eyebrow="Профіль компанії" icon={<Building2 size={15}/>} title="Зробимо систему вашою" subtitle="Ці дані підставлятимуться у документи, картки та контакти. Логотип можна додати зараз або пізніше."/><form onSubmit={onSubmit} className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Назва компанії" required value={form.company_name} onChange={(value) => setForm({ ...form, company_name: value })} placeholder="Наприклад: АвтоГараж Плюс"/><Field label="Телефон" required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="+380..."/><Field label="Адреса" value={form.address} onChange={(value) => setForm({ ...form, address: value })} placeholder="Місто, вулиця"/><label className="block"><span className="label">Логотип</span><div className="mt-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 flex items-center gap-3"><ImagePlus className="text-blue-600" size={20}/><input type="file" accept="image/*" onChange={(e) => setForm({ ...form, logo: e.target.files?.[0] || null })} className="text-sm font-bold text-slate-500 w-full"/></div></label></div><Footer onBack={onBack} primary="Зберегти і продовжити" loading={busy}/></form></section>; }

function DocumentsStep({ form, setForm, busy, onSubmit, onSkip, onBack }) { return <section><Hero eyebrow="Документи" icon={<FileText size={15}/>} title="Підготуйте документи" subtitle="Реквізити, підпис та гарантійний текст будуть використовуватись у рахунках, актах та гарантійних документах. Це можна зробити пізніше."/><form onSubmit={onSubmit} className="space-y-4"><TextArea label="Реквізити компанії" value={form.document_requisites} onChange={(value) => setForm({ ...form, document_requisites: value })} placeholder="ФОП / ЄДРПОУ / IBAN / банк"/><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Підпис у документах" value={form.document_signature} onChange={(value) => setForm({ ...form, document_signature: value })} placeholder="Керівник / ПІБ"/><Field label="Футер документа" value={form.document_footer} onChange={(value) => setForm({ ...form, document_footer: value })} placeholder="Дякуємо за співпрацю"/></div><TextArea label="Текст гарантії" value={form.document_warranty_text} onChange={(value) => setForm({ ...form, document_warranty_text: value })} placeholder="Умови гарантії..."/><Footer onBack={onBack} secondary="Налаштую пізніше" onSecondary={onSkip} primary="Зберегти і продовжити" loading={busy}/></form></section>; }

function StartStep({ businessType, demoSeeded, busy, onDemo, onRemoveDemo, onContinue, onBack }) { return <section><Hero eyebrow="Перші хвилини в системі" icon={<Sparkles size={15}/>} title="З чого вам зручніше почати?" subtitle="Можна стартувати з чистої системи або додати безпечні демо-приклади. Вони створяться лише у вашій компанії й видаляються однією кнопкою."/><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><article className="rounded-[32px] bg-slate-950 p-6 md:p-8 text-white"><div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center"><Sparkles size={28}/></div><h2 className="mt-6 text-2xl font-black uppercase italic">Показати на прикладі</h2><p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">Додамо {businessType === 'store' ? 'товар, клієнта та приклад замовлення' : 'пост, послугу, товар та приклад візиту'}. Реальні дані не зачіпаємо.</p>{demoSeeded ? <div className="mt-6 flex gap-2"><button onClick={onContinue} className="flex-1 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase text-slate-950">Демо готово</button><button disabled={Boolean(busy)} onClick={onRemoveDemo} className="rounded-2xl bg-white/10 px-4 py-3 text-xs font-black uppercase text-white">Видалити</button></div> : <button disabled={Boolean(busy)} onClick={onDemo} className="mt-6 w-full rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-60">{busy === 'demo' ? 'Додаємо...' : 'Додати демо-дані'}</button>}</article><article className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8"><div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Rocket size={28}/></div><h2 className="mt-6 text-2xl font-black uppercase italic text-slate-950">Почати з чистої системи</h2><p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">Ми не додаємо жодних тестових позицій. На останньому кроці ви зможете створити перший товар або перший запис.</p><button onClick={onContinue} className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-100">Продовжити без демо</button></article></div><Footer onBack={onBack}/></section>; }

function DeliveryStep({ ready, busy, onOpen, onSkip, onContinue, onBack }) { return <section><Hero eyebrow="Доставка" icon={<Truck size={15}/>} title="Підключіть Нову пошту" subtitle="Додайте API-ключ та відправника, щоб створювати ТТН і бачити статуси посилок прямо в замовленнях. Цей крок рекомендований для магазину й необов’язковий для СТО."/>{ready ? <div className="rounded-[30px] border border-emerald-100 bg-emerald-50 p-6 flex gap-4"><BadgeCheck className="text-emerald-600 shrink-0" size={28}/><div><h2 className="font-black text-emerald-900">Нова пошта підключена</h2><p className="mt-1 text-sm font-semibold text-emerald-800">Профіль відправника вже знайдено. Можна переходити до першої робочої дії.</p></div></div> : <div className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8"><div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 md:items-center"><div><h2 className="text-2xl font-black uppercase italic text-slate-950">Профіль відправника</h2><p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Відкриємо готовий безпечний екран підключення. Після збереження поверніться сюди — onboarding сам побачить профіль.</p></div><button onClick={onOpen} className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100">Підключити Нову пошту</button></div></div>}<Footer onBack={onBack} secondary="Налаштую пізніше" onSecondary={onSkip} primary="Продовжити" onPrimary={onContinue} loading={Boolean(busy)}/></section>; }

function FirstActionStep({ businessType, product, setProduct, visit, setVisit, busy, ready, onProduct, onVisit, onSkip, onComplete, onBack }) { const isStore = businessType === 'store'; return <section><Hero eyebrow="Перша користь" icon={<Rocket size={15}/>} title={ready ? 'Все готово до старту' : isStore ? 'Додайте перший товар' : 'Створіть перший запис'} subtitle={ready ? 'Базове налаштування виконано. Ви можете перейти до повноцінної роботи, а інші пункти залишаться у чеклисті на панелі.' : isStore ? 'Це створить реальну позицію у вашому складі. Дані можна буде відредагувати або видалити пізніше.' : 'Це створить реальний запис у вашому журналі. Дані можна буде відредагувати або видалити пізніше.'}/>{!ready && (isStore ? <form onSubmit={onProduct} className="rounded-[32px] border border-slate-200 bg-white p-5 md:p-7 space-y-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Package size={23}/></div><div><h2 className="font-black uppercase text-slate-950">Перший товар на склад</h2><p className="text-xs font-semibold text-slate-500">Мінімум даних — потім доповните.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field required label="Назва товару" value={product.name} onChange={(value) => setProduct({ ...product, name: value })} placeholder="Наприклад: Масляний фільтр"/><Field label="Артикул" value={product.article} onChange={(value) => setProduct({ ...product, article: value })} placeholder="W712/95"/><Field label="Бренд" value={product.brand} onChange={(value) => setProduct({ ...product, brand: value })} placeholder="MANN"/><Field required type="number" label="Кількість" value={product.quantity} onChange={(value) => setProduct({ ...product, quantity: value })}/><Field type="number" label="Закупка, грн" value={product.buy_price} onChange={(value) => setProduct({ ...product, buy_price: value })}/><Field type="number" label="Продаж, грн" value={product.sell_price} onChange={(value) => setProduct({ ...product, sell_price: value })}/></div><button disabled={Boolean(busy)} className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-black uppercase text-white disabled:opacity-60">{busy === 'first-product' ? 'Додаємо...' : 'Додати перший товар'}</button></form> : <form onSubmit={onVisit} className="rounded-[32px] border border-slate-200 bg-white p-5 md:p-7 space-y-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><ClipboardList size={23}/></div><div><h2 className="font-black uppercase text-slate-950">Перший запис на СТО</h2><p className="text-xs font-semibold text-slate-500">Почніть з клієнта та автомобіля.</p></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Field required label="Клієнт" value={visit.client} onChange={(value) => setVisit({ ...visit, client: value })} placeholder="Ім’я клієнта"/><Field required label="Телефон" value={visit.phone} onChange={(value) => setVisit({ ...visit, phone: value })} placeholder="+380..."/><Field required label="Номер авто" value={visit.plate} onChange={(value) => setVisit({ ...visit, plate: value })} placeholder="AA1234BB"/></div><button disabled={Boolean(busy)} className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-black uppercase text-white disabled:opacity-60">{busy === 'first-visit' ? 'Створюємо...' : 'Створити перший запис'}</button></form>)}<div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between"><div><p className="font-black text-slate-900">Можна завершити зараз</p><p className="text-sm font-semibold text-slate-500 mt-1">Ви зможете повернутися до налаштувань з чеклиста на головній сторінці.</p></div><button onClick={onComplete} disabled={Boolean(busy)} className="rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-60">Завершити старт</button></div><Footer onBack={onBack} secondary={!ready ? 'Зроблю пізніше' : null} onSecondary={!ready ? onSkip : null}/></section>; }

function Field({ label, value, onChange, placeholder, required, type = 'text' }) { return <label className="block"><span className="label">{label}{required ? ' *' : ''}</span><input required={required} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>; }
function TextArea({ label, value, onChange, placeholder }) { return <label className="block"><span className="label">{label}</span><textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 min-h-[104px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>; }
function Footer({ onBack, secondary, onSecondary, primary, onPrimary, loading }) { return <div className="mt-7 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100"><ArrowLeft size={16}/> Назад</button><div className="flex flex-col sm:flex-row gap-2">{secondary && <button type="button" onClick={onSecondary} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-600 hover:bg-slate-50">{secondary}</button>}{primary && <button type={onPrimary ? 'button' : 'submit'} onClick={onPrimary} disabled={loading} className="rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-blue-100 disabled:opacity-60">{loading ? 'Зберігаємо...' : <>{primary} <ArrowRight size={15} className="inline ml-1"/></>}</button>}</div></div>; }
function Notice({ notice, onClose }) { const error = notice.type === 'error'; return <div className={`mb-5 rounded-2xl border p-4 flex gap-3 items-start ${error ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}><div className="flex-1 text-sm font-bold">{notice.text}</div><button onClick={onClose} className="opacity-70 hover:opacity-100"><X size={16}/></button></div>; }
function FullScreenLoader() { return <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4"><div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center"><Loader2 className="animate-spin"/></div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Готуємо ваш робочий простір</p></div>; }
