import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const siteOrigin = 'https://vin-matrix.com';

const publicPages = {
  '/': {
    title: 'VIN-matrix — CRM для СТО, шиномонтажу та автозапчастин',
    description: 'VIN-matrix — система управління автобізнесом: дошка візитів, CRM клієнтів, склад, закупки, документи, оплати, Нова пошта та аналітика.',
    name: 'VIN-matrix — система управління для автобізнесу',
  },
  '/demo': {
    title: 'Демо VIN-matrix — CRM для СТО та автобізнесу',
    description: 'Переглянь інтерактивне демо VIN-matrix: дошка візитів, скан техпаспорта, картка клієнта, склад, закупки та аналітика.',
    name: 'Інтерактивне демо VIN-matrix',
  },
  '/crm-dlya-sto': {
    title: 'CRM для СТО — VIN-matrix',
    description: 'CRM для СТО: запис, дошка візитів, клієнти, автомобілі, роботи, запчастини, документи та оплата в одному процесі.',
    name: 'CRM для СТО',
  },
  '/programma-dlya-avtoservisu': {
    title: 'Програма для автосервісу — VIN-matrix',
    description: 'Програма для автосервісу: запис, майстри, пости, роботи, склад, документи, оплата та аналітика.',
    name: 'Програма для автосервісу',
  },
  '/programma-dlya-shynomontazhu': {
    title: 'Програма для шиномонтажу — VIN-matrix',
    description: 'Програма для шиномонтажу: черга, запис, майстри, клієнти, автомобілі, оплата, склад та повторні візити.',
    name: 'Програма для шиномонтажу',
  },
  '/oblik-avtozapchastyn': {
    title: 'Облік автозапчастин — VIN-matrix',
    description: 'Облік автозапчастин: склад, резерви, закупки, постачальники, маржа та замовлення деталей.',
    name: 'Облік автозапчастин',
  },
  '/sklad-ta-zakupky-avtozapchastyn': {
    title: 'Склад і закупки автозапчастин — VIN-matrix',
    description: 'Склад і закупки автозапчастин: прайси, постачальники, замовлення, резерви, неліквід і маржа.',
    name: 'Склад і закупки автозапчастин',
  },
  '/naryad-zamovlennya-sto': {
    title: 'Наряд-замовлення для СТО — VIN-matrix',
    description: 'Наряд-замовлення, акт, рахунок і чек оплати для СТО на основі даних візиту, робіт та запчастин.',
    name: 'Наряд-замовлення для СТО',
  },
};

const privatePrefixes = [
  '/login', '/register', '/onboarding', '/settings', '/billing', '/sales-leads',
  '/search', '/inventory', '/visits', '/attention', '/clients', '/analytics',
  '/activity', '/journal', '/data', '/partner-clients', '/partners', '/complexes', '/crm',
];

function setMeta(name, content, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement('meta');
    document.head.appendChild(node);
  }
  node.setAttribute(property ? 'property' : 'name', name);
  node.content = content;
}

function removeCanonical() {
  document.head.querySelector('link[rel="canonical"]')?.remove();
}

function setCanonical(url) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.rel = 'canonical';
    document.head.appendChild(node);
  }
  node.href = url;
}

function setStructuredData(data) {
  let node = document.head.querySelector('#vin-matrix-jsonld');
  if (!node) {
    node = document.createElement('script');
    node.type = 'application/ld+json';
    node.id = 'vin-matrix-jsonld';
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
}

function removeStructuredData() {
  document.head.querySelector('#vin-matrix-jsonld')?.remove();
}

function isPrivateRoute(pathname) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function PublicSeo() {
  const location = useLocation();

  useEffect(() => {
    const pathname = location.pathname === '/landing' ? '/' : location.pathname;
    const page = publicPages[pathname];

    document.documentElement.lang = 'uk';

    if (!page || isPrivateRoute(location.pathname)) {
      document.title = 'VIN-matrix';
      setMeta('robots', 'noindex,nofollow,noarchive');
      removeCanonical();
      removeStructuredData();
      return;
    }

    const canonical = `${siteOrigin}${pathname === '/' ? '/' : pathname}`;
    document.title = page.title;
    setMeta('description', page.description);
    setMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMeta('theme-color', '#0d1931');
    setMeta('og:type', 'website', true);
    setMeta('og:locale', 'uk_UA', true);
    setMeta('og:site_name', 'VIN-matrix', true);
    setMeta('og:title', page.title, true);
    setMeta('og:description', page.description, true);
    setMeta('og:url', canonical, true);
    setMeta('twitter:card', 'summary');
    setMeta('twitter:title', page.title);
    setMeta('twitter:description', page.description);
    setCanonical(canonical);

    const graph = [
      {
        '@type': 'Organization',
        '@id': `${siteOrigin}/#organization`,
        name: 'VIN-matrix',
        url: `${siteOrigin}/`,
        description: 'Система управління для СТО, шиномонтажу, магазину автозапчастин і змішаного автобізнесу.',
      },
      {
        '@type': 'WebSite',
        '@id': `${siteOrigin}/#website`,
        url: `${siteOrigin}/`,
        name: 'VIN-matrix',
        inLanguage: 'uk-UA',
        publisher: { '@id': `${siteOrigin}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${siteOrigin}/#software`,
        name: 'VIN-matrix',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'uk-UA',
        url: `${siteOrigin}/`,
        description: 'CRM і система управління для автобізнесу: візити, клієнти, склад, документи, оплати, доставка та аналітика.',
        featureList: [
          'Дошка візитів і запис клієнтів',
          'CRM клієнтів, автомобілів та історії сервісу',
          'Скан техпаспорта та заповнення даних авто',
          'Наряд-замовлення, акт, рахунок і чек оплати',
          'Склад, резерви, закупки, маржа та постачальники',
          'Інтеграція Нової пошти через API',
          'Аналітика виручки, прибутку, боргів і навантаження',
        ],
        publisher: { '@id': `${siteOrigin}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: page.name,
        description: page.description,
        inLanguage: 'uk-UA',
        isPartOf: { '@id': `${siteOrigin}/#website` },
        about: { '@id': `${siteOrigin}/#software` },
      },
    ];

    if (pathname !== '/') {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'VIN-matrix', item: `${siteOrigin}/` },
          { '@type': 'ListItem', position: 2, name: page.name, item: canonical },
        ],
      });
    }

    setStructuredData({ '@context': 'https://schema.org', '@graph': graph });
  }, [location.pathname]);

  return null;
}
