import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');
const origin = 'https://vin-matrix.com';

const pages = [
  {
    path: '/',
    title: 'VIN-matrix — CRM для СТО, шиномонтажу та автозапчастин',
    description: 'VIN-matrix — система управління автобізнесом: дошка візитів, CRM клієнтів, склад, закупки, документи, оплати, Нова пошта та аналітика.',
    eyebrow: 'СИСТЕМА УПРАВЛІННЯ ДЛЯ АВТОБІЗНЕСУ',
    h1: 'Менше хаосу. Більше контролю.',
    lead: 'VIN-matrix збирає візити, клієнтів, склад, оплату, документи й команду в одному робочому просторі.',
    features: ['Дошка візитів і запис клієнтів', 'CRM клієнтів, автомобілів та історії сервісу', 'Склад, резерви, закупки та маржа', 'Документи, оплати, доставка й аналітика'],
  },
  {
    path: '/demo',
    title: 'Демо VIN-matrix — CRM для СТО та автобізнесу',
    description: 'Переглянь інтерактивне демо VIN-matrix: дошка візитів, скан техпаспорта, картка клієнта, склад, закупки та аналітика.',
    eyebrow: 'ІНТЕРАКТИВНЕ ДЕМО',
    h1: 'Подивіться VIN-matrix у роботі.',
    lead: 'Перемикайте реальні сценарії: дошка візитів, скан техпаспорта, картка клієнта, склад і аналітика.',
    features: ['Дошка візитів: черга, пости та майстри', 'Скан техпаспорта та дані автомобіля', 'Картка клієнта, борги та історія сервісу', 'Склад, закупки, маржа й управлінська аналітика'],
  },
  {
    path: '/crm-dlya-sto',
    title: 'CRM для СТО — VIN-matrix',
    description: 'CRM для СТО: запис, дошка візитів, клієнти, автомобілі, роботи, запчастини, документи та оплата в одному процесі.',
    eyebrow: 'CRM ДЛЯ СТО',
    h1: 'CRM для СТО: клієнти, автомобілі та вся робота сервісу в одному місці.',
    lead: 'VIN-matrix пов’язує запис, клієнта, автомобіль, роботи, запчастини, документи та оплату в одному процесі.',
    features: ['Дошка візитів зі статусами та постами', 'Картка клієнта, автомобіля, VIN та історії робіт', 'Роботи, запчастини й рекомендації', 'Наряд-замовлення, акт, рахунок та чек оплати'],
  },
  {
    path: '/programma-dlya-avtoservisu',
    title: 'Програма для автосервісу — VIN-matrix',
    description: 'Програма для автосервісу: запис, майстри, пости, роботи, склад, документи, оплата та аналітика.',
    eyebrow: 'ПРОГРАМА ДЛЯ АВТОСЕРВІСУ',
    h1: 'Програма для автосервісу, яка веде візит від запису до оплати.',
    lead: 'Коли заявки, майстри, пости, роботи та склад зібрані в одному сценарії, команда бачить наступну дію без зайвих уточнень.',
    features: ['Запис клієнтів, постів і майстрів', 'Статуси візиту та контроль завантаження', 'Роботи й запчастини з прив’язкою до авто', 'Виручка, прибуток, борги та звіти'],
  },
  {
    path: '/programma-dlya-shynomontazhu',
    title: 'Програма для шиномонтажу — VIN-matrix',
    description: 'Програма для шиномонтажу: черга, запис, майстри, клієнти, автомобілі, оплата, склад та повторні візити.',
    eyebrow: 'ПРОГРАМА ДЛЯ ШИНОМОНТАЖУ',
    h1: 'Програма для шиномонтажу: черга, майстри, послуги та повторні візити без хаосу.',
    lead: 'VIN-matrix допомагає керувати записом, живою чергою, навантаженням майстрів, оплатою та історією клієнта в сезон.',
    features: ['Швидкий запис на послугу та час', 'Дошка візитів для контролю черги', 'Картка клієнта та автомобіля', 'Оплата, історія і сезонні нагадування'],
  },
  {
    path: '/oblik-avtozapchastyn',
    title: 'Облік автозапчастин — VIN-matrix',
    description: 'Облік автозапчастин: склад, резерви, закупки, постачальники, маржа та замовлення деталей.',
    eyebrow: 'ОБЛІК АВТОЗАПЧАСТИН',
    h1: 'Облік автозапчастин: склад, резерв, маржа та замовлення постачальнику.',
    lead: 'Система показує не лише залишок на полиці, а й резерви під візити, мінімальні залишки, неліквід та реальну маржу.',
    features: ['Залишки, доступна кількість і резерви', 'Прихід, списання, закупка, продаж і маржа', 'Мінімальні залишки та список до замовлення', 'Постачальники, прайси та замовлення деталей'],
  },
  {
    path: '/sklad-ta-zakupky-avtozapchastyn',
    title: 'Склад і закупки автозапчастин — VIN-matrix',
    description: 'Склад і закупки автозапчастин: прайси, постачальники, замовлення, резерви, неліквід і маржа.',
    eyebrow: 'СКЛАД ТА ЗАКУПКИ',
    h1: 'Склад і закупки автозапчастин без заморожених грошей та ручного контролю.',
    lead: 'Закупки стають керованими, коли видно реальну потребу: резерви, мінімальні залишки, доступний товар і позиції без руху.',
    features: ['Прайси та позиції постачальників', 'Замовлення деталей і контроль статусу', 'Резерви під конкретні візити', 'Неліквід, низька маржа та товар без продажу'],
  },
  {
    path: '/naryad-zamovlennya-sto',
    title: 'Наряд-замовлення для СТО — VIN-matrix',
    description: 'Наряд-замовлення, акт, рахунок і чек оплати для СТО на основі даних візиту, робіт та запчастин.',
    eyebrow: 'НАРЯД-ЗАМОВЛЕННЯ ДЛЯ СТО',
    h1: 'Наряд-замовлення для СТО, акт і чек оплати з одного візиту.',
    lead: 'Документи формуються з даних візиту, тому клієнта, авто, послуги, запчастини та суми не потрібно вводити повторно.',
    features: ['Наряд-замовлення за даними візиту', 'Акт виконаних робіт та документи PDF', 'Рахунок, чек оплати і контроль боргу', 'Історія документів у картці клієнта'],
  },
];

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const canonicalFor = (path) => `${origin}${path === '/' ? '/' : path}`;

