import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const pages = [];

async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full);
    else if (name === 'index.html') pages.push(full);
  }
}

function get(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function localTarget(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  const clean = decodeURIComponent(href.split('#')[0].split('?')[0]);
  if (!clean) return null;
  if (clean === '/') return path.join(root, 'index.html');
  if (clean.endsWith('/')) return path.join(root, clean.slice(1), 'index.html');
  return path.join(root, clean.slice(1));
}

await walk(root);

const titles = new Map();
const canonicals = new Set();

for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const title = get(html, /<title>([\s\S]*?)<\/title>/i);
  const description = get(html, /<meta\s+name="description"\s+content="([^"]+)"/i);
  const canonical = get(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const h1 = get(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, ' ').trim();

  if (!title) errors.push(`${rel}: missing title`);
  if (!description) errors.push(`${rel}: missing meta description`);
  if (!canonical) errors.push(`${rel}: missing canonical`);
  if (!h1) errors.push(`${rel}: missing h1`);
  if (title) {
    if (titles.has(title)) errors.push(`${rel}: duplicate title with ${titles.get(title)}`);
    titles.set(title, rel);
  }
  if (canonical) {
    if (!canonical.startsWith('https://liuatt.com/')) errors.push(`${rel}: canonical is outside liuatt.com`);
    if (canonicals.has(canonical)) errors.push(`${rel}: duplicate canonical ${canonical}`);
    canonicals.add(canonical);
  }

  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); }
    catch (error) { errors.push(`${rel}: invalid JSON-LD (${error.message})`); }
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
    const target = localTarget(match[1]);
    if (!target) continue;
    try { await stat(target); }
    catch { errors.push(`${rel}: broken internal reference ${match[1]}`); }
  }
}

const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
for (const canonical of canonicals) {
  if (!sitemapUrls.has(canonical)) errors.push(`sitemap.xml: missing ${canonical}`);
}
for (const url of sitemapUrls) {
  const pathname = new URL(url).pathname;
  const target = localTarget(pathname);
  try { await stat(target); }
  catch { errors.push(`sitemap.xml: URL has no local page ${url}`); }
}

if (errors.length) {
  console.error(`Site validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${pages.length} HTML pages, ${canonicals.size} canonicals and ${sitemapUrls.size} sitemap URLs.`);
