import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Box, ClipboardList, LineChart, Package, Search, UserRound, Wrench } from 'lucide-react';
import './FinalMobileHeroPreview.css';

const scenes = [
  { id: 'visits', label: 'Дошка візитів', icon: ClipboardList },
  { id: 'client', label: 'Клієнти', icon: UserRound },
  { id: 'inventory', label: 'Склад', icon: Package },
  { id: 'analytics', label: 'Аналітика', icon: LineChart },
];

function PhoneTopbar() {
  return <header className="vfh-topbar">
    <div><Search size={14} /><span>Пошук: №, телефон, VIN...</span></div>
    <i><Bell size={16} /><b>2</b></i>
    <strong>IA</strong>
  </header>;
}

function VisitsScene() {
  return <section className="vfh-screen vfh-visits">
    <header><span><ClipboardList size={18} /></span><div><h3>Дошка візитів</h3><p>Записи, пости, майстри й роботи</p></div></header>
    <button type="button">＋ НОВИЙ ВІЗИТ</button>
    <div className="vfh-search-row"><Search size={13} /><span>Пошук: ID, номер авто, клієнт...</span></div>
    <div className="vfh-board amber"><header><b>◷ В ЧЕРЗІ / ПІДБІР</b><i>1</i></header><article><small>КЛІЄНТ</small><b>Демо клієнт</b><span>🚗 DEMO-STO　(000001)</span><em>◷ 10:19</em></article></div>
    <div className="vfh-board blue"><header><b>⚒ В РОБОТІ</b><i>0</i></header><span>ПУСТО</span></div>
  </section>;
}

function ClientScene() {
  return <section className="vfh-screen vfh-client">
    <section className="vfh-client-hero"><span>КАРТКА КЛІЄНТА</span><h3>ДЕМО КЛІЄНТ <i>З БОРГОМ</i></h3><p>Є неоплачена сума по замовленнях</p><div><b>ВІЗИТІВ<strong>1</strong></b><b>ВИРУЧКА<strong>760 ₴</strong></b><b>ПРИБУТОК<strong className="good">580 ₴</strong></b><b>БОРГ<strong className="bad">760 ₴</strong></b></div><button type="button">▭ ЗАКРИТИ БОРГ</button></section>
    <nav><b>◉ ОГЛЯД</b><span>⚒ СЕРВІС</span><span>◷ ВІЗИТИ</span></nav>
    <article className="vfh-white"><h4>КОРОТКИЙ ПРОФІЛЬ</h4><span>ТЕЛЕФОН <b>+380000000001</b></span><span>ОСТАННІЙ ВІЗИТ <b>20 черв. 2026</b></span></article>
  </section>;
}

function InventoryScene() {
  return <section className="vfh-screen vfh-inventory">
    <section className="vfh-stock-hero"><span>▣ КОНТРОЛЬ ГРОШЕЙ</span><h3>СКЛАД І ЗАКУПКИ</h3><p>Залишки, неліквід, маржа й дозамовлення.</p><div><b>ЗАКУПКА<strong>1 440 ₴</strong></b><b>ПРОДАЖ<strong>2 080 ₴</strong></b><b>ПРИБУТОК<strong className="good">640 ₴</strong></b><b>ЗАМОРОЖЕНО<strong className="bad">1 440 ₴</strong></b></div></section>
    <section className="vfh-stock-cards"><article><Box size={17} /><small>ПОЗИЦІЙ</small><b>1</b></article><article><Package size={17} /><small>ДОЗАМОВИТИ</small><b>0</b></article><article><LineChart size={17} /><small>ОЧІКУВ. ПРИБУТОК</small><b className="good">0 ₴</b></article><article><span>△</span><small>НЕЛІКВІД</small><b className="bad">1</b></article></section>
  </section>;
}

function AnalyticsScene() {
  return <section className="vfh-screen vfh-analytics">
    <section className="vfh-analytics-hero"><span>▥ PREMIUM DASHBOARD</span><h3>АНАЛІТИКА</h3><p>Каса, прибуток, борги та витрати СТО</p><div><b>ВИРУЧКА<strong>0 ₴</strong></b><b>ЧИСТИЙ ПРИБУТОК<strong className="good">0 ₴</strong></b><b>БОРГИ<strong className="bad">760 ₴</strong></b></div></section>
    <nav><b>СЬОГОДНІ</b><span>7 ДНІВ</span><strong>30 ДНІВ</strong></nav>
    <section className="vfh-analytics-cards"><article><small>ВИРУЧКА</small><b>0 ₴</b></article><article><small>ВАЛОВИЙ ПРИБУТОК</small><b>0 ₴</b></article><article><small>ЧИСТИЙ ПРИБУТОК</small><b>0 ₴</b></article></section>
  </section>;
}

function MobileHeroPreview() {
  const [active, setActive] = useState(0);
  const current = scenes[active];
  const Scene = [VisitsScene, ClientScene, InventoryScene, AnalyticsScene][active];

  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % scenes.length), 4700);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="vfh-preview" aria-label="Мобільний інтерфейс VIN-matrix">
    <div className="vfh-caption"><span><i /> МОБІЛЬНА ВЕРСІЯ СИСТЕМИ</span><b>{current.label}</b></div>
    <div className="vfh-phone"><PhoneTopbar /><div key={current.id} className="vfh-stage"><Scene /></div><footer>{scenes.map((scene, index) => <button type="button" key={scene.id} onClick={() => setActive(index)} className={active === index ? 'active' : ''}><scene.icon size={15} /><span>{scene.label}</span></button>)}</footer></div>
  </section>;
}

export default function FinalMobileHeroPreviewPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const hero = document.querySelector('.vf-hero');
    if (!hero) return undefined;
    let host = document.getElementById('vfh-mobile-hero-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vfh-mobile-hero-host';
      hero.appendChild(host);
    }
    setTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  return target ? createPortal(<MobileHeroPreview />, target) : null;
}
