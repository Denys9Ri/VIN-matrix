import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  Package,
  Play,
  Search,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import './LandingFinal.css';

const DEMO_SCREENS = [
  {
    id: 'visits',
    label: 'Дошка візитів',
    eyebrow: 'КЕРУВАННЯ ЗМІНОЮ',
    title: 'Весь сервісний день одним поглядом',
    text: 'Черга, пости, майстри, роботи, запчастини та видача авто — на одній дошці.',
  },
  {
    id: 'passport',
    label: 'Скан техпаспорта',
    eyebrow: 'ШВИДКЕ ОФОРМЛЕННЯ',
    title: 'Авто заповнюється без ручного введення',
    text: 'Скануєш техпаспорт — VIN та дані автомобіля одразу потрапляють у картку візиту.',
  },
  {
    id: 'client',
    label: 'Картка клієнта',
    eyebrow: 'CRM СЕРВІСУ',
    title: 'Клієнт, авто й історія сервісу в одному місці',
    text: 'Борги, візити, рекомендації, роботи та наступний контакт видно без пошуку по чатах.',
  },
  {
    id: 'inventory',
    label: 'Склад і закупки',
    eyebrow: 'КОНТРОЛЬ ГРОШЕЙ',
    title: 'Ти бачиш, де гроші лежать на складі',
    text: 'Неліквід, мінімальні залишки, резерви й закупки без окремих таблиць.',
  },
  {
    id: 'analytics',
    label: 'Аналітика',
    eyebrow: 'КАРТИНА ДЛЯ КЕРІВНИКА',
    title: 'Не цифри заради цифр. Рішення на сьогодні.',
    text: 'Виручка, прибуток, борги, майстри та закриті візити — у потрібному контексті.',
  },
];

const FEATURE_CARDS = [
  {
    number: '01',
    icon: FileText,
    title: 'Скан техпаспорта',
    text: 'Замість ручного перенесення даних — один скан і готова картка авто з VIN.',
    tag: 'OCR · ВВЕДЕННЯ ЗА СЕКУНДИ',
  },
  {
    number: '02',
    icon: ClipboardList,
    title: 'Дошка візитів',
    text: 'Зміна перед очима: хто в черзі, хто працює, що готово й де виникла затримка.',
    tag: 'WORKBOARD · ЖИВИЙ ПРОЦЕС',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Документи без хаосу',
    text: 'Акт, рахунок, чек, гарантія та PDF створюються з того самого візиту.',
    tag: 'PDF · ДОКУМЕНТ ЗА ДВА КЛІКИ',
  },
];

const FAQS = [
  ['Для кого VIN-matrix?', 'Для СТО, шиномонтажу, магазину запчастин та змішаного автобізнесу, де щоденна робота вже не поміщається у Viber та Excel.'],
  ['Чи можна подивитися систему до реєстрації?', 'Так. У публічному демо є реальні сценарії: дошка візитів, техпаспорт, CRM, склад і аналітика.'],
  ['Що дає реєстрація?', 'Ти створюєш власний робочий простір і проходиш стартове налаштування під свій бізнес.'],
];

function useReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-vf-reveal]'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('vf-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function Logo({ inverse = false }) {
  return <span className={`vf-logo ${inverse ? 'vf-logo-inverse' : ''}`}><b>VIN</b><em>-matrix</em></span>;
}

function AppSidebar({ active }) {
  const daily = [
    ['visits', Wrench, 'Візити'],
    ['search', Search, 'Пошук запчастин'],
    ['client', Users, 'Клієнти'],
    ['inventory', Package, 'Склад'],
  ];
  const control = [
    ['dashboard', LayoutDashboard, 'Панель'],
    ['analytics', LineChart, 'Аналітика'],
  ];
  return <aside className="vf-app-sidebar">
    <Logo inverse />
    <span className="vf-side-caption">ЩОДЕННА РОБОТА</span>
    {daily.map(([id, Icon, label]) => <div className={`vf-side-link ${active === id ? 'active' : ''}`} key={id}><Icon size={13} /><span>{label}</span></div>)}
    <span className="vf-side-caption vf-side-control">КОНТРОЛЬ</span>
    {control.map(([id, Icon, label]) => <div className={`vf-side-link ${active === id ? 'active' : ''}`} key={id}><Icon size={13} /><span>{label}</span></div>)}
    <div className="vf-side-settings"><Settings size={13} /><span>Налаштування</span></div>
  </aside>;
}

