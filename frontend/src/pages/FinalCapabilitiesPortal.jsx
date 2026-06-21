import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Car,
  Check,
  ClipboardList,
  FileText,
  Package,
  PlugZap,
  Truck,
  Users,
} from 'lucide-react';
import './FinalReadability.css';
import './FinalCapabilities.css';

const groups = [
  {
    icon: ClipboardList,
    number: '01',
    title: 'Візити та сервіс',
    text: 'Робочий процес від запису клієнта до виданого авто.',
    items: [
      'Дошка візитів зі статусами та чергою',
      'Запис, пости, майстри й контроль навантаження',
      'Роботи, запчастини, резерв і рекомендації',
      'Наряд-замовлення та акт виконаних робіт',
      'Документи PDF і друк з картки візиту',
    ],
  },
  {
    icon: Users,
    number: '02',
    title: 'Клієнти та автомобілі',
    text: 'Повна історія клієнта й автомобіля без пошуку по чатах.',
    items: [
      'CRM-картка клієнта, авто та історія візитів',
      'Борги, нагадування й наступна дія менеджера',
      'Скан техпаспорта та заповнення даних авто',
      'VIN, номер авто, телефон і глобальний пошук',
      'Повторні звернення та сервісні рекомендації',
    ],
  },
  {
    icon: Package,
    number: '03',
    title: 'Склад і постачальники',
    text: 'Запаси, маржа, закупки й деталі під контролем.',
    items: [
      'Склад, резерви, доступна кількість і мінімальні залишки',
      'Прихід, списання, закупка, продаж і маржа',
      'Прайси постачальників: Excel та імпорт позицій',
      'API-підключення постачальників і замовлення деталей',
      'Замовлення постачальнику та контроль його статусу',
    ],
  },
  {
    icon: Truck,
    number: '04',
    title: 'Оплати, доставка й контроль',
    text: 'Фінансова картина й інтеграції в одному просторі.',
    items: [
      'Рахунок, чек оплати, акт і документи по замовленню',
      'Нова пошта: створення та контроль доставки через API',
      'Аналітика виручки, прибутку, боргів і навантаження',
      'Панель керівника, ролі команди та журнал активності',
      'Обмін даними й налаштування бізнес-процесів',
    ],
  },
];

function CapabilityCatalog() {
  return <section id="capabilities" className="vf-capabilities" data-vf-reveal>
    <div className="vf-capabilities-head">
      <span className="vf-eyebrow"><i /> ПОВНИЙ НАБІР ІНСТРУМЕНТІВ</span>
      <h2>Усе, що потрібно автобізнесу<br />для роботи в одній системі.</h2>
      <p>VIN-matrix не обмежується CRM. Це робоче місце для сервісу, магазину запчастин або змішаного бізнесу.</p>
      <div className="vf-capabilities-proof"><PlugZap size={15} /> Інтеграції, документи, склад і команда — без окремих таблиць</div>
    </div>
    <div className="vf-capability-grid">
      {groups.map(({ icon: Icon, number, title, text, items }) => <article key={number}>
        <header>
          <span>{number}</span>
          <i><Icon size={19} /></i>
        </header>
        <h3>{title}</h3>
        <p>{text}</p>
        <ul>{items.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul>
      </article>)}
    </div>
    <div className="vf-capabilities-bottom">
      <div><Car size={19} /><span><b>Працює як єдина система.</b> Картка автомобіля, візит, запчастина, документ, оплата й аналітика пов’язані між собою.</span></div>
      <a href="/register">Створити акаунт <BarChart3 size={15} /></a>
    </div>
  </section>;
}

export default function FinalCapabilitiesPortal() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const footer = document.querySelector('.vf-footer');
    if (!footer || !footer.parentElement) return undefined;
    let host = document.getElementById('vf-capabilities-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vf-capabilities-host';
      footer.parentElement.insertBefore(host, footer);
    }
    setTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  useEffect(() => {
    const scrollToSection = (id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleLandingLinkClick = (event) => {
      if (!(event.target instanceof Element)) return;

      const demoLink = event.target.closest('.vf-demo-link');
      if (demoLink) {
        event.preventDefault();
        scrollToSection('demo');
        return;
      }

      const capabilitiesLink = event.target.closest('.vf-header nav a[href="#features"]');
      if (capabilitiesLink) {
        event.preventDefault();
        scrollToSection('capabilities');
      }
    };

    document.addEventListener('click', handleLandingLinkClick);
    return () => document.removeEventListener('click', handleLandingLinkClick);
  }, []);

  return target ? createPortal(<CapabilityCatalog />, target) : null;
}
