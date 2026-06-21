import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, BarChart3, Boxes, Check, ChevronDown,
  CircleDollarSign, Clock3, Gauge, LayoutDashboard, Menu, PackageCheck,
  Play, ShieldCheck, Sparkles, UsersRound, Wrench, X,
} from 'lucide-react';
import './MarketingLanding.css';

const workflow = [
  {
    id: '01',
    eyebrow: 'Прийом авто',
    title: 'Замовлення не губиться між дзвінком, майстром і складом.',
    text: 'Створюйте замовлення за хвилину, призначайте пост, механіка та контролюйте статус без дзвінків у месенджерах.',
    icon: Wrench,
  },
  {
    id: '02',
    eyebrow: 'Запчастини',
    title: 'Склад підказує, що є в наявності та де лежать гроші.',
    text: 'Резервуйте деталі, бачте маржу, рух товару й позиції, які варто замовити раніше, ніж вони стануть проблемою.',
    icon: PackageCheck,
  },
  {
    id: '03',
    eyebrow: 'Контроль',
    title: 'Керівник бачить день бізнесу одним поглядом.',
    text: 'Оплати, незакриті роботи, завантаження постів і активність команди — без зведень вручну наприкінці дня.',
    icon: Gauge,
  },
];

const proof = [
  ['12:30', 'Toyota Camry', 'Діагностика · Пост 02', 'В роботі'],
  ['13:10', 'Skoda Octavia', 'Гальмівна система · Пост 01', 'Очікує деталі'],
  ['14:00', 'BMW X5', 'ТО 90 000 км · Пост 03', 'Заплановано'],
];

const faq = [
  ['Чи підійде VIN-matrix невеликій СТО?', 'Так. Система розрахована і на майстерню з одним постом, і на команду з кількома майстрами та складом. Почати можна з базового потоку: замовлення, клієнти, роботи й оплати.'],
  ['Чи можна використовувати для магазину запчастин?', 'Так. Є окремий магазинний режим: пошук товару, замовлення, клієнти, резерви, прихід, складські залишки та маржа.'],
  ['Чи потрібно довго навчатися?', 'Ні. Демо показує реальні сценарії, а перший робочий процес можна налаштувати без технічної команди.'],
  ['Що входить у тариф?', 'Доступ до робочого простору, оновлення системи, базова підтримка та всі ключові модулі для операційної роботи СТО або магазину.'],
];