function AppTopbar() {
  return <div className="vf-app-topbar">
    <div className="vf-top-search"><Search size={13} /><span>Пошук: №, телефон, клієнт, VIN, авто, артикул...</span></div>
    <div className="vf-top-actions"><span>ВАШ КОД: <b>C6002</b></span><span className="vf-test-chip"><CalendarDays size={11} /> Тест 13 дн.</span><i className="vf-notification"><Bell size={13} /><b>2</b></i><strong>IA</strong></div>
  </div>;
}

function VisitsScene() {
  const [stage, setStage] = useState('queue');
  const stages = [
    { id: 'queue', title: 'В ЧЕРЗІ / ПІДБІР', hint: 'Новий запис', color: 'amber' },
    { id: 'work', title: 'В РОБОТІ', hint: 'Майстер і роботи', color: 'blue' },
    { id: 'ready', title: 'ГОТОВО', hint: 'Видача авто', color: 'green' },
  ];
  const next = stage === 'queue' ? 'work' : stage === 'work' ? 'ready' : 'queue';
  const nextLabel = stage === 'queue' ? 'В роботу' : stage === 'work' ? 'Готово' : 'В чергу';
  return <div className="vf-scene vf-visits-scene">
    <div className="vf-page-title"><span className="vf-title-icon"><ClipboardList size={16} /></span><div><h3>Дошка візитів</h3><p>Записи, пости, майстри, роботи, запчастини й документи в одному робочому екрані.</p></div><button>＋ НОВИЙ ВІЗИТ</button></div>
    <div className="vf-board-toolbar"><div><Search size={14} /><span>Пошук: ID, номер авто, клієнт, телефон, VIN...</span></div><aside><button>‹</button><span><small>ДАТА ДОШКИ</small>сб, 20 червня</span><button>›</button></aside></div>
    <div className="vf-visit-columns">{stages.map((column) => <section className={`vf-visit-column ${column.color}`} key={column.id}><header><span>{column.title}</span><b>{stage === column.id ? 1 : 0}</b></header>{stage === column.id ? <article className="vf-visit-card"><small>КЛІЄНТ</small><h4>Демо клієнт</h4><p>🚗 DEMO-STO <i>(000001)</i></p><p>⌕ +380000000001</p><footer><span>◷ 10:19</span><button onClick={() => setStage(next)}>{nextLabel} <ArrowRight size={11} /></button></footer><em>ПОСТ: ДЕМО ПОСТ VIN-MATRIX</em></article> : <div className="vf-board-empty">ПУСТО</div>}</section>)}</div>
    <div className="vf-scene-callout"><span>ДОШКА ЖИВА:</span> перемісти візит між етапами й команда одразу бачить наступну дію.</div>
  </div>;
}

