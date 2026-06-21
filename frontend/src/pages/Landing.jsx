import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  Menu,
  Package,
  Phone,
  Play,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import api from '../api/axios';
import './Landing.css';

const DEMO_SCREENS = [
  { id: 'dashboard', label: 'Панель', kicker: 'ЩОДЕННА РОБОТА', title: 'Панель, з якої починається день', text: 'Гроші, замовлення, склад, доставка та проблеми — в одному робочому просторі.' },
  { id: 'clients', label: 'Клієнти', kicker: 'CRM ПОВТОРНИХ ПРОДАЖІВ', title: 'Клієнти, які повертаються', text: 'Історія, замовлення, борги, нагадування й наступна дія в картці покупця.' },
  { id: 'analytics', label: 'Аналітика', kicker: 'PREMIUM DASHBOARD', title: 'Цифри, за якими можна діяти', text: 'Виручка, прибуток, товари та замовлення без ручних зведень у таблицях.' },
];

const FEATURES = [
  { number: '01', icon: ClipboardList, title: 'Замовлення в одному місці', text: 'Авто, клієнт, роботи, запчастини, оплата, документи й відповідальний майстер живуть в одному сценарії.' },
  { number: '02', icon: Package, title: 'Склад без сюрпризів', text: 'Резерви, прихід, списання та маржа видно до того, як менеджер пообіцяє деталь, якої вже немає.' },
  { number: '03', icon: BarChart3, title: 'Картина для керівника', text: 'Дивись на гроші, навантаження, борги та результат команди без ручних зведень у таблицях.' },
];

const FAQS = [
  ['Кому підійде VIN-matrix?', 'СТО, шиномонтажу, магазину запчастин або змішаному бізнесу, де вже не вистачає Viber, Excel і пам’яті адміністратора.'],
  ['Що я побачу в демо?', 'Панель керівника, CRM клієнтів, замовлення, склад і аналітику на навчальному сценарії, а не на порожньому шаблоні.'],
  ['Що входить у тариф?', 'Замовлення, CRM, склад, документи, оплати, аналітика, оновлення та підтримка. Без прихованих модулів у базовому сценарії.'],
];

function useRevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function VinLogo({ inverse = false, compact = false }) {
  return <span className={`vin-logo ${inverse ? 'inverse' : ''} ${compact ? 'compact' : ''}`}><b>VIN</b><em>-matrix</em></span>;
}