const Metric = ({ label, value, trend, tone = 'light' }) => (
  <div className={`marketing-metric marketing-metric--${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {trend && <small>{trend}</small>}
  </div>
);

function ProductConsole() {
  return (
    <div className="product-console" aria-label="Приклад робочого кабінету VIN-matrix">
      <div className="console-topline">
        <div className="console-brand"><span>VIN</span> / MATRIX</div>
        <div className="console-presence"><i /> Система онлайн</div>
      </div>
      <div className="console-body">
        <aside className="console-rail">
          <span className="console-rail__active"><LayoutDashboard size={17} /></span>
          <span><Wrench size={17} /></span>
          <span><Boxes size={17} /></span>
          <span><UsersRound size={17} /></span>
          <span><BarChart3 size={17} /></span>
        </aside>
        <section className="console-main">
          <div className="console-heading">
            <div><p>СЬОГОДНІ · 20 ЧЕРВНЯ</p><h3>Робочий контур</h3></div>
            <button type="button">+ Нове замовлення</button>
          </div>
          <div className="console-metrics">
            <Metric label="В роботі" value="08" trend="+2 за годину" />
            <Metric label="Очікує рішення" value="03" trend="Потрібна увага" tone="amber" />
            <Metric label="Каса дня" value="24 860 ₴" trend="закрито 6 оплат" tone="dark" />
          </div>
          <div className="console-split">
            <div className="console-orders">
              <div className="console-panel-head"><span>ПОТОК ЗАМОВЛЕНЬ</span><b>Дивитись все <ArrowRight size={13} /></b></div>
              {proof.map(([time, car, task, status]) => <div className="console-order" key={car}>
                <time>{time}</time><div><strong>{car}</strong><small>{task}</small></div><em>{status}</em>
              </div>)}
            </div>
            <div className="console-chart">
              <div className="console-panel-head"><span>ВИРУЧКА / 7 ДНІВ</span><b>+18%</b></div>
              <div className="chart-bars">
                {[36, 56, 44, 71, 62, 87, 76].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
              <div className="chart-axis"><span>ПН</span><span>СР</span><span>ПТ</span><span>НД</span></div>
            </div>
          </div>
        </section>
      </div>
      <div className="console-scanline" />
    </div>
  );
}

export default function MarketingLanding() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', business: 'sto', team: '1–3', message: '' });
  const [sent, setSent] = useState(false);

  const formSummary = useMemo(() => `VIN-matrix — заявка на демонстрацію\nІм’я: ${form.name}\nТелефон: ${form.phone}\nФормат: ${form.business === 'store' ? 'Магазин запчастин' : form.business === 'both' ? 'СТО + магазин' : 'СТО'}\nКоманда: ${form.team}\nКоментар: ${form.message || '—'}`, [form]);

  const scrollToLead = () => document.getElementById('lead')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleLead = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    localStorage.setItem('vin_matrix_marketing_lead_draft', JSON.stringify({ ...form, createdAt: new Date().toISOString() }));
    setSent(true);
  };

  return (
    <main className="marketing-shell">
      <div className="marketing-noise" aria-hidden="true" />
      <header className="marketing-nav">
        <Link to="/landing" className="marketing-logo" aria-label="VIN-matrix landing">
          <span>VIN</span><i />MATRIX
        </Link>
        <nav className={mobileOpen ? 'marketing-navlinks marketing-navlinks--open' : 'marketing-navlinks'}>
          <a href="#flow" onClick={() => setMobileOpen(false)}>Можливості</a>
          <a href="#product" onClick={() => setMobileOpen(false)}>Продукт</a>
          <a href="#price" onClick={() => setMobileOpen(false)}>Тариф</a>
          <a href="#faq" onClick={() => setMobileOpen(false)}>Відповіді</a>
        </nav>
        <div className="marketing-navactions">
          <Link to="/login" className="marketing-signin">Увійти</Link>
          <button type="button" className="marketing-button marketing-button--small" onClick={scrollToLead}>Запустити демо <ArrowUpRightIcon /></button>
          <button type="button" className="marketing-menu" aria-label="Відкрити меню" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X size={21} /> : <Menu size={22} />}</button>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="hero-index">12 / ПРОДУКТОВИЙ РЕЖИМ</div>
        <div className="hero-copy reveal-up">
          <p className="marketing-kicker"><Sparkles size={15} /> СТО, магазин запчастин або обидва напрями</p>
          <h1>Автобізнес<br /><em>без ручного</em><br />хаосу.</h1>
          <p className="hero-lede">VIN-matrix збирає замовлення, склад, клієнтів, документи та фінанси в один робочий контур — щоб команда рухалася швидше, а ти бачив бізнес цілком.</p>
          <div className="hero-actions">
            <button type="button" className="marketing-button" onClick={scrollToLead}>Отримати демо <ArrowDownRight size={18} /></button>
            <Link to="/demo" className="marketing-text-link"><span><Play size={15} fill="currentColor" /></span> Подивитись наживо</Link>
          </div>
          <div className="hero-trust"><ShieldCheck size={17} /> Без картки · 14 днів для тесту · Дані вашого бізнесу — окремо</div>
        </div>
        <div className="hero-visual reveal-up reveal-up--delay"><ProductConsole /></div>
        <div className="hero-sidecopy">ОПЕРАЦІЇ<br />СКЛАД<br />КОНТРОЛЬ</div>
      </section>

      <section className="marketing-proofband" aria-label="Ключові результати">
        <span>ПРИЙОМ → РОБОТА → СКЛАД → ОПЛАТА → АНАЛІТИКА</span>
        <span>ОДИН ПОТІК ДЛЯ ВСІЄЇ КОМАНДИ</span>
      </section>

      <section id="flow" className="marketing-flow section-frame">
        <div className="section-intro"><span>01 / РОБОЧИЙ ПОТІК</span><h2>Не ще один кабінет.<br />Твій порядок на день.</h2></div>
        <div className="flow-list">
          {workflow.map((item) => {
            const Icon = item.icon;
            return <article className="flow-card" key={item.id}>
              <div className="flow-card__number">{item.id}</div>
              <Icon size={22} strokeWidth={1.6} />
              <p>{item.eyebrow}</p><h3>{item.title}</h3><span>{item.text}</span>
            </article>;
          })}
        </div>
      </section>

      <section id="product" className="marketing-product section-frame">
        <div className="product-rail"><span>02 / ЖИВИЙ ПРОДУКТ</span><h2>Показуй команді<br />наступну дію, а не<br /><em>ще одну таблицю.</em></h2><Link to="/demo" className="marketing-text-link marketing-text-link--dark"><span><Play size={15} fill="currentColor" /></span> Відкрити demo-кабінет</Link></div>
        <div className="product-story">
          <div className="story-window"><div className="story-window__bar"><i /><i /><i /><b>Замовлення / №0187</b></div><div className="story-window__body"><div><small>КЛІЄНТ</small><strong>Олексій Мельник</strong><span>Toyota Camry · AX 4551 EP</span></div><div><small>СТАТУС</small><em>В роботі</em><span>Пост 02 · Майстер Андрій</span></div><div><small>ЗАПЧАСТИНИ</small><strong>3 з 4</strong><span>одна позиція в резерві</span></div><div className="story-progress"><span>Прийнято</span><span className="is-done">Діагностика</span><span className="is-current">Роботи</span><span>Оплата</span></div></div></div>
          <div className="story-caption"><span>Сценарій дня</span><p>Менеджер створив замовлення. Майстер бачить задачу. Склад уже знає, що потрібно зарезервувати. Керівник не питає “що там з машиною?” — він бачить це в системі.</p></div>
        </div>
      </section>

      <section className="marketing-modes section-frame">
        <div className="modes-grid"><article><span>СТО</span><h3>Пости, майстри, роботи й записи.</h3><p>Від прийому авто до закриття замовлення та документів для клієнта.</p><Wrench size={38} /></article><article><span>МАГАЗИН</span><h3>Товар, резерви, замовлення і маржа.</h3><p>Бачите рух запчастин і продаєте без “пошукаю в Excel”.</p><Boxes size={38} /></article><article className="modes-grid__signal"><CircleDollarSign size={30} /><strong>Один контур</strong><p>Коли СТО і магазин працюють разом — продажі та склад не розходяться в різні боки.</p></article></div>
      </section>

      <section id="price" className="marketing-price section-frame">
        <div className="price-top"><span>03 / ПРОСТИЙ СТАРТ</span><p>Один зрозумілий тариф. Без “плати за кожну кнопку”.</p></div>
        <div className="price-card">
          <div className="price-card__label">VIN-MATRIX / ПРО</div><h2>Все, що потрібно,<br />щоб <em>керувати</em> зміною.</h2><div className="price-value"><small>від</small><strong>2 000</strong><b>₴ / міс</b></div><p>Підсумкова вартість залежить від формату бізнесу та кількості робочих місць. На демо підкажемо конфігурацію без зайвого.</p><ul><li><Check size={17} /> Замовлення, клієнти та CRM</li><li><Check size={17} /> Склад, резерви та постачальники</li><li><Check size={17} /> Фінанси, документи та аналітика</li><li><Check size={17} /> Оновлення й базова підтримка</li></ul><button type="button" className="marketing-button marketing-button--light" onClick={scrollToLead}>Запросити демонстрацію <ArrowRight size={18} /></button></div>
      </section>

      <section id="lead" className="marketing-lead section-frame">
        <div className="lead-copy"><span>04 / ПОБАЧИТИ СВОЇМ БІЗНЕСОМ</span><h2>За 20 хвилин<br />покажемо твій<br /><em>майбутній порядок.</em></h2><p>Залиш контакти — підготуємо коротке демо під СТО, магазин або обидва напрями. Без презентацій на годину та без тиску.</p><div className="lead-points"><span><Clock3 size={18} /> Демо до 20 хвилин</span><span><UsersRound size={18} /> Для власника й команди</span><span><ShieldCheck size={18} /> Без картки та договору</span></div></div>
        <form className="lead-form" onSubmit={handleLead}>
          {sent ? <div className="lead-success"><Sparkles size={28} /><h3>Заявку збережено в цьому браузері.</h3><p>Наступним кроком підключимо її до CRM/Telegram у production-конфігурації. Поки що можеш одразу запустити пробний простір.</p><Link to="/register" className="marketing-button">Створити пробний простір <ArrowRight size={18} /></Link></div> : <>
            <div className="lead-form__heading"><span>ЗАЯВКА НА ДЕМО</span><b>Відповідаємо в робочий час</b></div>
            <label>Як тебе звати?<input required value={form.name} onChange={update('name')} placeholder="Ім’я та прізвище" /></label>
            <label>Номер для зв’язку<input required value={form.phone} onChange={update('phone')} placeholder="+380 __ ___ __ __" inputMode="tel" /></label>
            <div className="lead-form__grid"><label>Формат<select value={form.business} onChange={update('business')}><option value="sto">СТО</option><option value="store">Магазин запчастин</option><option value="both">СТО + магазин</option></select></label><label>Команда<select value={form.team} onChange={update('team')}><option>1–3</option><option>4–8</option><option>9–20</option><option>20+</option></select></label></div>
            <label>Що хочеш навести до ладу?<textarea value={form.message} onChange={update('message')} placeholder="Наприклад: склад, записи, контроль оплат…" /></label>
            <button className="marketing-button" type="submit">Надіслати заявку <ArrowDownRight size={18} /></button>
            <small>Натискаючи кнопку, ти погоджуєшся на зв’язок щодо VIN-matrix.</small>
          </>}
        </form>
      </section>

      <section id="faq" className="marketing-faq section-frame"><div><span>05 / БЕЗ ТУМАНУ</span><h2>Питання, які<br />логічно виникають<br />перед стартом.</h2></div><div className="faq-list">{faq.map(([question, answer], index) => <article key={question} className={activeFaq === index ? 'faq-item faq-item--open' : 'faq-item'}><button type="button" onClick={() => setActiveFaq(activeFaq === index ? -1 : index)}><span>{question}</span><ChevronDown size={20} /></button>{activeFaq === index && <p>{answer}</p>}</article>)}</div></section>

      <footer className="marketing-footer"><Link to="/landing" className="marketing-logo"><span>VIN</span><i />MATRIX</Link><p>Система управління автобізнесом.<br />Зроблено для роботи, а не для звітів.</p><div><Link to="/demo">Демо-кабінет</Link><Link to="/login">Увійти</Link><Link to="/register">Почати тест</Link></div></footer>
    </main>
  );
}

function ArrowUpRightIcon() { return <ArrowDownRight size={16} style={{ transform: 'rotate(180deg)' }} />; }