function PassportScene() {
  const [scanning, setScanning] = useState(false);
  const [filled, setFilled] = useState(false);
  const scan = () => {
    if (scanning) return;
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setFilled(true);
    }, 1250);
  };
  const fields = filled
    ? [['МАРКА', 'TOYOTA'], ['МОДЕЛЬ', 'RAV4'], ['РІК', '2021'], ['ОБ’ЄМ СМ³', '1987'], ['ПОТУЖНІСТЬ КВТ', '127'], ['КОД ДВИГУНА', 'M20A-FKS']]
    : [['МАРКА', ''], ['МОДЕЛЬ', ''], ['РІК', ''], ['ОБ’ЄМ СМ³', ''], ['ПОТУЖНІСТЬ КВТ', ''], ['КОД ДВИГУНА', '']];
  return <div className="vf-scene vf-passport-scene">
    <div className="vf-visit-modal-head"><div><span className="vf-pill"># ВІЗИТ №33</span><span className="vf-status-pill">В ЧЕРЗІ / ПІДБІР</span><h3>DEMO-STO</h3><p>Демо клієнт · +380000000001</p></div><div><button className="vf-dark-button"><FileText size={12} /> ДОКУМЕНТИ</button><button className="vf-close-button">×</button></div></div>
    <div className="vf-visit-kpis"><span><small>СТАТУС</small><b>В черзі / підбір</b></span><span><small>ВИРУЧКА</small><b>760 ₴</b></span><span className="good"><small>ПРИБУТОК</small><b>0 ₴</b></span><span><small>ОПЛАЧЕНО</small><b>0 ₴</b></span><span className="danger"><small>БОРГ</small><b>760 ₴</b></span></div>
    <div className="vf-visit-tabs"><span>◉ ОГЛЯД</span><b>▣ ТЕХПАСПОРТ</b><span>▤ АКТ</span><span>☷ ДІАГНОСТИКА</span><span>⚒ РОБОТИ</span><span>◈ ЗАПЧАСТИНИ</span><span>▤ РЕКОМЕНДАЦІЇ</span></div>
    <section className="vf-passport-card"><header><div><span className="vf-title-icon"><Car size={14} /></span><div><h4>ТЕХПАСПОРТ</h4><p>Авто, VIN, двигун</p></div></div><small>СТО №33</small></header><div className={`vf-scan-row ${scanning ? 'scanning' : ''}`}><div><FileText size={17} /><b>{scanning ? 'Розпізнаємо техпаспорт…' : filled ? 'Дані з техпаспорта отримано' : 'Скан техпаспорта'}</b></div><button onClick={scan}>{scanning ? 'СКАНУЄМО…' : filled ? 'СКАНУВАТИ ЩЕ' : 'СКАНУВАТИ'}</button></div><div className="vf-passport-fields"><div className="vf-fields-head"><b>ДАНІ АВТОМОБІЛЯ</b><span>{filled ? 'РОЗПІЗНАНО OCR' : 'ПЕРЕВІРЕНО ВРУЧНУ'}</span></div><div className="vf-fields-grid">{fields.map(([label, value]) => <label key={label}><span>{label}</span><strong>{value}</strong></label>)}</div><label className="vf-fuel"><span>ПАЛИВО</span><strong>{filled ? 'БЕНЗИН' : ''}</strong></label></div><div className="vf-vin-row"><span><small>ДЕРЖ. НОМЕР</small><b>DEMO-STO</b></span><span><small>VIN</small><b>{filled ? 'JTMDFREV10D000001' : 'DEMO000000000001'}</b></span></div><button className="vf-save-passport">ЗБЕРЕГТИ ТЕХПАСПОРТ</button></section>
  </div>;
}