function snapshot(page) {
  const featureItems = page.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('');
  const solutionLinks = pages.filter((candidate) => candidate.path !== '/' && candidate.path !== '/demo').map((candidate) => `<li><a href="${candidate.path}">${escapeHtml(candidate.title.replace(' — VIN-matrix', ''))}</a></li>`).join('');

  return `<main class="vin-static-snapshot">
    <header class="vin-static-header"><a href="/" class="vin-static-logo">VIN-<strong>matrix</strong></a><nav><a href="/#features">Можливості</a><a href="/demo">Демо</a><a href="/#tariff">Тариф</a><a href="/login">Увійти</a></nav></header>
    <section class="vin-static-hero"><p class="vin-static-eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.h1)}</h1><p class="vin-static-lead">${escapeHtml(page.lead)}</p><p><a class="vin-static-primary" href="/register">Почати безкоштовно</a> <a class="vin-static-secondary" href="/demo">Подивитись демо</a></p></section>
    <section class="vin-static-section"><h2>Що дає VIN-matrix</h2><ul>${featureItems}</ul></section>
    <section class="vin-static-section"><h2>Рішення для автобізнесу</h2><ul class="vin-static-links">${solutionLinks}</ul></section>
    <section class="vin-static-section"><h2>Перевірте процес у демо</h2><p>Подивіться, як виглядають дошка візитів, скан техпаспорта, CRM клієнта, склад і аналітика.</p><a class="vin-static-primary" href="/demo">Відкрити демо VIN-matrix</a></section>
  </main>`;
}

