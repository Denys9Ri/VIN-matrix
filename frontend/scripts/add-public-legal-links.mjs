import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const paths = ['/', '/demo', '/crm-dlya-sto', '/programma-dlya-avtoservisu', '/programma-dlya-shynomontazhu', '/oblik-avtozapchastyn', '/sklad-ta-zakupky-avtozapchastyn', '/naryad-zamovlennya-sto'];
const footer = `<footer class="vin-static-legal-footer"><span>RDmatrix Company</span><nav><a href="/contacts">Контакти</a><a href="/privacy">Політика конфіденційності</a><a href="/terms">Умови використання</a></nav></footer><style>.vin-static-legal-footer{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:28px;padding:18px 0 0;border-top:1px solid #d9e5f4;color:#667e9e;font-size:12px;font-weight:700}.vin-static-legal-footer nav{display:flex;flex-wrap:wrap;gap:13px}.vin-static-legal-footer a{color:#245fdf;text-decoration:none}@media(max-width:600px){.vin-static-legal-footer{flex-direction:column}}</style>`;

for (const path of paths) {
  const file = path === '/' ? join(distDir, 'index.html') : join(distDir, path.slice(1), 'index.html');
  if (!existsSync(file)) throw new Error(`Public page is missing: ${path}`);
  let html = readFileSync(file, 'utf8');
  if (!html.includes('vin-static-legal-footer')) {
    if (!html.includes('</main>')) throw new Error(`Cannot add trust links to ${path}`);
    html = html.replace('</main>', `${footer}</main>`);
    writeFileSync(file, html, 'utf8');
  }
}

console.log(`Added trust page links to ${paths.length} pre-rendered public pages.`);
