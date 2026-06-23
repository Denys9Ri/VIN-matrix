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

  if (path !== '/' && !html.includes('vin-matrix-breadcrumb-jsonld')) {
    fail(`breadcrumb markup is missing for ${path}`);
  }
}

const robotsPath = join(distDir, 'robots.txt');
const sitemapPath = join(distDir, 'sitemap.xml');
if (!existsSync(robotsPath)) fail('robots.txt is missing');
if (!existsSync(sitemapPath)) fail('sitemap.xml is missing');

const robots = readFileSync(robotsPath, 'utf8');
const sitemap = readFileSync(sitemapPath, 'utf8');
if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) fail('robots.txt does not reference sitemap.xml');
if (robots.includes('Disallow: /login')) fail('robots.txt must not block pages that use noindex headers');

for (const path of paths) {
  const canonical = `${origin}${path === '/' ? '/' : path}`;
  if (!sitemap.includes(`<loc>${canonical}</loc>`)) fail(`sitemap is missing ${path}`);
}

console.log(`SEO build check passed for ${paths.length} public pages.`);
