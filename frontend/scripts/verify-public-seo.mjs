import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const origin = 'https://vin-matrix.com';
const paths = [
  '/',
  '/demo',
  '/crm-dlya-sto',
  '/programma-dlya-avtoservisu',
  '/programma-dlya-shynomontazhu',
  '/oblik-avtozapchastyn',
  '/sklad-ta-zakupky-avtozapchastyn',
  '/naryad-zamovlennya-sto',
];
const trustPaths = ['/contacts', '/privacy', '/terms'];

function fail(message) {
  console.error(`SEO build check failed: ${message}`);
  process.exit(1);
}

for (const path of paths) {
  const file = path === '/' ? join(distDir, 'index.html') : join(distDir, path.slice(1), 'index.html');
  if (!existsSync(file)) fail(`missing static page ${path}`);

  const html = readFileSync(file, 'utf8');
  const canonical = `${origin}${path === '/' ? '/' : path}`;
  if (!html.includes(`rel="canonical" href="${canonical}"`)) fail(`canonical is missing for ${path}`);
  if (!html.includes('<h1>')) fail(`static H1 is missing for ${path}`);
  if (!html.includes('application/ld+json')) fail(`structured data is missing for ${path}`);
  if (!html.includes('vin-static-enrichment')) fail(`helpful static content is missing for ${path}`);
  if (!html.includes('vin-static-legal-footer')) fail(`trust links are missing for ${path}`);
  if (path !== '/' && !html.includes('vin-matrix-breadcrumb-jsonld')) fail(`breadcrumb markup is missing for ${path}`);
}

const robotsPath = join(distDir, 'robots.txt');
const sitemapPath = join(distDir, 'sitemap.xml');
const notFoundPath = join(distDir, '404.html');
if (!existsSync(robotsPath)) fail('robots.txt is missing');
if (!existsSync(sitemapPath)) fail('sitemap.xml is missing');
if (!existsSync(notFoundPath)) fail('404.html is missing');

const robots = readFileSync(robotsPath, 'utf8');
const sitemap = readFileSync(sitemapPath, 'utf8');
const notFound = readFileSync(notFoundPath, 'utf8');
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots.txt does not reference sitemap.xml');
if (robots.includes('Disallow: /login')) fail('robots.txt must not block pages that use noindex headers');
if (!notFound.includes('noindex,nofollow,noarchive')) fail('404 page must be noindex');
if (!notFound.includes('Сторінку не знайдено')) fail('404 page content is missing');

for (const path of [...paths, ...trustPaths]) {
  const canonical = `${origin}${path === '/' ? '/' : path}`;
  if (!sitemap.includes(`<loc>${canonical}</loc>`)) fail(`sitemap is missing ${path}`);
}

for (const path of trustPaths) {
  const file = join(distDir, path.slice(1), 'index.html');
  if (!existsSync(file)) fail(`trust page is missing: ${path}`);
  const html = readFileSync(file, 'utf8');
  const canonical = `${origin}${path}`;
  if (!html.includes(`rel="canonical" href="${canonical}"`)) fail(`trust page canonical is missing: ${path}`);
  if (!html.includes('<h1>')) fail(`trust page H1 is missing: ${path}`);
  if (!html.includes('RDmatrix Company')) fail(`trust page owner data is missing: ${path}`);
}

console.log(`SEO build check passed for ${paths.length} public pages, ${trustPaths.length} trust pages and the 404 page.`);
