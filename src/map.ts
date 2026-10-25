import { chromium, type Page } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

export interface Element { role: string; name: string; testid: string | null; css: string; }
export interface Route { route: string; url: string; title: string; purpose: string; elements: Element[]; }
export interface FeatureMap { version: 1; origin: string; generatedAt: string; routes: Route[]; }

async function collect(page: Page): Promise<{ elements: Element[]; links: string[] }> {
  return page.evaluate(() => {
    const cssPath = (el: Element): string => {
      const tid = el.getAttribute('data-testid');
      if (tid) return `[data-testid="${tid}"]`;
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let n: Element | null = el;
      while (n && n !== document.body) {
        const p: Element | null = n.parentElement;
        const sib = p ? Array.from(p.children).filter((c) => c.tagName === n!.tagName) : [];
        parts.unshift(n.tagName.toLowerCase() + (sib.length > 1 ? `:nth-of-type(${sib.indexOf(n) + 1})` : ''));
        n = p;
      }
      return 'body > ' + parts.join(' > ');
    };
    const roleOf = (el: HTMLElement) => {
      const r = el.getAttribute('role'); if (r) return r;
      const t = el.tagName.toLowerCase();
      if (t === 'a') return 'link';
      if (t === 'button') return 'button';
      if (t === 'select') return 'combobox';
      if (t === 'textarea') return 'textbox';
      if (t === 'input') { const ty = (el as HTMLInputElement).type; return ty === 'checkbox' ? 'checkbox' : ty === 'radio' ? 'radio' : ['submit','button','reset'].includes(ty) ? 'button' : 'textbox'; }
      return t;
    };
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[role=button],[role=link],[onclick],[data-testid]'));
    const elements = nodes.map((el) => ({
      role: roleOf(el),
      name: (el.getAttribute('aria-label') || el.innerText || (el as HTMLInputElement).value || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().slice(0, 80),
      testid: el.getAttribute('data-testid'),
      css: cssPath(el),
    }));
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => a.href);
    return { elements, links };
  });
}

export async function init(startUrl: string, maxPages = 30): Promise<FeatureMap> {
  const origin = new URL(startUrl).origin;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const seen = new Set<string>(); const queue = [startUrl]; const routes: Route[] = [];
  try {
    while (queue.length && routes.length < maxPages) {
      const u = new URL(queue.shift()!); u.hash = '';
      const key = u.toString(); if (seen.has(key)) continue; seen.add(key);
      try { await page.goto(key, { waitUntil: 'load' }); } catch { continue; }
      const title = await page.title();
      const desc = await page.locator('meta[name=description]').getAttribute('content').catch(() => null);
      const { elements, links } = await collect(page);
      routes.push({ route: u.pathname + u.search, url: key, title, purpose: desc || title, elements });
      for (const l of links) { try { const n = new URL(l); n.hash = ''; if (n.origin === origin && !seen.has(n.toString())) queue.push(n.toString()); } catch {} }
    }
  } finally { await browser.close(); }
  return { version: 1, origin, generatedAt: new Date().toISOString(), routes };
}

export function toMarkdown(m: FeatureMap): string {
  let s = `# Feature Map\n\nOrigin: ${m.origin}\n\n`;
  for (const r of m.routes) {
    s += `## \`${r.route}\` — ${r.title}\n\nPurpose: ${r.purpose}\n\n| role | name | testid | css |\n|---|---|---|---|\n`;
    for (const e of r.elements) s += `| ${e.role} | ${e.name.replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${e.testid ?? ''} | \`${e.css}\` |\n`;
    s += '\n';
  }
  return s;
}

export async function write(m: FeatureMap, dir = '.') {
  await writeFile(`${dir}/features.json`, JSON.stringify(m, null, 2) + '\n');
  await writeFile(`${dir}/FEATURES.md`, toMarkdown(m));
}

export interface Missing { route: string; css: string; name: string; }
export async function check(file = 'features.json'): Promise<Missing[]> {
  const m: FeatureMap = JSON.parse(await readFile(file, 'utf8'));
  const browser = await chromium.launch(); const page = await browser.newPage(); const missing: Missing[] = [];
  try {
    for (const r of m.routes) {
      try { await page.goto(r.url, { waitUntil: 'load' }); } catch { missing.push({ route: r.route, css: '(page)', name: 'unreachable' }); continue; }
      for (const e of r.elements) if ((await page.locator(e.css).count()) === 0) missing.push({ route: r.route, css: e.css, name: e.name });
    }
  } finally { await browser.close(); }
  return missing;
}
