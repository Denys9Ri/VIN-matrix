import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Layers3,
  LineChart,
  Package,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import './FinalMobileDemo.css';

const SCENES = [
  { id: 'visits', label: 'Дошка візитів', icon: ClipboardList },
  { id: 'passport', label: 'Скан техпаспорта', icon: FileText },
  { id: 'client', label: 'Картка клієнта', icon: UserRound },
  { id: 'inventory', label: 'Склад і закупки', icon: Package },
  { id: 'analytics', label: 'Аналітика', icon: LineChart },
];

function MobileTopbar() {
  return <header className="vfm-topbar">
    <div className="vfm-search"><Search size={15} /><span>Пошук: №, телефон, VIN...</span></div>
    <button type="button" aria-label="Сповіщення" className="vfm-bell"><Bell size={17} /><i>2</i></button>
    <strong>IA</strong>
  </header>;
}

function MobileBottom({ active }) {
  const items = [
    ['visits', Wrench, 'Візити'],
    ['search', Search, 'Пошук'],
    ['inventory', Box, 'Склад'],
    ['analytics', Layers3, 'Ще'],
  ];
  return <footer className="vfm-bottom">{items.map(([id, Icon, label]) => <span className={active === id || (active === 'passport' && id === 'visits') || (active === 'client' && id === 'analytics') ? 'active' : ''} key={id}><Icon size={17} /><b>{label}</b></span>)}</footer>;
}

function VisitsMobile() {
  return <main className="vfm-content vfm-visits">
    <section className="vfm-heading"><span><ClipboardList size={20} /></span><div><h3>Дошка візитів</h3><p>Записи, пости, майстри, роботи, запчастини й документи в одному робочому екрані.</p></div></section>
    <button type="button" className="vfm-primary">＋ НОВИЙ ВІЗИТ</button>
    <section className="vfm-toolbar"><div><Search size={15} /><span>Пошук: ID, номер авто, клієнт, телефон, VIN...</span></div><aside><button type="button"><ChevronLeft size={16} /></button><span><small>ДАТА ДОШКИ</small><b><CalendarDays size={13} /> сб, 20 червня</b></span><button type="button"><ChevronRight size={16} /></button></aside></section>
    <section className="vfm-board amber"><header><b>◷ В ЧЕРЗІ / ПІДБІР</b><i>1</i></header><article><small>КЛІЄНТ</small><h4>Демо клієнт <em>В ЧЕРЗІ</em></h4><p>🚗 DEMO-STO <span>(000001)</span></p><p>⌕ +380000000001</p><footer><b>◷ 10:19</b><span>ПОСТ: ДЕМО ПОСТ VIN-MATRIX</span></footer></article></section>
    <section className="vfm-board blue"><header><b>⚒ В РОБОТІ</b><i>0</i></header><div>ПУСТО</div></section>
    <section className="vfm-board green"><header><b>◉ ГОТОВО</b><i>0</i></header><div>ПУСТО</div></section>
  </main>;
}

function PassportMobile() {
  const fields = ['МАРКА', 'МОДЕЛЬ', 'РІК', 'ОБ’ЄМ СМ³', 'ПОТУЖНІСТЬ КВТ', 'КОД ДВИГУНА'];
  return <main className="vfm-content vfm-passport">
    <section className="vfm-passport-card"><header><span><Car size={20} /></span><div><h3>ТЕХПАСПОРТ</h3><p>Авто, VIN, двигун</p></div><small>СТО №33</small></header><article className="vfm-scan"><b><FileText size={18} /> Скан техпаспорта</b><button type="button">▣ СКАНУВАТИ</button></article><article className="vfm-fields"><header><b>ДАНІ АВТОМОБІЛЯ</b><span>ПЕРЕВІРЕНО ВРУЧНУ</span></header><div>{fields.map((field) => <label key={field}><small>{field}</small><i /></label>)}</div><label className="vfm-fuel"><small>ПАЛИВО</small><i /></label></article><article className="vfm-code"><small>ДЕРЖ. НОМЕР</small><b>DEMO-STO</b></article><article className="vfm-code"><small>VIN</small><b>DEMO000000000001</b></article><button type="button" className="vfm-primary">ЗБЕРЕГТИ ТЕХПАСПОРТ</button></section>
  </main>;
}

