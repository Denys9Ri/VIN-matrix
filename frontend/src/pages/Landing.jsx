import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, PlayCircle, ClipboardCheck, Gauge, Layers3, Menu, PackageCheck, ShieldCheck, Sparkles, Wrench, X } from 'lucide-react';
import './Landing.css';

const demoRows = [
  { client: 'Андрій Коваль', car: 'Skoda Octavia A7', plate: 'AA 2481 KT', state: 'Діагностика', tone: 'amber' },
  { client: 'Ірина Марченко', car: 'Toyota RAV4', plate: 'KA 7304 HC', state: 'Запчастини в резерві', tone: 'cyan' },
  { client: 'Сергій Дяченко', car: 'BMW X5', plate: 'AI 9108 MM', state: 'Готово до видачі', tone: 'lime' },
];

const workflows = [
  { number: '01', icon: ClipboardCheck, title: 'Прийняли авто — нічого не загубили', text: 'Замовлення, клієнт, авто, роботи, запчастини, оплата та документи живуть в одному сценарії.' },
  { number: '02', icon: PackageCheck, title: 'Склад не бреше', text: 'Резерви, прихід, списання й маржа видно до того, як товар “раптом” закінчився.' },
  { number: '03', icon: Gauge, title: 'Керівник бачить бізнес, а не шум', text: 'Жива картина по грошах, завантаженню, боргах, замовленнях і діях команди.' },
];

const faqs = [
  ['Для кого VIN-matrix?', 'Для СТО, шиномонтажу та магазинів запчастин, де замовлення, склад і клієнти вже не поміщаються у Viber, Excel та пам’ять адміністратора.'],
  ['Що входить у тариф?', 'Робочі місця команди, замовлення, склад, CRM, документи, аналітика, оновлення та підтримка.'],
  ['Чи можна спочатку подивитись?', 'Так. На сторінці є інтерактивне демо, а після заявки підготуємо доступ до демо-кабінету з навчальними даними.'],
];

function DashboardPreview() {
  return (
    <div className="vm-preview" aria-label="Демонстрація інтерфейсу VIN-matrix">
      <div className="vm-preview-noise" />
      <aside className="vm-preview-rail">
        <div className="vm-preview-mark">V/</div>
        <span className="vm-preview-rail-dot active" />
        <span className="vm-preview-rail-dot" />
        <span className="vm-preview-rail-dot" />
        <span className="vm-preview-rail-dot" />
      </aside>
      <section className="vm-preview-content">
        <div className="vm-preview-topline">
          <div><span className="vm-preview-eyebrow">операційний екран</span><strong>Сьогодні в роботі</strong></div>
          <div className="vm-preview-live"><i /> Онлайн · 14:32</div>
        </div>
        <div className="vm-preview-kpis">
          <div><span>В роботі</span><b>08</b><em>+2 за годину</em></div>
          <div><span>На суму</span><b>₴ 64 810</b><em>сьогодні</em></div>
          <div><span>Склад</span><b>93.4%</b><em>у нормі</em></div>
        </div>
        <div className="vm-preview-workboard">
          <div className="vm-preview-board-head"><span>Замовлення</span><button type="button">+ нове</button></div>
          {demoRows.map((row) => <div className="vm-preview-row" key={row.plate}>
            <div className="vm-avatar">{row.client.slice(0, 1)}</div>
            <div className="vm-preview-car"><b>{row.car}</b><span>{row.client} · {row.plate}</span></div>
            <span className={`vm-status ${row.tone}`}>{row.state}</span>
            <ChevronRight size={17} />
          </div>)}
        </div>
        <div className="vm-preview-sidecard"><span>Місячна маржа</span><b>₴ 184 260</b><div className="vm-chart"><i /><i /><i /><i /><i /><i /><i /></div></div>
      </section>
    </div>
  );
}