function staticHead(page) {
  const canonical = canonicalFor(page.path);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'VIN-matrix', url: `${origin}/`, description: 'Система управління для СТО, шиномонтажу, магазину автозапчастин і змішаного автобізнесу.' },
      { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'VIN-matrix', url: `${origin}/`, inLanguage: 'uk-UA' },
      { '@type': 'SoftwareApplication', '@id': `${origin}/#software`, name: 'VIN-matrix', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'uk-UA', url: `${origin}/`, description: 'CRM і система управління для автобізнесу: візити, клієнти, склад, документи, оплати, доставка та аналітика.' },
      { '@type': 'WebPage', '@id': canonical, url: canonical, name: page.title, description: page.description, inLanguage: 'uk-UA', isPartOf: { '@id': `${origin}/#website` } },
    ],
  };

  return `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:url" content="${canonical}" />
    <script id="vin-matrix-prerender-jsonld" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
    <style>.vin-static-snapshot{max-width:1120px;margin:0 auto;padding:34px 24px 80px;color:#15284b;font-family:Arial,sans-serif}.vin-static-header{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:0 0 36px}.vin-static-logo{font-size:24px;font-weight:900;color:#2e66ed;text-decoration:none}.vin-static-logo strong{color:#15284b}.vin-static-header nav{display:flex;flex-wrap:wrap;gap:16px}.vin-static-header a{color:#244064;font-weight:700;text-decoration:none}.vin-static-hero{padding:52px;border-radius:24px;color:#fff;background:linear-gradient(125deg,#0d1b37,#2357be,#16a7cb)}.vin-static-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em}.vin-static-hero h1{max-width:800px;margin:12px 0;font-size:clamp(36px,6vw,68px);line-height:1.05}.vin-static-lead{max-width:700px;font-size:18px;line-height:1.6}.vin-static-primary,.vin-static-secondary{display:inline-block;margin:12px 8px 0 0;padding:13px 17px;border-radius:10px;font-weight:800;text-decoration:none}.vin-static-primary{color:#fff;background:#2e66ed}.vin-static-secondary{color:#fff;border:1px solid rgba(255,255,255,.6)}.vin-static-section{margin-top:32px;padding:28px;border:1px solid #d9e5f4;border-radius:18px;background:#fff}.vin-static-section h2{margin:0 0 14px;font-size:27px}.vin-static-section li,.vin-static-section p{margin:10px 0;line-height:1.6}.vin-static-links a{color:#1c5be0;font-weight:700}@media(max-width:680px){.vin-static-header{align-items:flex-start;flex-direction:column}.vin-static-hero{padding:30px 22px}.vin-static-section{padding:21px}}</style>`;
}

function renderPage(baseHtml, page) {
  const canonical = canonicalFor(page.path);
  const withHead = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
    .replace('</head>', `${staticHead(page)}</head>`);
  const rootExpression = /<div id="root"><\/div>/;
  if (!rootExpression.test(withHead)) throw new Error('Could not locate the React root in built index.html');
  return withHead.replace(rootExpression, `<div id="root">${snapshot(page)}</div>`).replaceAll('https://vin-matrix.com/landing', canonical);
}

if (!existsSync(indexPath)) throw new Error('Build output is missing dist/index.html');
const baseHtml = readFileSync(indexPath, 'utf8');

for (const page of pages) {
  const destination = page.path === '/' ? indexPath : join(distDir, page.path.slice(1), 'index.html');
  if (page.path !== '/') rmSync(dirname(destination), { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, renderPage(baseHtml, page), 'utf8');
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${canonicalFor(page.path)}</loc></url>`).join('\n')}\n</urlset>\n`;
writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf8');
console.log(`Pre-rendered ${pages.length} public SEO pages.`);