function SceneSidebar({ active = 'dashboard' }) {
  const items = [
    { id: 'orders', icon: ShoppingCart, label: 'Замовлення' },
    { id: 'search', icon: Search, label: 'Пошук запчастин' },
    { id: 'clients', icon: Users, label: 'Клієнти' },
    { id: 'stock', icon: Package, label: 'Склад' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Панель' },
    { id: 'analytics', icon: LineChart, label: 'Аналітика' },
  ];

  return <aside className="product-app-sidebar">
    <div className="product-app-logo"><VinLogo inverse compact /></div>
    <span className="product-nav-caption">ЩОДЕННА РОБОТА</span>
    {items.slice(0, 4).map(({ id, icon: Icon, label }) => <div className={`product-nav-item ${active === id ? 'active' : ''}`} key={id}><Icon size={13} /><span>{label}</span></div>)}
    <span className="product-nav-caption control">КОНТРОЛЬ</span>
    {items.slice(4).map(({ id, icon: Icon, label }) => <div className={`product-nav-item ${active === id ? 'active' : ''}`} key={id}><Icon size={13} /><span>{label}</span></div>)}
    <div className="product-nav-bottom"><Settings size={13} /><span>Налаштування</span></div>
  </aside>;
}

function ProductTopbar() {
  return <div className="product-topbar">
    <div className="product-search"><Search size={13} /><span>Пошук: №, телефон, клієнт, VIN, авто, артикул...</span></div>
    <div className="product-topbar-actions"><div className="product-code">ВАШ КОД: <b>A6000</b></div><div className="product-bell"><Bell size={14} /><i>22</i></div><div className="product-avatar">ДЕ</div></div>
  </div>;
}

function DashboardScene() {
  return <div className="product-scene product-scene-dashboard">
    <div className="dashboard-title-row"><div><span className="scene-badge"><LayoutDashboard size={13} /> ПАНЕЛЬ</span><small>Бізнес-огляд: магазин автозапчастин · 13 активних віджетів</small></div><div className="scene-actions"><button><span>↻</span> ОНОВИТИ</button><button>НАЛАШТУВАТИ ВІДЖЕТИ</button></div></div>
    <div className="dashboard-hero-card"><div><span>ДОБРИЙ ДЕНЬ,</span><h3>Денис</h3><p>R16.com.ua · Це ваша бізнес-панель: гроші, замовлення, склад, доставка і проблеми в одному місці.</p></div><div className="dashboard-search-widget"><Search size={17} /><span>Швидкий пошук запчастин...</span></div><i className="dashboard-orb orb-a" /><i className="dashboard-orb orb-b" /></div>
    <div className="dashboard-ocr-card"><span className="ocr-chip">ШІ-МОДУЛЬ</span><b>▣ ШВИДКИЙ OCR СКАН</b><p>Завантажте техпаспорт для миттєвого заповнення картки</p><div><button>▣ КАМЕРА</button><button>▧ ГАЛЕРЕЯ</button></div></div>
    <div className="dashboard-mini-kpis"><article className="mint"><span>ВИРУЧКА СЬОГОДНІ</span><b>0 ₴</b><em>0 замовлень</em></article><article className="blue"><span>ПРИБУТОК СЬОГОДНІ</span><b>0 ₴</b><em>Товари + роботи</em></article><article className="rose"><span>БОРГИ</span><b>0 ₴</b><em>0 проблемних замовлень</em></article><article className="amber"><span>У РОБОТІ</span><b>21</b><em>Прострочено: 18</em></article></div>
  </div>;
}

function ClientsScene() {
  return <div className="product-scene product-scene-clients">
    <div className="clients-banner"><div><span className="scene-badge dark"><Users size={13} /> CRM ПОВТОРНИХ ПРОДАЖІВ</span><h3>ПОКУПЦІ</h3><p>Картка покупця, pipeline, борги, прибуток, історія, повторні продажі, задачі й нагадування в одному робочому екрані.</p></div><button>↻ ОНОВИТИ CRM</button><div className="clients-banner-kpis"><span><b>16</b>ПОКУПЦІВ</span><span><b>29</b>ЗАМОВЛЕНЬ</span><span><b>32 988 ₴</b>ВИРУЧКА</span><span><b className="green">15 412 ₴</b>ПРИБУТОК</span></div></div>
    <div className="clients-search"><Search size={15} /><span>Пошук: № замовлення, телефон, ПІБ, авто, VIN, артикул або товар...</span><button>ЗНАЙТИ</button></div>
    <div className="clients-tabs"><b>УСІ <i>16</i></b><span>НОВИЙ <i>0</i></span><span>АКТИВНИЙ <i>11</i></span><span>ПОСТІЙНИЙ <i>2</i></span><span>З БОРГОМ <i>3</i></span></div>
    <div className="clients-workspace"><div className="client-list-card"><strong>СПИСОК ПОКУПЦІВ</strong><small>Натисніть, щоб відкрити картку</small><article><div><b>Skoda Octavia / Олександр</b><span>⌕ 0997663274</span></div><em>ПОСТІЙНИЙ</em><div className="client-small-stats"><span>ЗАМ.<b>4</b></span><span>СУМА<b>9 097,1 ₴</b></span><span>БОРГ<b>0 ₴</b></span></div></article></div><div className="client-empty"><Users size={31} /><b>ОБЕРІТЬ ПОКУПЦЯ ЗІ СПИСКУ</b></div></div>
  </div>;
}

function AnalyticsScene() {
  return <div className="product-scene product-scene-analytics">
    <div className="analytics-banner"><div><span className="scene-badge dark"><BarChart3 size={13} /> PREMIUM DASHBOARD</span><h3>АНАЛІТИКА</h3><p>Товари, оборот, постачальники, склад, клієнти, борги та витрати магазину</p><div className="analytics-filter">МАГАЗИН <i>30 ДНІВ · 2026-05-23 — 2026-06-21</i></div></div><div className="analytics-head-kpis"><span>ВИРУЧКА<b>23 194 ₴</b></span><span>ЧИСТИЙ ПРИБУТОК<b className="green">-38 570 ₴</b></span><span>БОРГИ<b>0 ₴</b></span></div></div>
    <div className="analytics-tabs"><b>ОГЛЯД</b><span>ЗАМОВЛЕННЯ</span><span>ТОВАРИ</span><span>ПОСТАЧАЛЬНИКИ</span><span>СКЛАД</span><span>КЛІЄНТИ</span></div>
    <div className="analytics-color-kpis"><article className="k-blue"><span>ВИРУЧКА</span><b>23 194 ₴</b></article><article className="k-navy"><span>ЗАКУПКА ПРОДАНОГО</span><b>10 950 ₴</b></article><article className="k-teal"><span>ВАЛОВИЙ ПРИБУТОК</span><b>12 244 ₴</b></article><article className="k-green"><span>ЧИСТИЙ ПРИБУТОК</span><b>-38 570 ₴</b></article><article className="k-red"><span>ВИТРАТИ МАГАЗИНУ</span><b>50 000 ₴</b></article></div>
    <div className="analytics-chart-card"><div><b>▣ ДИНАМІКА</b><span>Виручка і чистий прибуток у вибраному періоді.</span></div><div className="analytics-bars">{[12, 8, 10, 84, 36, 10, 8, 45, 39, 8].map((value, index) => <i style={{ '--bar': `${value}%`, '--delay': `${index * 70}ms` }} key={index} />)}</div><aside><span>ОПЛАЧЕНО</span><b>31 884 ₴</b><span>НЕЗАКРИТА СУМА</span><b>7 768 ₴</b></aside></div>
  </div>;
}

function ProductFrame({ screenId = 'dashboard', hero = false, onPointerMove, onPointerLeave }) {
  const activeLabel = DEMO_SCREENS.find((screen) => screen.id === screenId)?.label || 'Панель';
  const scene = screenId === 'clients' ? <ClientsScene /> : screenId === 'analytics' ? <AnalyticsScene /> : <DashboardScene />;
  return <div className={`product-frame ${hero ? 'hero-frame' : ''}`} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
    <div className="product-browser-bar"><div className="product-browser-dots"><i /><i /><i /></div><span>VIN-matrix · {activeLabel}</span><div className="product-browser-live"><i /> LIVE</div></div>
    <div className="product-app-shell"><SceneSidebar active={screenId} /><div className="product-app-main"><ProductTopbar /><div className="product-app-content" key={screenId}>{scene}</div></div></div>
  </div>;
}

function LiveProductShowcase() {
  const [active, setActive] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setActive((current) => (current + 1) % DEMO_SCREENS.length), 6200);
    return () => window.clearInterval(interval);
  }, []);

  const parallax = (event) => {
    if (!frameRef.current || window.matchMedia('(max-width: 980px)').matches) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    frameRef.current.style.setProperty('--rx', `${-y * 1.6}deg`);
    frameRef.current.style.setProperty('--ry', `${x * 2.3}deg`);
  };
  const resetParallax = () => {
    frameRef.current?.style.setProperty('--rx', '0deg');
    frameRef.current?.style.setProperty('--ry', '0deg');
  };

  return <div className="live-product-showcase" ref={frameRef}>
    <div className="live-product-meta"><span><i /> ЖИВИЙ ІНТЕРФЕЙС</span><b>{DEMO_SCREENS[active].label}</b></div>
    <ProductFrame screenId={DEMO_SCREENS[active].id} hero onPointerMove={parallax} onPointerLeave={resetParallax} />
    <div className="live-product-tabs">{DEMO_SCREENS.map((screen, index) => <button type="button" onClick={() => setActive(index)} className={active === index ? 'active' : ''} key={screen.id}><small>0{index + 1}</small><span>{screen.label}</span><i /></button>)}</div>
  </div>;
}

