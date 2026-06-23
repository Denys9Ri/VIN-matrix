import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

function attributeEscape(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

for (const path of paths) {
  const file = path === '/' ? join(distDir, 'index.html') : join(distDir, path.slice(1), 'index.html');
  if (!existsSync(file)) throw new Error(`Missing public page: ${path}`);

  let html = readFileSync(file, 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1]?.trim();
  const canonical = `${origin}${path === '/' ? '/' : path}`;
  if (!title || !description) throw new Error(`Missing title or description: ${path}`);

  html = html
    .replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${attributeEscape(title)}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${attributeEscape(description)}" />`)
    .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}" />`);

  writeFileSync(file, html, 'utf8');
}

console.log(`Normalized social metadata for ${paths.length} public pages.`);