function ClientScene() {
  return <div className="vf-scene vf-client-scene">
    <div className="vf-client-list"><header><h4>СПИСОК КЛІЄНТІВ</h4><span>Натисніть, щоб відкрити картку</span></header><article><div className="vf-client-row"><b>Демо клієнт</b><em>З БОРГОМ</em></div><small>⌕ +380000000001</small><div className="vf-client-metrics"><span>ВІЗ.<b>1</b></span><span>СУМА<b>760 ₴</b></span><span>БОРГ<b className="red">760 ₴</b></span><span>СЕРВІС<b className="green">3</b></span></div><footer>Останній візит: 20 черв. 2026 р. <button>ЗАКРИТИ</button></footer></article></div>
    <div className="vf-client-profile"><div className="vf-client-profile-head"><span>КАРТКА КЛІЄНТА</span><h3>ДЕМО КЛІЄНТ <i>З БОРГОМ</i></h3><p>Є неоплачена сума по замовленнях</p><div className="vf-client-actions"><button>⌕ +380000000001</button><button>☆ ID: 380000000001</button><button>☎ ПОДЗВОНИТИ</button><button>◌ НАПИСАТИ</button><button>▣ ЗАДАЧА</button></div></div><div className="vf-client-profile-kpis"><span>ВІЗИТІВ<b>1</b></span><span>ВИРУЧКА<b>760 ₴</b></span><span>ПРИБУТОК<b className="green">580 ₴</b></span><span>БОРГ<b className="red">760 ₴</b></span></div><div className="vf-client-debt"><b>△ Є НЕОПЛАЧЕНА СУМА</b><span>Клієнт автоматично в pipeline “З боргом”.</span><button>ЗАКРИТИ БОРГ</button></div><div className="vf-client-profile-tabs"><b>◉ ОГЛЯД</b><span>⚒ СЕРВІС</span><span>◷ ВІЗИТИ</span><span>🚗 АВТО</span><span>▤ БОРГИ</span><span>▣ CRM</span></div><div className="vf-client-info"><article><h4>КОРОТКИЙ ПРОФІЛЬ</h4><div><span>ТЕЛЕФОН<b>+380000000001</b></span><span>ОСТАННІЙ ВІЗИТ<b>20 черв. 2026 р.</b></span><span>PIPELINE<b>З боргом</b></span></div></article><article><h4>ОСТАННІ РОБОТИ</h4><div className="vf-job-row"><b>⚒ Демо: заміна масла</b><span>№33 · 20 черв. 2026 р.</span><em>500 ₴</em></div></article></div></div>
  </div>;
}

function InventoryScene() {
  return <div className="vf-scene vf-inventory-scene">
    <div className="vf-inventory-title"><span className="vf-title-icon"><Package size={16} /></span><div><h3>Склад</h3><p>Залишки, резерв, доступно, прихід, прайс товарів, постачальники і журнал руху.</p></div><button>＋ НОВИЙ ПРИХІД</button></div>
    <div className="vf-inventory-tabs"><b>◈ ТОВАРИ</b><span>▤ ПРИХІД</span><span>▤ ПРАЙС EXCEL</span><span>◷ ЖУРНАЛ</span><span>▣ ПОСТАЧАЛЬНИКИ</span></div>
    <div className="vf-stock-metrics"><span>ТОВАРІВ<b>1</b></span><span>НА СУМУ<b>1 440 ₴</b></span><span>У РЕЗЕРВІ<b>0 шт</b></span><span>ДОСТУПНО<b className="green">8 шт</b></span><span>ДОКУПИТИ<b>0</b></span></div>
    <div className="vf-inventory-workspace"><aside><h4>КАТЕГОРІЇ</h4><b>Усі товари</b><span>Фільтри</span><span>Гальмівна система</span><span>Підвіска</span><span>Рульове керування</span><span>Двигун</span><span>ГРМ та ремені</span></aside><main><div className="vf-stock-search"><Search size={13} /><span>Пошук по артикулу, бренду, назві, постачальнику</span><button>＋ ПРИХІД</button></div><article className="vf-stock-item"><b>VM-DEMO-001</b><span>VIN-MATRIX</span><h4>Демо масляний фільтр</h4><p>ДЕМО ТОВАРИ VIN-MATRIX · ДЕМО ПОСТАЧАЛЬНИК VIN-MATRIX</p><div><span>НА СКЛАДІ<b>8 шт</b></span><span>У РЕЗЕРВІ<b>0 шт</b></span><span className="available">ДОСТУПНО<b>8 шт</b></span><span>МІНІМУМ<b>0 шт</b></span><span>ЗАКУПКА<b>180 ₴</b></span><span>ПРОДАЖ<b>260 ₴</b></span></div></article></main></div>
  </div>;
}