function LeadForm() {
  const [form, setForm] = useState({ name: '', phone: '', type: 'СТО', team: '1–3' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Вкажи ім’я та номер телефону.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const response = await api.post('/api/landing/leads/', form);
      if (!response.data?.ok) throw new Error('request was not accepted');
      setSent(true);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Не вдалося надіслати заявку. Спробуй ще раз трохи пізніше.');
    } finally {
      setSending(false);
    }
  };

  if (sent) return <div className="landing-form-success"><span className="form-success-icon"><Check size={20} /></span><h3>Заявку надіслано</h3><p>Ми зв’яжемося, щоб провести показ на твоєму сценарії. Поки що можеш відкрити живе демо.</p><a href="/demo">Відкрити демо <ArrowRight size={16} /></a></div>;
  return <form className="landing-lead-form" onSubmit={submit}>
    <label><span>Ім’я</span><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Як до тебе звертатись" /></label>
    <label><span>Телефон</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+38 (0__) ___ __ __" inputMode="tel" /></label>
    <div className="landing-form-pair"><label><span>Тип бізнесу</span><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>СТО</option><option>Магазин запчастин</option><option>СТО + магазин</option><option>Шиномонтаж</option></select></label><label><span>Команда</span><select value={form.team} onChange={(event) => update('team', event.target.value)}><option>1–3</option><option>4–10</option><option>11+</option></select></label></div>
    {error && <p className="landing-form-error">{error}</p>}
    <button type="submit" disabled={sending}>{sending ? 'Надсилаємо…' : 'Записатися на показ'} <ArrowRight size={16} /></button>
    <small>Публічне демо відкривається одразу. Заявка — для персонального показу під твій бізнес.</small>
  </form>;
}

