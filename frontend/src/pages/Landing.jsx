import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Menu,
  Package,
  Phone,
  Play,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import api from '../api/axios';
import './Landing.css';

const orderRows = [
  { initials: 'АК', name: 'Андрій Коваль', car: 'Skoda Octavia A7', plate: 'AA 2481 KT', status: 'Діагностика', statusClass: 'diagnostic' },
  { initials: 'ІМ', name: 'Ірина Марченко', car: 'Toyota RAV4', plate: 'KA 7304 HC', status: 'Запчастини', statusClass: 'parts' },
  { initials: 'СД', name: 'Сергій Дяченко', car: 'BMW X5', plate: 'AI 9108 MM', status: 'Готово', statusClass: 'ready' },
];

const features = [
  { icon: ClipboardList, number: '01', title: 'Замовлення в одному місці', text: 'Авто, клієнт, роботи, запчастини, оплата, документи та відповідальний майстер — в одному сценарії.' },
  { icon: Package, number: '02', title: 'Склад без сюрпризів', text: 'Резерви, прихід, списання й маржа видно до того, як менеджер пообіцяє деталь, якої немає.' },
  { icon: BarChart3, number: '03', title: 'Картина для керівника', text: 'Дивись на гроші, навантаження, борги й результат команди без ручних зведень у таблицях.' },
];

const demoScreens = [
  { label: 'Замовлення', title: 'Від заявки до видачі авто', text: 'Статус роботи, запчастини, гроші й документи не розлітаються між чатами.', accent: 'order' },
  { label: 'Склад', title: 'Запчастини під контролем', text: 'Знаєш, що є в наявності, що зарезервовано і на чому заробляєш.', accent: 'stock' },
  { label: 'Аналітика', title: 'Дані, за якими можна діяти', text: 'Не просто цифри за місяць, а точки, де ти втрачаєш час або маржу.', accent: 'analytics' },
];

const faqs = [
  ['Кому підійде VIN-matrix?', 'СТО, шиномонтажу, магазину запчастин або змішаному бізнесу, де вже не вистачає Viber, Excel і пам’яті адміністратора.'],
  ['Що я побачу в демо?', 'Реальний сценарій роботи: замовлення, клієнтів, склад, запчастини, оплати та управлінські показники.'],
  ['Що входить у тариф?', 'Замовлення, CRM, склад, документи, оплати, аналітика, оновлення та підтримка. Без прихованих модулів у базовому сценарії.'],
];

