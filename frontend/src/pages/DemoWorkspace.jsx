import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, BellRing, Boxes, CalendarDays, CheckCircle2,
  ChevronRight, CircleDollarSign, ClipboardList, Gauge, PackageCheck,
  Search, Settings2, UsersRound, Wrench,
} from 'lucide-react';
import './DemoWorkspace.css';

const navigation = [
  ['dashboard', 'Огляд', Gauge],
  ['orders', 'Замовлення', Wrench],
  ['stock', 'Склад', Boxes],
  ['clients', 'Клієнти', UsersRound],
  ['finance', 'Фінанси', CircleDollarSign],
];

const orders = [
  { id: '0187', client: 'Олексій Мельник', car: 'Toyota Camry', plate: 'AX 4551 EP', status: 'В роботі', tone: 'live', amount: '8 640 ₴', time: '12:30' },
  { id: '0188', client: 'Ірина Кравець', car: 'Skoda Octavia', plate: 'KA 9832 AO', status: 'Очікує деталі', tone: 'wait', amount: '4 120 ₴', time: '13:10' },
  { id: '0189', client: 'Денис Коваль', car: 'BMW X5', plate: 'AA 7008 PK', status: 'Заплановано', tone: 'plan', amount: '12 980 ₴', time: '14:00' },
  { id: '0190', client: 'Марина Гордійчук', car: 'Volkswagen Tiguan', plate: 'AI 1165 KT', status: 'Діагностика', tone: 'check', amount: '2 350 ₴', time: '14:40' },
];

const parts = [
  ['MANN-FILTER', 'HU 719/7x', 'Фільтр масляний', '12 шт', '840 ₴', 'good'],
  ['BOSCH', '0 986 479 292', 'Колодки передні', '4 шт', '2 160 ₴', 'warn'],
  ['KYB', '334838', 'Амортизатор', '1 шт', '3 690 ₴', 'low'],
  ['NGK', '9723', 'Свічка запалювання', '24 шт', '410 ₴', 'good'],
];

const clients = [
  ['Олексій Мельник', '+380 67 110 20 34', 'Toyota Camry', '12 580 ₴', 'Постійний'],
  ['Ірина Кравець', '+380 50 887 92 11', 'Skoda Octavia', '8 940 ₴', 'Активний'],
  ['Денис Коваль', '+380 93 445 63 00', 'BMW X5', '28 100 ₴', 'VIP'],
  ['Марина Гордійчук', '+380 97 324 19 44', 'Volkswagen Tiguan', '5 720 ₴', 'Новий'],
];