function AnalyticsScene() {
  const bars = [16, 23, 32, 68, 42, 21, 13, 52, 84, 48];
  return <div className="vf-scene vf-analytics-scene"><div className="vf-analytics-head"><div><span className="vf-pill">▥ PREMIUM DASHBOARD</span><h3>АНАЛІТИКА</h3><p>Каса, прибуток, борги, майстри, пости, постачальники та витрати СТО</p><i>СТО　 30 ДНІВ · 2026-05-23 — 2026-06-21</i></div><div><span>ВИРУЧКА<b>0 ₴</b></span><span>ЧИСТИЙ ПРИБУТОК<b>0 ₴</b></span><span>БОРГИ<b className="red">760 ₴</b></span></div></div><div className="vf-analytics-range"><b>СЬОГОДНІ</b><span>7 ДНІВ</span><span className="active">30 ДНІВ</span><span>ЦЕЙ МІСЯЦЬ</span><span>МИНУЛИЙ</span><span>ВЕСЬ ЧАС</span></div><div className="vf-analytics-metrics"><span className="blue">ВИРУЧКА<b>0 ₴</b></span><span className="teal">ВАЛОВИЙ ПРИБУТОК<b>0 ₴</b></span><span className="green-card">ЧИСТИЙ ПРИБУТОК<b>0 ₴</b></span><span className="purple">МАЙСТРАМ<b>0 ₴</b></span><span className="red-card">ВИТРАТИ СТО<b>0 ₴</b></span><span className="orange">ЗАКРИТІ ВІЗИТИ<b>0</b></span></div><div className="vf-chart-panel"><header><b>▣ ДИНАМІКА</b><span>Виручка і чистий прибуток у вибраному періоді.</span></header><div className="vf-chart-bars">{bars.map((height, index) => <i key={index} style={{ '--h': `${height}%`, '--delay': `${index * 80}ms` }} />)}</div><aside><span>АКТИВНІ В РОБОТІ</span><b>1</b><span>ВОРОНКА / НЕЗАКРИТА СУМА</span><b>760 ₴</b></aside></div></div>;
}

function DemoFrame({ screenId, hero = false, onPointerMove, onPointerLeave }) {
  const scene = screenId === 'passport' ? <PassportScene />
    : screenId === 'client' ? <ClientScene />
      : screenId === 'inventory' ? <InventoryScene />
        : screenId === 'analytics' ? <AnalyticsScene />
          : <VisitsScene />;
  const active = screenId === 'visits' || screenId === 'passport' ? 'visits' : screenId;
  const label = DEMO_SCREENS.find((item) => item.id === screenId)?.label || 'Демо';
  return <div className={`vf-demo-frame ${hero ? 'vf-demo-hero-frame' : ''}`} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}><div className="vf-browser"><span><i /><i /><i /></span><b>VIN-matrix · {label}</b><em><i /> LIVE</em></div><div className="vf-app-shell"><AppSidebar active={active} /><div className="vf-app-main"><AppTopbar /><div className="vf-app-content" key={screenId}>{scene}</div></div></div></div>;
}

function AerialShowcase() {
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const ids = ['visits', 'passport', 'client', 'inventory', 'analytics'];
  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % ids.length), 7000);
    return () => window.clearInterval(timer);
  }, []);
  const move = (event) => {
    if (!ref.current || window.matchMedia('(max-width: 980px)').matches) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    ref.current.style.setProperty('--vf-rx', `${-y * 1.7}deg`);
    ref.current.style.setProperty('--vf-ry', `${x * 2.4}deg`);
  };
  const leave = () => { ref.current?.style.setProperty('--vf-rx', '0deg'); ref.current?.style.setProperty('--vf-ry', '0deg'); };
  return <div className="vf-aerial-stage" ref={ref}><div className="vf-aerial-meta"><span><i /> РЕАЛЬНИЙ РОБОЧИЙ СЦЕНАРІЙ</span><b>{DEMO_SCREENS.find((item) => item.id === ids[active])?.label}</b></div><DemoFrame screenId={ids[active]} hero onPointerMove={move} onPointerLeave={leave} /><div className="vf-aerial-tabs">{ids.map((id, index) => <button type="button" className={active === index ? 'active' : ''} onClick={() => setActive(index)} key={id}><small>0{index + 1}</small>{DEMO_SCREENS.find((item) => item.id === id)?.label}<i /></button>)}</div></div>;
}

