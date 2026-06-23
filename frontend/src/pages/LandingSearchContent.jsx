import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, Wrench } from 'lucide-react';
import './LandingSearchContent.css';

const audiences = [
  {
    title: 'CRM для СТО',
    href: '/crm-dlya-sto',
    text: 'Запис клієнта, дошка візитів, майстри, роботи, запчастини, наряд-замовлення, акт і оплата — в одному сценарії.',
    points: ['Планування зміни та пости', 'Історія клієнта й автомобіля', 'Документи без повторного введення'],
  },
  {
    title: 'Програма для шиномонтажу',
    href: '/programma-dlya-shynomontazhu',
    text: 'Контролюй чергу, завантаження майстрів, послуги, оплату та повторні звернення в сезон без таблиць і повідомлень у чатах.',
    points: ['Швидкий запис', 'Контроль навантаження', 'Повторні візити й нагадування'],
  },
  {
    title: 'Облік автозапчастин',
    href: '/oblik-avtozapchastyn',
    text: 'Склад, резерви, закупки, постачальники, маржа й замовлення деталей пов’язані з конкретним клієнтом або візитом.',
    points: ['Мінімальні залишки', 'API постачальників', 'Нова пошта та доставка'],
  },
];

function SearchContent() {
  return <section className="vfs-search-content">
    <div className="vfs-search-head">
      <span className="vf-eyebrow"><i /> РІШЕННЯ ДЛЯ АВТОБІЗНЕСУ</span>
      <h2>Одна система для сервісу, шиномонтажу та запчастин.</h2>
      <p>VIN-matrix створений для щоденної роботи автобізнесу: коли важливо не просто зберігати дані, а бачити наступну дію, гроші та відповідального.</p>
    </div>
    <div className="vfs-search-grid">
      {audiences.map(({ title, href, text, points }) => <article key={title}>
        <span><Wrench size={19} /></span>
        <h3>{title}</h3>
        <p>{text}</p>
        <ul>{points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul>
        <a className="vfs-search-card-link" href={href}>Детальніше <ArrowRight size={14} /></a>
      </article>)}
    </div>
    <div className="vfs-search-bottom">
      <div><b>Покажи процес, а не обіцянку.</b><span>У демо можна перемикати реальні сценарії: дошку візитів, скан техпаспорта, картку клієнта, склад і аналітику.</span></div>
      <a href="/demo">Відкрити демо <ArrowRight size={16} /></a>
    </div>
  </section>;
}

function LegalFooter() {
  return <footer className="vfs-legal-footer" aria-label="Інформація про компанію">
    <div className="vfs-legal-footer__inner">
      <div className="vfs-legal-footer__identity">
        <strong>VIN-matrix</strong>
        <span>© 2026 · RDmatrix Company</span>
      </div>
      <nav className="vfs-legal-footer__links" aria-label="Правова інформація">
        <a href="/contacts">Контакти</a>
        <a href="/privacy">Конфіденційність</a>
        <a href="/terms">Умови використання</a>
      </nav>
    </div>
  </footer>;
}

export default function LandingSearchContentPortal() {
  const [target, setTarget] = useState(null);
  const [legalTarget, setLegalTarget] = useState(null);

  useEffect(() => {
    const footer = document.querySelector('.vf-footer');
    if (!footer || !footer.parentElement) return undefined;
    let host = document.getElementById('vfs-search-content-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vfs-search-content-host';
      footer.parentElement.insertBefore(host, footer);
    }
    setTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  useEffect(() => {
    const footer = document.querySelector('.vf-footer');
    if (!footer || !footer.parentElement) return undefined;
    let host = document.getElementById('vfs-legal-footer-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'vfs-legal-footer-host';
      footer.insertAdjacentElement('afterend', host);
    }
    setLegalTarget(host);
    return () => {
      if (host?.parentElement) host.remove();
    };
  }, []);

  return <>{target ? createPortal(<SearchContent />, target) : null}{legalTarget ? createPortal(<LegalFooter />, legalTarget) : null}</>;
}