function ClientMobile() {
  return <main className="vfm-content vfm-client">
    <section className="vfm-client-hero"><span>КАРТКА КЛІЄНТА</span><h3>ДЕМО КЛІЄНТ <i>З БОРГОМ</i></h3><p>Є неоплачена сума по замовленнях</p><div className="vfm-contact-row"><b>⌕ +380000000001</b><b>☆ ID: 380000000001</b></div><div className="vfm-client-kpis"><span>ВІЗИТІВ<b>1</b></span><span>ВИРУЧКА<b>760 ₴</b></span><span>ПРИБУТОК<b className="good">580 ₴</b></span><span>БОРГ<b className="bad">760 ₴</b></span></div><div className="vfm-client-actions"><button type="button">☎ ПОДЗВОНИТИ</button><button type="button">◌ НАПИСАТИ</button><button type="button">▣ ЗАДАЧА</button><button type="button">⊕ ВІЗИТ</button></div><div className="vfm-debt"><b>△ Є НЕОПЛАЧЕНА СУМА</b><span>Клієнт автоматично в pipeline “З боргом”.</span><button type="button">▭ ЗАКРИТИ БОРГ</button></div></section>
    <nav className="vfm-subtabs"><b>◉ ОГЛЯД</b><span>⚒ СЕРВІС</span><span>◷ ВІЗИТИ</span><span>🚗 АВТО</span><span>▤ БОРГИ</span><span>▣ CRM</span></nav>
    <section className="vfm-white-card"><h4>КОРОТКИЙ ПРОФІЛЬ</h4><div className="vfm-mini-info"><span>ТЕЛЕФОН<b>+380000000001</b></span><span>ОСТАННІЙ ВІЗИТ<b>20 черв. 2026 р.</b></span></div></section>
    <section className="vfm-white-card"><h4>ОСТАННІ РОБОТИ</h4><article><b>⚒ Демо: заміна масла</b><small>№33 · 20 черв. 2026 р.</small><em>500 ₴</em></article></section>
  </main>;
}

function InventoryMobile() {
  const cards = [['◈', 'ПОЗИЦІЙ', '1'], ['▧', 'ДОЗАМОВИТИ', '0'], ['▤', 'СУМА ЗАКУПКИ', '0 ₴'], ['↗', 'ОЧІКУВ. ПРИБУТОК', '0 ₴'], ['◉', 'НЕЛІКВІД', '1'], ['△', 'БЕЗ ДНІВ ПРОДАЖУ', '0']];
  return <main className="vfm-content vfm-inventory"><section className="vfm-stock-hero"><span>▣ КОНТРОЛЬ ГРОШЕЙ СКЛАДУ</span><h3>СКЛАД І ЗАКУПКИ</h3><p>Тут видно що треба дозамовити, які гроші заморожені в неліквіді, де низька маржа і скільки потенційного прибутку лежить у складі.</p><div><article><small>ЗАКУПКА СКЛАДУ</small><b>1 440 ₴</b></article><article><small>ПРОДАЖ СКЛАДУ</small><b>2 080 ₴</b></article><article><small>ПОТЕНЦ. ПРИБУТОК</small><b className="good">640 ₴</b></article><article><small>ЗАМОРОЖЕНО</small><b className="bad">1 440 ₴</b></article></div></section><section className="vfm-stock-grid">{cards.map(([icon, label, value]) => <article key={label}><i>{icon}</i><small>{label}</small><b>{value}</b></article>)}</section><section className="vfm-stock-item"><span>АНАЛІТИКА СКЛАДУ</span><h4>НЕЛІКВІД І ЗАМОРОЖЕНІ ГРОШІ</h4><div className="vfm-stock-search"><Search size={15} /><span>Пошук по бренду, артикулу, назві...</span></div><article><h3>VIN-Matrix VM-DEMO-001</h3><p>Демо масляний фільтр</p><div><span>НА СКЛАДІ<b>8 шт</b></span><span>ДОСТУПНО<b className="good">8 шт</b></span><span>ЗАКУПКА<b>180 ₴</b></span><span>ПРОДАЖ<b>260 ₴</b></span></div></article></section></main>;
}