function LeadForm() {
  const [form, setForm] = useState({ name: '', phone: '', type: 'СТО', team: '1–3' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const update = (key, value) => setForm((state) => ({ ...state, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setError('Залиш ім’я та номер телефону — цього достатньо, щоб почати.'); return; }
    setSending(true); setError('');
    try {
      const response = await fetch('/api/landing/leads/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error('request failed');
      setSent(true);
    } catch {
      setError('Форма ще не підключена до сервера. Збережи контакт і передай його менеджеру після deploy backend.');
    } finally { setSending(false); }
  };

  if (sent) return <div className="vm-lead-success"><Sparkles size={28} /><h3>Заявку прийнято</h3><p>Підготуємо демо під твій тип бізнесу та покажемо систему на живому сценарії.</p></div>;

  return <form className="vm-lead-form" onSubmit={submit}>
    <label><span>Як до тебе звертатись</span><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ім’я" /></label>
    <label><span>Телефон</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+38 (0__) ___ __ __" inputMode="tel" /></label>
    <div className="vm-lead-split">
      <label><span>Бізнес</span><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>СТО</option><option>Магазин запчастин</option><option>СТО + магазин</option><option>Шиномонтаж</option></select></label>
      <label><span>Команда</span><select value={form.team} onChange={(event) => update('team', event.target.value)}><option>1–3</option><option>4–10</option><option>11+</option></select></label>
    </div>
    {error && <p className="vm-lead-error">{error}</p>}
    <button className="vm-cta vm-cta-primary vm-lead-submit" type="submit" disabled={sending}>{sending ? 'Надсилаємо…' : 'Отримати демо-доступ'}<ArrowUpRight size={18} /></button>
    <small>Без спаму. Спочатку покажемо, як VIN-matrix лягає на твій робочий день.</small>
  </form>;
}

function DemoTour() {
  const [active, setActive] = useState(0);
  const slides = [
    ['Замовлення', 'Клієнт, автомобіль, статус, механік, запчастини та оплата — в одному екрані.'],
    ['Склад', 'Ти бачиш резерви та маржу раніше, ніж менеджер пообіцяє деталь, якої немає.'],
    ['Аналітика', 'Система не просто зберігає дії. Вона показує, де втрачаються гроші та час.'],
  ];
  return <section className="vm-demo-page"><div className="vm-demo-grid" /><header><a href="/landing" className="vm-wordmark">VIN<span>/</span>matrix</a><a className="vm-demo-login" href="/login">Увійти в систему <ArrowUpRight size={15} /></a></header><main><p className="vm-kicker">ІНТЕРАКТИВНЕ ДЕМО</p><h1>Побач, що відбувається <em>після</em> хаосу.</h1><div className="vm-demo-layout"><div className="vm-demo-nav">{slides.map(([title], index) => <button type="button" key={title} onClick={() => setActive(index)} className={index === active ? 'active' : ''}><span>0{index + 1}</span>{title}</button>)}</div><div className="vm-demo-stage"><DashboardPreview /><div className="vm-demo-copy"><span>0{active + 1} / 03</span><h2>{slides[active][0]}</h2><p>{slides[active][1]}</p><a href="#request">Хочу такий робочий простір <ArrowDownRight size={18} /></a></div></div></div></main></section>;
}

export function Landing() {
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(0);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  return <div className="vm-landing">
    <div className="vm-grid-surface" />
    <nav className="vm-nav"><a className="vm-wordmark" href="/landing">VIN<span>/</span>matrix</a><div className={`vm-nav-links ${menu ? 'open' : ''}`}><a href="#workflows">Можливості</a><a href="#tariff">Тариф</a><a href="#request">Демо</a><a href="/login">Увійти</a></div><button type="button" aria-label="Меню" className="vm-menu" onClick={() => setMenu((state) => !state)}>{menu ? <X /> : <Menu />}</button><a href="#request" className="vm-nav-cta">Запустити демо <ArrowUpRight size={16} /></a></nav>
    <main>
      <section className="vm-hero"><div className="vm-hero-copy"><p className="vm-kicker">ОПЕРАЦІЙНА СИСТЕМА ДЛЯ АВТОБІЗНЕСУ</p><h1>Менше “де це?”, більше <em>“готово”</em>.</h1><p className="vm-hero-text">VIN-matrix збирає замовлення, склад, клієнтів, оплату та команду в один робочий контур — без Excel, хаосу в чатах і втрат на деталях.</p><div className="vm-hero-actions"><a className="vm-cta vm-cta-primary" href="#request">Отримати демо <ArrowUpRight size={18} /></a><a className="vm-cta vm-cta-quiet" href="/demo"><PlayCircle size={18} /> Подивитись у дії</a></div><div className="vm-hero-proof"><div><b>01</b><span>екран<br />контролю</span></div><div><b>14</b><span>днів<br />на старт</span></div><div><b>∞</b><span>порядку<br />в процесах</span></div></div></div><div className="vm-hero-product"><div className="vm-orbit vm-orbit-a" /><div className="vm-orbit vm-orbit-b" /><DashboardPreview /><div className="vm-stamp"><span>СТВОРЕНО ДЛЯ</span><b>СТО · СКЛАД · CRM</b></div></div></section>
      <section className="vm-marquee"><div>СТО <i>✳</i> МАГАЗИН ЗАПЧАСТИН <i>✳</i> ШИНОМОНТАЖ <i>✳</i> КЕРІВНИК <i>✳</i> МАЙСТЕР <i>✳</i> АДМІНІСТРАТОР <i>✳</i></div></section>
      <section id="workflows" className="vm-workflows"><div className="vm-section-side"><p className="vm-kicker">НЕ ЩЕ ОДНА CRM</p><h2>Робочий день без сліпих зон.</h2><p>Ти не купуєш десяток окремих програм. Ти отримуєш один зрозумілий маршрут: від першого дзвінка до оплати та повторного візиту.</p></div><div className="vm-flow-list">{workflows.map(({ number, icon: Icon, title, text }) => <article key={number} className="vm-flow"><span className="vm-flow-no">{number}</span><Icon size={27} /><div><h3>{title}</h3><p>{text}</p></div><ArrowDownRight className="vm-flow-arrow" size={22} /></article>)}</div></section>
      <section className="vm-proof-panel"><div className="vm-proof-copy"><p className="vm-kicker">ДЕМО НЕ ПОВИННО БУТИ СЛАЙДАМИ</p><h2>Покажи бізнесу його завтрашній робочий день.</h2><p>У демо — не порожній кабінет. Там є замовлення, клієнти, запчастини, оплати й задачі. Можна натискати, дивитися логіку та ставити незручні питання.</p><a className="vm-text-link" href="/demo">Відкрити інтерактивний тур <ArrowUpRight size={17} /></a></div><div className="vm-proof-numbers"><div><span>08</span><b>замовлень у роботі</b></div><div><span>36</span><b>позицій у резерві</b></div><div><span>₴184k</span><b>маржа за місяць</b></div></div></section>
      <section id="tariff" className="vm-tariff"><div className="vm-tariff-intro"><p className="vm-kicker">ОДИН ТАРИФ. БЕЗ ДРІБНОГО ШРИФТУ</p><h2>Все потрібне, щоб працювати системно.</h2><p>Стартуй з того, що реально впливає на гроші та швидкість команди. Розширення — коли бізнес до них доріс.</p></div><div className="vm-tariff-ticket"><div className="vm-ticket-top"><span>VIN-matrix / standard</span><b>01</b></div><div className="vm-price"><small>від</small><strong>₴ 2 000</strong><span>/ місяць</span></div><ul><li><Check size={16} /> Замовлення, клієнти й авто</li><li><Check size={16} /> Склад, резерви й маржа</li><li><Check size={16} /> Документи, оплати й аналітика</li><li><Check size={16} /> Оновлення та підтримка</li></ul><a href="#request" className="vm-cta vm-cta-primary">Запустити 14 днів <ArrowUpRight size={18} /></a></div></section>
      <section id="request" className="vm-request"><div className="vm-request-copy"><p className="vm-kicker">НЕ ПІДБИРАЙ CRM НАОСЛІП</p><h2>Покажемо VIN-matrix на твоєму сценарії.</h2><p>Відповіси на чотири короткі питання — і ми підготуємо демо не “про все”, а про твої замовлення, склад і команду.</p><div className="vm-request-note"><ShieldCheck size={20} /><span>Демо-кабінет працює на навчальних даних. Реальні клієнти й фінанси не зачіпаються.</span></div></div><LeadForm /></section>
      <section className="vm-faq"><p className="vm-kicker">ПЕРЕД СТАРТОМ</p><h2>Коротко про важливе.</h2><div className="vm-faq-list">{faqs.map(([question, answer], index) => <button className={faq === index ? 'open' : ''} type="button" onClick={() => setFaq(index)} key={question}><span>{question}</span><ChevronRight size={20} /><p>{faq === index ? answer : ''}</p></button>)}</div></section>
    </main>
    <footer className="vm-footer"><a className="vm-wordmark" href="/landing">VIN<span>/</span>matrix</a><span>© {currentYear} · Операційна система для автобізнесу</span><a href="/login">Увійти в систему <ArrowUpRight size={15} /></a></footer>
  </div>;
}

export default function LandingRoute() { return <Landing />; }
export { DemoTour };