function RegisterCta({ label = 'Створити акаунт' }) {
  return <a className="vf-register-cta" href="/register">{label} <ArrowRight size={16} /></a>;
}

export function FinalDemoTour() {
  useReveal();
  const [active, setActive] = useState(0);
  const current = DEMO_SCREENS[active];
  return <div className="vf-page vf-demo-page"><header className="vf-header"><a href="/landing"><Logo inverse /></a><nav><a href="/landing#features">Можливості</a><a href="/landing#tariff">Тариф</a></nav><div className="vf-header-actions"><a className="vf-login" href="/login">Увійти</a><RegisterCta label="Реєстрація" /></div></header><main className="vf-demo-main"><section className="vf-demo-intro" data-vf-reveal><span className="vf-eyebrow"><i /> ІНТЕРАКТИВНЕ ДЕМО</span><h1>Не презентація.<br /><em>Робочий процес.</em></h1><p>Перемикай екрани, які щодня бачить команда: від запису й техпаспорта до складу, документів та фінансової картини.</p></section><div className="vf-demo-tabs" data-vf-reveal>{DEMO_SCREENS.map((screen, index) => <button type="button" onClick={() => setActive(index)} key={screen.id} className={active === index ? 'active' : ''}><small>0{index + 1}</small><span>{screen.label}</span></button>)}</div><section className="vf-demo-frame-block" data-vf-reveal><DemoFrame screenId={current.id} /><div className="vf-demo-caption"><div><span>{current.eyebrow}</span><h2>{current.title}</h2><p>{current.text}</p></div><div><RegisterCta label="Почати 14 днів" /><a href="/login">Вже є акаунт? Увійти</a></div></div></section></main></div>;
}