function AnalyticsMobile() {
  const cards = [['ВИРУЧКА', '0 ₴', 'blue'], ['ВАЛОВИЙ ПРИБУТОК', '0 ₴', 'teal'], ['ЧИСТИЙ ПРИБУТОК', '0 ₴', 'green'], ['МАЙСТРАМ', '0 ₴', 'purple'], ['ВИТРАТИ СТО', '0 ₴', 'red']];
  return <main className="vfm-content vfm-analytics"><section className="vfm-analytics-hero"><span>▥ PREMIUM DASHBOARD</span><h3>АНАЛІТИКА</h3><p>Каса, прибуток, борги, майстри, пости, постачальники та витрати СТО</p><div className="vfm-period"><b>СТО</b><b>30 ДНІВ · 2026-05-23 — 2026-06-21</b></div><div className="vfm-analytics-head-kpis"><span>ВИРУЧКА<b>0 ₴</b></span><span>ЧИСТИЙ ПРИБУТОК<b className="good">0 ₴</b></span><span>БОРГИ<b className="bad">760 ₴</b></span></div></section><nav className="vfm-range"><b>СЬОГОДНІ</b><span>7 ДНІВ</span><strong>30 ДНІВ</strong><span>ЦЕЙ МІСЯЦЬ</span><span>МИНУЛИЙ</span></nav><nav className="vfm-subtabs"><b>▥ ОГЛЯД</b><span>▤ ПОСТИ</span><span>◈ ПОСТАЧАЛЬНИКИ</span><span>$ ВИТРАТИ</span></nav><section className="vfm-analytics-cards">{cards.map(([label, value, theme]) => <article className={theme} key={label}><i>◈</i><small>{label}</small><b>{value}</b><span>{label === 'ВАЛОВИЙ ПРИБУТОК' ? 'Маржа 0%' : label === 'ЧИСТИЙ ПРИБУТОК' ? 'Після зарплат і витрат' : ''}</span></article>)}</section><section className="vfm-chart"><h4>▣ ДИНАМІКА</h4><p>Виручка і чистий прибуток у вибраному періоді.</p><div><i /><i /></div><span>20 JUN</span></section><section className="vfm-stats-list"><article><i>◷</i><span>АКТИВНІ В РОБОТІ<b>1</b></span></article><article><i>〽</i><span>ВОРОНКА / НЕЗАКРИТА СУМА<b>760 ₴</b></span></article></section></main>;
}

function MobileDemo() {
  const [active, setActive] = useState('visits');
  const Scene = useMemo(() => ({ visits: VisitsMobile, passport: PassportMobile, client: ClientMobile, inventory: InventoryMobile, analytics: AnalyticsMobile }[active]), [active]);
  return <section className="vfm-mobile-demo" aria-label="Мобільне демо VIN-matrix"><div className="vfm-demo-label"><span>МОБІЛЬНА ВЕРСІЯ</span><b>Система виглядає так само зручно, як у роботі команди.</b></div><nav className="vfm-scene-tabs">{SCENES.map(({ id, label, icon: Icon }, index) => <button type="button" key={id} onClick={() => setActive(id)} className={active === id ? 'active' : ''}><small>0{index + 1}</small><Icon size={14} /><span>{label}</span></button>)}</nav><div className="vfm-phone"><MobileTopbar /><Scene /><MobileBottom active={active} /></div></section>;
}

export default function FinalMobileDemoPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const block = document.querySelector('.vf-demo-frame-block');
    if (!block) return undefined;
    let host = document.getElementById('vfm-mobile-demo-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vfm-mobile-demo-host';
      block.appendChild(host);
    }
    setTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  return target ? createPortal(<MobileDemo />, target) : null;
}