function DemoMetric({ label, value, detail, tone }) {
  return <article className={`demo-metric demo-metric--${tone || 'plain'}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function DashboardPanel() {
  return <>
    <section className="demo-headline"><div><p>ЧЕТВЕР · 20 ЧЕРВНЯ</p><h1>Доброго дня, <em>Олексію.</em></h1><span>СТО «ПІВНІЧ» · 3 пости · 6 працівників онлайн</span></div><button type="button"><BellRing size={17} /> 3 потребують уваги</button></section>
    <section className="demo-metrics"><DemoMetric label="В роботі" value="08" detail="+2 за останню годину" tone="acid" /><DemoMetric label="Завантаження постів" value="74%" detail="2 вільні вікна після 17:00" tone="plain" /><DemoMetric label="Каса сьогодні" value="24 860 ₴" detail="6 оплат закрито" tone="orange" /><DemoMetric label="Маржа деталей" value="7 420 ₴" detail="середня 26%" tone="plain" /></section>
    <section className="demo-grid"><article className="demo-panel demo-panel--orders"><div className="demo-panel__top"><div><span>ПЛАН ЗМІНИ</span><h2>Пости сьогодні</h2></div><button type="button">Календар <CalendarDays size={15} /></button></div><div className="demo-timeline">{orders.slice(0, 3).map((order) => <div className="demo-timeline__item" key={order.id}><time>{order.time}</time><i className={`dot dot--${order.tone}`} /><div><strong>{order.car} <b>{order.plate}</b></strong><small>{order.client} · Замовлення #{order.id}</small></div><em>{order.status}</em></div>)}</div></article><article className="demo-panel demo-panel--chart"><div className="demo-panel__top"><div><span>ДИНАМІКА</span><h2>Виручка / 7 днів</h2></div><b className="demo-positive">+18.4%</b></div><div className="demo-wave"><svg viewBox="0 0 480 185" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="demoGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d8ff3e" stopOpacity=".65"/><stop offset="1" stopColor="#d8ff3e" stopOpacity="0"/></linearGradient></defs><path d="M0 150 C38 122, 48 152, 83 130 S135 94, 165 113 S203 70, 240 90 S288 116, 320 66 S365 83, 395 49 S445 34, 480 8 L480 185 L0 185 Z" fill="url(#demoGradient)"/><path d="M0 150 C38 122, 48 152, 83 130 S135 94, 165 113 S203 70, 240 90 S288 116, 320 66 S365 83, 395 49 S445 34, 480 8" fill="none" stroke="#d8ff3e" strokeWidth="4"/></svg><div><span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>НД</span></div></div></article></section>
  </>;
}

function OrdersPanel() { return <section className="demo-table-card"><div className="demo-table-title"><div><span>ЗАМОВЛЕННЯ</span><h2>Поточний потік</h2></div><button type="button">+ Створити замовлення</button></div><div className="demo-table demo-orders-table"><div className="demo-table__head"><span>Час</span><span>Клієнт / авто</span><span>Статус</span><span>Сума</span><span /></div>{orders.map((order) => <div className="demo-table__row" key={order.id}><span className="demo-time">{order.time}<small>#{order.id}</small></span><span><strong>{order.car}</strong><small>{order.client} · {order.plate}</small></span><span><i className={`demo-badge demo-badge--${order.tone}`}>{order.status}</i></span><strong>{order.amount}</strong><ChevronRight size={16} /></div>)}</div></section>; }
function StockPanel() { return <section className="demo-table-card"><div className="demo-table-title"><div><span>СКЛАД</span><h2>Залишки та резерви</h2></div><button type="button"><Search size={15} /> Знайти деталь</button></div><div className="demo-table demo-stock-table"><div className="demo-table__head"><span>Бренд / артикул</span><span>Позиція</span><span>Залишок</span><span>Продаж</span><span /></div>{parts.map(([brand, article, name, qty, price, tone]) => <div className="demo-table__row" key={article}><span><strong>{brand}</strong><small>{article}</small></span><span>{name}</span><span><i className={`stock-dot stock-dot--${tone}`} /> {qty}</span><strong>{price}</strong><ChevronRight size={16} /></div>)}</div></section>; }
function ClientsPanel() { return <section className="demo-table-card"><div className="demo-table-title"><div><span>CRM</span><h2>Клієнти, які повертаються</h2></div><button type="button">+ Новий клієнт</button></div><div className="demo-table demo-clients-table"><div className="demo-table__head"><span>Клієнт</span><span>Контакт</span><span>Останнє авто</span><span>Виручка</span><span>Сегмент</span></div>{clients.map(([name, phone, car, revenue, segment]) => <div className="demo-table__row" key={phone}><span><strong>{name}</strong></span><span>{phone}</span><span>{car}</span><strong>{revenue}</strong><span><i className="demo-client-tag">{segment}</i></span></div>)}</div></section>; }
function FinancePanel() { return <><section className="demo-finance-summary"><DemoMetric label="Виручка / місяць" value="438 200 ₴" detail="+14% до минулого місяця" tone="acid"/><DemoMetric label="Запчастини" value="183 410 ₴" detail="41.8% від обороту" tone="plain"/><DemoMetric label="Роботи" value="254 790 ₴" detail="58.2% від обороту" tone="orange"/></section><section className="demo-finance-strip"><div><span>НЕЗАКРИТІ ОПЛАТИ</span><strong>3</strong><p>На суму 7 880 ₴</p></div><div><span>ДО ВИПЛАТИ МАЙСТРАМ</span><strong>21 340 ₴</strong><p>За поточний період</p></div><div><span>НАЙКРАЩИЙ ДЕНЬ</span><strong>П’ятниця</strong><p>86 740 ₴ виручки</p></div></section></>; }

export default function DemoWorkspace() {
  const [active, setActive] = useState('dashboard');
  const [notice, setNotice] = useState('Демо-режим: дані змінювати не можна');
  const title = useMemo(() => navigation.find(([key]) => key === active)?.[1], [active]);
  const content = { dashboard: <DashboardPanel />, orders: <OrdersPanel />, stock: <StockPanel />, clients: <ClientsPanel />, finance: <FinancePanel /> }[active];

  return <main className="demo-shell"><div className="demo-topbar"><Link to="/landing" className="demo-back"><ArrowLeft size={16} /> На landing</Link><div className="demo-logo"><span>VIN</span> / MATRIX <b>DEMO</b></div><div className="demo-topbar__right"><span className="demo-live-dot" /> {notice}</div></div><div className="demo-layout"><aside className="demo-sidebar"><div className="demo-company"><span>СТО «ПІВНІЧ»</span><small>DEMO WORKSPACE</small></div><nav>{navigation.map(([key, label, Icon]) => <button type="button" onClick={() => { setActive(key); setNotice(`Відкрито: ${label}`); }} className={active === key ? 'is-active' : ''} key={key}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="demo-sidebar__foot"><Settings2 size={17} /><span>Налаштування</span></div></aside><section className="demo-stage"><div className="demo-stage__crumb"><span>ДЕМО-КАБІНЕТ</span><b>/</b><strong>{title}</strong></div>{content}<section className="demo-bottom-cta"><div><span>ЦЕ ЛИШЕ ДЕМО</span><h2>Хочеш побачити<br />свої дані в такому<br />порядку?</h2></div><div><p>Створи пробний простір. Під час реального старту дані й доступи налаштовуються окремо для твого бізнесу.</p><Link to="/register">Почати 14 днів <ChevronRight size={18} /></Link></div></section></section></div></main>;
}