export function FinalLanding() {
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [faq, setFaq] = useState(0);
  const year = useMemo(() => new Date().getFullYear(), []);
  return <div className="vf-page vf-landing"><header className="vf-header"><a href="/landing"><Logo inverse /></a><nav className={menuOpen ? 'open' : ''}><a href="#features">Можливості</a><a href="#demo">Демо</a><a href="#tariff">Тариф</a></nav><div className="vf-header-actions"><a className="vf-login" href="/login">Увійти</a><RegisterCta label="Реєстрація" /><button className="vf-menu" type="button" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button></div></header><main><section className="vf-hero" data-vf-reveal><div className="vf-hero-copy"><span className="vf-eyebrow"><i /> СИСТЕМА УПРАВЛІННЯ ДЛЯ АВТОБІЗНЕСУ</span><h1>Менше хаосу.<br /><em>Більше контролю.</em></h1><p>VIN-matrix збирає візити, клієнтів, склад, оплату, документи й команду в один робочий простір. Ти бачиш процес — а не шукаєш його по чатах.</p><div className="vf-hero-actions"><RegisterCta label="Почати безкоштовно" /><a className="vf-demo-link" href="/demo"><Play size={15} fill="currentColor" /> Подивитись демо</a></div><div className="vf-hero-note"><Check size={15} /> 14 днів повного доступу · без очікування запрошення</div></div><AerialShowcase /></section><section className="vf-business-strip" data-vf-reveal><span>СТО</span><i>•</i><span>ШИНОМОНТАЖ</span><i>•</i><span>МАГАЗИН ЗАПЧАСТИН</span><i>•</i><span>КЕРІВНИК</span><i>•</i><span>АДМІНІСТРАТОР</span></section><section id="features" className="vf-features" data-vf-reveal><div className="vf-section-copy"><span className="vf-eyebrow"><i /> СИСТЕМА, ЩО ТРИМАЄ ВЕСЬ ПРОЦЕС</span><h2>Від техпаспорта до виданого авто — без розривів у роботі.</h2><p>Найсильніші інструменти не існують окремо. Вони продовжують один одного в тому порядку, в якому реально працює сервіс.</p></div><div className="vf-feature-grid">{FEATURE_CARDS.map(({ number, icon: Icon, title, text, tag }, index) => <article style={{ '--d': `${index * 110}ms` }} key={number}><small>{number}</small><span><Icon size={21} /></span><em>{tag}</em><h3>{title}</h3><p>{text}</p><ArrowRight size={18} /></article>)}</div></section><section id="demo" className="vf-workflow" data-vf-reveal><div className="vf-workflow-copy"><span className="vf-eyebrow"><i /> НЕ СЛАЙДИ, А ЖИВИЙ СЦЕНАРІЙ</span><h2>Один візит проходить систему від початку до кінця.</h2><p>Клієнт записався → дані авто підтягнулися зі скану → майстер отримав роботу → запчастина зарезервована → створено документ → керівник бачить результат в аналітиці.</p><a href="/demo">Відкрити весь demo-tour <ArrowRight size={16} /></a></div><div className="vf-workflow-steps">{[['01','Запис','Дошка візитів'],['02','Скан','Техпаспорт і VIN'],['03','Робота','Майстер і запчастини'],['04','Видача','Оплата, акт, CRM']].map(([number, title, text], index) => <article style={{ '--i': index }} key={number}><small>{number}</small><b>{title}</b><span>{text}</span><i /></article>)}</div></section><section id="tariff" className="vf-tariff" data-vf-reveal><div className="vf-section-copy"><span className="vf-eyebrow"><i /> ЗРОЗУМІЛИЙ СТАРТ</span><h2>Один тариф. Усе основне для щоденної роботи.</h2><p>Створи акаунт, налаштуй свій бізнес і почни тестувати процес без очікування демо-доступу.</p><div className="vf-tariff-proof">✓ 14 днів безкоштовно · повний сценарій роботи</div></div><article className="vf-price-card"><header><Logo inverse /><span>СТАНДАРТ</span></header><div><small>від</small><strong>2 000</strong><span>грн / місяць</span></div><ul><li><Check size={15} /> Дошка візитів, CRM клієнтів та авто</li><li><Check size={15} /> Склад, резерви, закупки та маржа</li><li><Check size={15} /> Техпаспорт, документи, оплати</li><li><Check size={15} /> Аналітика, оновлення, підтримка</li></ul><RegisterCta label="Створити акаунт" /></article></section><section className="vf-final-cta" data-vf-reveal><div><span className="vf-eyebrow"><i /> ПОЧНИ ЗАРАЗ</span><h2>Створи свій робочий простір. Без запиту доступу.</h2><p>Після реєстрації проходиш коротке налаштування і заходиш у власний VIN-matrix.</p></div><div className="vf-final-actions"><RegisterCta label="Реєстрація" /><a href="/login">Вже маєш акаунт? Увійти <ArrowRight size={15} /></a></div></section><section className="vf-faq" data-vf-reveal><div className="vf-section-copy"><span className="vf-eyebrow"><i /> ПЕРЕД СТАРТОМ</span><h2>Відповіді без дрібного шрифту.</h2></div><div>{FAQS.map(([question, answer], index) => <button type="button" onClick={() => setFaq(faq === index ? -1 : index)} className={faq === index ? 'open' : ''} key={question}><div><b>{question}</b>{faq === index && <p>{answer}</p>}</div><ChevronRight size={18} /></button>)}</div></section></main><footer className="vf-footer"><Logo /><span>© {year} · Система управління для автобізнесу</span><div><a href="/login">Увійти</a><a href="/register">Реєстрація</a></div></footer></div>;
}

export default FinalLanding;