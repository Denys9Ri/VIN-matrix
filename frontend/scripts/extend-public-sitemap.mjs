import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sitemapPath = join(process.cwd(), 'dist', 'sitemap.xml');
const legalPaths = ['/contacts', '/privacy', '/terms'];
const origin = 'https://vin-matrix.com';

if (!existsSync(sitemapPath)) throw new Error('sitemap.xml is missing from the build output');
let sitemap = readFileSync(sitemapPath, 'utf8');

for (const path of legalPaths) {
  const entry = `  <url><loc>${origin}${path}</loc></url>`;
  if (!sitemap.includes(`<loc>${origin}${path}</loc>`)) sitemap = sitemap.replace('</urlset>', `${entry}\n</urlset>`);
}

writeFileSync(sitemapPath, sitemap, 'utf8');
console.log(`Added ${legalPaths.length} public trust pages to sitemap.xml.`);
