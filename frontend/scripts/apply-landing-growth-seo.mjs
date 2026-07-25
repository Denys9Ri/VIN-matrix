import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distIndex = join(process.cwd(), 'dist', 'index.html');
const configPath = join(process.cwd(), 'scripts', 'landing-growth-build-config.json');
if (!existsSync(distIndex) || !existsSync(configPath)) {
  console.log('Landing Growth SEO patch skipped: build files are missing.');
  process.exit(0);
}

const payload = JSON.parse(readFileSync(configPath, 'utf8'));
const config = payload?.config || {};
const seo = config.seo || {};
const hero = config.hero || {};
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const escapeAttribute = escapeHtml;

let html = readFileSync(distIndex, 'utf8');
if (seo.title) {
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeAttribute(seo.title)}" />`);
}
if (seo.description) {
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeAttribute(seo.description)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeAttribute(seo.description)}" />`);
}
if (hero.title || hero.accent) {
  const heading = `${escapeHtml(hero.title || '')}${hero.accent ? ` ${escapeHtml(hero.accent)}` : ''}`.trim();
  html = html.replace(
    /(<section class="vin-static-hero">[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,
    `$1${heading}$2`,
  );
}
if (hero.lead) {
  html = html.replace(
    /(<p class="vin-static-lead">)[\s\S]*?(<\/p>)/,
    `$1${escapeHtml(hero.lead)}$2`,
  );
}

html = html.replace(
  /<script id="vin-matrix-prerender-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/,
  (full, rawJson) => {
    try {
      const schema = JSON.parse(rawJson);
      for (const item of schema['@graph'] || []) {
        if (item['@type'] === 'WebPage') {
          if (seo.title) item.name = seo.title;
          if (seo.description) item.description = seo.description;
        }
        if (item['@type'] === 'SoftwareApplication' && seo.description) item.description = seo.description;
      }
      return `<script id="vin-matrix-prerender-jsonld" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
    } catch {
      return full;
    }
  },
);

writeFileSync(distIndex, html, 'utf8');
console.log(`Applied Landing Growth SEO config v${payload.version || 1} to dist/index.html.`);