function ProductPreview({ compact = false, activeScreen = 0 }) {
  const screen = demoScreens[activeScreen] || demoScreens[0];
  return <div className={`landing-product ${compact ? 'landing-product-compact' : ''}`}>
    <div className="landing-window-bar">
      <div className="landing-window-dots"><i /><i /><i /></div>
      <span>VIN-matrix · {screen.label}</span>
      <div className="landing-window-user">AG</div>
    </div>
    <div className="landing-workspace">
      <aside className="landing-side-nav">
        <div className="landing-side-logo">V<span>/</span></div>
        <span className="active" /><span /><span /><span /><span />
        <div className="landing-side-bottom">?</div>
      </aside>
      <section className="landing-workspace-main">
        <header className="landing-workspace-header">
          <div><small>{screen.label} · Apex Garage</small><h3>{screen.title}</h3></div>
          <button type="button">+ Створити</button>
        </header>
        <div className="landing-kpi-row">
          <article><span>В роботі</span><strong>08</strong><em>2 нових сьогодні</em></article>
          <article><span>План на сьогодні</span><strong>₴ 64 810</strong><em>72% виконано</em></article>
          <article><span>Маржа місяця</span><strong>₴ 184 260</strong><em className="positive">+18.4%</em></article>
        </div>
        <div className={`landing-workspace-panel ${screen.accent}`}>
          <div className="landing-panel-heading"><div><b>{activeScreen === 0 ? 'Активні замовлення' : activeScreen === 1 ? 'Склад і резерви' : 'Результат за місяць'}</b><span>{screen.text}</span></div><a href="/demo">Відкрити <ChevronRight size={15} /></a></div>
          {activeScreen === 0 && <div className="landing-order-list">{orderRows.map((row) => <div className="landing-order-row" key={row.plate}><div className="landing-avatar">{row.initials}</div><div><b>{row.car}</b><span>{row.name} · {row.plate}</span></div><em className={row.statusClass}>{row.status}</em><ChevronRight size={16} /></div>)}</div>}
          {activeScreen === 1 && <div className="landing-stock-list"><div><span>Фільтр масляний</span><b>MANN W 712/95</b><em>7 шт.</em></div><div><span>Колодки передні</span><b>BOSCH 0 986 494 526</b><em className="warn">2 у резерві</em></div><div><span>Моторна олива 5W-30</span><b>MOBIL 152053</b><em>9 шт.</em></div></div>}
          {activeScreen === 2 && <div className="landing-chart-wrap"><div className="landing-chart-bars"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="landing-chart-note"><span>Середній чек</span><b>₴ 4 870</b><em>за 30 днів</em></div></div>}
        </div>
      </section>
    </div>
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

  if (sent) return <div className="landing-form-success"><div className="landing-success-mark"><Check size={22} /></div><h3>Заявку надіслано</h3><p>Ми зв’яжемося, щоб показати VIN-matrix на твоєму сценарії. А базове демо вже можна відкрити прямо зараз.</p><a href="/demo">Відкрити демо <ArrowRight size={17} /></a></div>;

  return <form className="landing-lead-form" onSubmit={submit}>
    <label><span>Ім’я</span><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Як до тебе звертатись" /></label>
    <label><span>Телефон</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+38 (0__) ___ __ __" inputMode="tel" /></label>
    <div className="landing-form-pair">
      <label><span>Тип бізнесу</span><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>СТО</option><option>Магазин запчастин</option><option>СТО + магазин</option><option>Шиномонтаж</option></select></label>
      <label><span>Команда</span><select value={form.team} onChange={(event) => update('team', event.target.value)}><option>1–3</option><option>4–10</option><option>11+</option></select></label>
    </div>
    {error && <p className="landing-form-error">{error}</p>}
    <button type="submit" disabled={sending}>{sending ? 'Надсилаємо…' : 'Записатися на показ'} <ArrowRight size={17} /></button>
    <small>Заявка — для персонального показу. Публічне демо доступне без очікування.</small>
  </form>;
}