export function DemoTour() {
  useRevealOnScroll();
  const [active, setActive] = useState(0);
  const current = DEMO_SCREENS[active];

  return <div className="landing-demo-page">
    <header className="landing-demo-header"><a href="/landing" className="header-logo"><VinLogo inverse /></a><a href="/landing#request">Записатися на показ <ArrowRight size={16} /></a></header>
    <main className="landing-demo-main">
      <section className="demo-intro" data-reveal><span className="eyebrow"><i /> ІНТЕРАКТИВНЕ ДЕМО</span><h1>Подивись на систему <em>в роботі.</em></h1><p>Перемикай реальні сценарії VIN-matrix: панель керівника, CRM клієнтів і аналітику.</p></section>
      <div className="demo-screen-picker" data-reveal>{DEMO_SCREENS.map((screen, index) => <button type="button" key={screen.id} onClick={() => setActive(index)} className={active === index ? 'active' : ''}><small>0{index + 1}</small><span>{screen.label}</span></button>)}</div>
      <div className="demo-frame-wrap" data-reveal><ProductFrame screenId={current.id} /><div className="demo-frame-caption"><div><span>{current.kicker}</span><h2>{current.title}</h2><p>{current.text}</p></div><a href="/landing#request">Хочу показ для свого бізнесу <ArrowRight size={16} /></a></div></div>
    </main>
  </div>;
}