export function DemoTour() {
  const [active, setActive] = useState(0);
  return <div className="landing-demo-page">
    <header className="landing-demo-header"><a href="/landing" className="landing-brand">VIN<span>/</span>MATRIX</a><a href="/landing#request">Записатися на показ <ArrowRight size={16} /></a></header>
    <main className="landing-demo-main">
      <div className="landing-demo-intro"><p>ІНТЕРАКТИВНЕ ДЕМО</p><h1>Подивись, як виглядає порядок у роботі.</h1><span>Це навчальний сценарій. Тут можна спокійно подивитися логіку системи до персонального показу.</span></div>
      <div className="landing-demo-tabs">{demoScreens.map((screen, index) => <button type="button" key={screen.label} onClick={() => setActive(index)} className={active === index ? 'active' : ''}><small>0{index + 1}</small>{screen.label}</button>)}</div>
      <ProductPreview activeScreen={active} />
      <div className="landing-demo-bottom"><div><b>{demoScreens[active].title}</b><span>{demoScreens[active].text}</span></div><a href="/landing#request">Хочу показ для свого бізнесу <ArrowRight size={17} /></a></div>
    </main>
  </div>;
}

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return <div className="landing-page">
    <nav className="landing-nav">
      <a className="landing-brand" href="/landing">VIN<span>/</span>MATRIX</a>
      <div className={`landing-nav-links ${menuOpen ? 'open' : ''}`}><a href="#product">Можливості</a><a href="#tariff">Тариф</a><a href="#request">Показ</a><a href="/login">Увійти</a></div>
      <div className="landing-nav-actions"><a href="/demo">Відкрити демо <ArrowRight size={16} /></a><button type="button" aria-label="Відкрити меню" onClick={() => setMenuOpen((state) => !state)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
    </nav>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><i /> СИСТЕМА УПРАВЛІННЯ ДЛЯ АВТОБІЗНЕСУ</p>
          <h1>Менше хаосу.<br /><em>Більше контролю.</em></h1>
          <p className="landing-hero-description">VIN-matrix збирає замовлення, склад, клієнтів, оплату й команду в один робочий простір. Ти бачиш процес, а не шукаєш його по чатах.</p>
          <div className="landing-hero-actions"><a className="primary" href="/demo"><Play size={16} fill="currentColor" /> Відкрити демо</a><a className="secondary" href="#request">Записатися на показ <ArrowRight size={16} /></a></div>
          <div className="landing-hero-note"><ShieldCheck size={18} /><span>Без реальних клієнтів, оплат і підключених інтеграцій у демо.</span></div>
        </div>
        <div className="landing-hero-product"><div className="landing-hero-caption"><span>ОПЕРАЦІЙНИЙ ЕКРАН</span><b>Усе, що відбувається сьогодні</b></div><ProductPreview /></div>
      </section>

      <section className="landing-strip"><span>СТО</span><i>•</i><span>МАГАЗИН ЗАПЧАСТИН</span><i>•</i><span>ШИНОМОНТАЖ</span><i>•</i><span>КЕРІВНИК</span><i>•</i><span>АДМІНІСТРАТОР</span></section>

      <section id="product" className="landing-features">
        <div className="landing-section-heading"><p>НЕ ЩЕ ОДНА CRM</p><h2>Від першого дзвінка до виданого авто — без розривів у процесі.</h2></div>
        <div className="landing-feature-list">{features.map(({ icon: Icon, number, title, text }) => <article key={number}><div className="landing-feature-number">{number}</div><div className="landing-feature-icon"><Icon size={22} /></div><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="landing-showcase"><div className="landing-showcase-copy"><p>НЕ “ПОДИВІТЬСЯ НА НАШІ ФУНКЦІЇ”</p><h2>Покажи людині її робочий день у системі.</h2><p>У демо є не порожній шаблон, а зрозумілий сценарій: прийняли авто, додали роботи, зарезервували деталі, отримали оплату, подивилися результат.</p><a href="/demo">Переглянути демо-сценарій <ArrowRight size={17} /></a></div><div className="landing-showcase-steps"><div><span>1</span><b>Новий запис</b><em>Клієнт і авто</em></div><div><span>2</span><b>Робота</b><em>Майстер і послуги</em></div><div><span>3</span><b>Запчастини</b><em>Резерв і маржа</em></div><div><span>4</span><b>Видача</b><em>Оплата й документ</em></div></div></section>

      <section id="tariff" className="landing-pricing"><div className="landing-section-heading"><p>ЗРОЗУМІЛИЙ СТАРТ</p><h2>Один тариф, у якому є основне для щоденної роботи.</h2></div><article className="landing-price-card"><div className="landing-price-card-top"><span>VIN-matrix</span><small>Стандарт</small></div><div className="landing-price"><small>від</small><strong>2 000</strong><span>грн / місяць</span></div><ul><li><Check size={16} /> Замовлення, клієнти та авто</li><li><Check size={16} /> Склад, резерви та маржа</li><li><Check size={16} /> Документи, оплати, аналітика</li><li><Check size={16} /> Оновлення й підтримка</li></ul><a href="#request">Записатися на показ <ArrowRight size={17} /></a></article></section>

      <section id="request" className="landing-request"><div className="landing-request-copy"><p>ПЕРСОНАЛЬНИЙ ПОКАЗ</p><h2>Не вибирай систему навмання.</h2><p>Залиш контакти — покажемо VIN-matrix саме на тому, що важливо для твого бізнесу: замовлення, склад, команда або фінанси.</p><div><Phone size={18} /><span>А публічне демо можна відкрити одразу — без форми.</span></div><a href="/demo">Відкрити демо зараз <ArrowRight size={16} /></a></div><LeadForm /></section>

      <section className="landing-faq"><div className="landing-section-heading"><p>ПЕРЕД СТАРТОМ</p><h2>Відповіді без дрібного шрифту.</h2></div><div>{faqs.map(([question, answer], index) => <button type="button" key={question} onClick={() => setActiveFaq(activeFaq === index ? -1 : index)} className={activeFaq === index ? 'open' : ''}><div><strong>{question}</strong>{activeFaq === index && <p>{answer}</p>}</div><ChevronRight size={18} /></button>)}</div></section>
    </main>

    <footer className="landing-footer"><a className="landing-brand" href="/landing">VIN<span>/</span>MATRIX</a><span>© {currentYear} · Система управління для автобізнесу</span><a href="/login">Увійти <ArrowRight size={15} /></a></footer>
  </div>;
}

export default function LandingRoute() { return <Landing />; }