export function Landing() {
  useRevealOnScroll();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return <div className="landing-page">
    <nav className="landing-nav"><a href="/landing" className="header-logo"><VinLogo inverse /></a><div className={`landing-nav-links ${menuOpen ? 'open' : ''}`}><a href="#product">Можливості</a><a href="#tariff">Тариф</a><a href="#request">Показ</a><a href="/login">Увійти</a></div><div className="landing-nav-actions"><a href="/demo">Відкрити демо <ArrowRight size={16} /></a><button type="button" aria-label="Відкрити меню" onClick={() => setMenuOpen((state) => !state)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div></nav>

    <main>
      <section className="landing-hero" data-reveal><div className="landing-hero-copy"><span className="eyebrow"><i /> СИСТЕМА УПРАВЛІННЯ ДЛЯ АВТОБІЗНЕСУ</span><h1>Менше хаосу.<br /><em>Більше контролю.</em></h1><p>VIN-matrix збирає замовлення, склад, клієнтів, оплату й команду в один робочий простір. Ти бачиш процес, а не шукаєш його по чатах.</p><div className="landing-hero-actions"><a className="primary" href="/demo"><Play size={15} fill="currentColor" /> Відкрити демо</a><a className="secondary" href="#request">Записатися на показ <ArrowRight size={16} /></a></div><div className="landing-hero-note"><ShieldCheck size={17} /><span>Демо працює на навчальних даних: без реальних клієнтів, оплат та інтеграцій.</span></div><div className="hero-scroll-cue"><i /><span>SCROLL TO EXPLORE</span></div></div><LiveProductShowcase /></section>

      <section className="landing-strip" data-reveal><span>СТО</span><i>•</i><span>МАГАЗИН ЗАПЧАСТИН</span><i>•</i><span>ШИНОМОНТАЖ</span><i>•</i><span>КЕРІВНИК</span><i>•</i><span>АДМІНІСТРАТОР</span></section>

      <section id="product" className="landing-features" data-reveal><div className="landing-section-heading"><span className="eyebrow"><i /> НЕ ЩЕ ОДНА CRM</span><h2>Від першого дзвінка до виданого авто — без розривів у процесі.</h2></div><div className="landing-feature-list">{FEATURES.map(({ number, icon: Icon, title, text }, index) => <article style={{ '--delay': `${index * 100}ms` }} key={number}><small>{number}</small><span><Icon size={20} /></span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={17} /></article>)}</div></section>

      <section className="landing-showcase" data-reveal><div className="landing-showcase-copy"><span className="eyebrow"><i /> ЖИВИЙ СЦЕНАРІЙ, НЕ СЛАЙДИ</span><h2>Людина бачить не функції. Вона бачить свій робочий день.</h2><p>Прийняли авто, створили замовлення, додали роботи, зарезервували запчастини, отримали оплату й побачили результат — саме в такій послідовності працює система.</p><a href="/demo">Відкрити живе демо <ArrowRight size={16} /></a></div><div className="showcase-flow">{[['01','Новий запис','Клієнт і авто'],['02','Робота','Майстер і послуги'],['03','Запчастини','Резерв і маржа'],['04','Видача','Оплата і документ']].map(([number, title, text], index) => <article style={{ '--i': index }} key={number}><small>{number}</small><b>{title}</b><span>{text}</span><i /></article>)}</div></section>

      <section id="tariff" className="landing-pricing" data-reveal><div className="landing-section-heading"><span className="eyebrow"><i /> ЗРОЗУМІЛИЙ СТАРТ</span><h2>Один тариф, у якому є основне для щоденної роботи.</h2><p>14 днів безкоштовно. Потім — фіксована щомісячна оплата без окремих модулів за базові процеси.</p></div><article className="landing-price-card"><header><span>VIN-matrix</span><b>СТАНДАРТ</b></header><div className="price-main"><small>від</small><strong>2 000</strong><span>грн / місяць</span></div><ul><li><Check size={16} /> Замовлення, клієнти та авто</li><li><Check size={16} /> Склад, резерви та маржа</li><li><Check size={16} /> Документи, оплати, аналітика</li><li><Check size={16} /> Оновлення й підтримка</li></ul><a href="#request">Записатися на показ <ArrowRight size={16} /></a></article></section>

      <section id="request" className="landing-request" data-reveal><div className="landing-request-copy"><span className="eyebrow"><i /> ПЕРСОНАЛЬНИЙ ПОКАЗ</span><h2>Не вибирай систему навмання.</h2><p>Залиш контакти — покажемо VIN-matrix саме на тому, що важливо для твого бізнесу: замовлення, склад, команда або фінанси.</p><div className="request-note"><Phone size={17} /><span>Публічне демо відкривається одразу. Заявка — щоб підготувати персональний показ.</span></div><a href="/demo">Відкрити демо зараз <ArrowRight size={16} /></a></div><LeadForm /></section>

      <section className="landing-faq" data-reveal><div className="landing-section-heading"><span className="eyebrow"><i /> ПЕРЕД СТАРТОМ</span><h2>Відповіді без дрібного шрифту.</h2></div><div className="faq-list">{FAQS.map(([question, answer], index) => <button type="button" key={question} onClick={() => setActiveFaq(activeFaq === index ? -1 : index)} className={activeFaq === index ? 'open' : ''}><div><strong>{question}</strong>{activeFaq === index && <p>{answer}</p>}</div><ChevronRight size={18} /></button>)}</div></section>
    </main>

    <footer className="landing-footer"><a href="/landing"><VinLogo /></a><span>© {currentYear} · Система управління для автобізнесу</span><a href="/login">Увійти <ArrowRight size={15} /></a></footer>
  </div>;
}

export default function LandingRoute() { return <Landing />; }
