import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../demo/server.js';
import { init, write, check } from '../src/map.ts';

let server: any, base: string, root: string, out: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'fm-site-')) + '/';
  await cp(new URL('../demo/site/', import.meta.url).pathname, root, { recursive: true });
  server = await serve(0, root); base = `http://localhost:${server.address().port}/`;
  out = await mkdtemp(join(tmpdir(), 'fm-out-'));
});
afterAll(() => server?.close());

describe('featuremap', () => {
  it('init maps ≥3 routes and ≥10 elements', async () => {
    const m = await init(base); await write(m, out);
    expect(m.routes.length).toBeGreaterThanOrEqual(3);
    expect(m.routes.reduce((a, r) => a + r.elements.length, 0)).toBeGreaterThanOrEqual(10);
    expect(await readFile(join(out, 'FEATURES.md'), 'utf8')).toContain('# Feature Map');
  }, 60000);
  it('check passes, then fails when a selector is removed', async () => {
    const f = join(out, 'features.json');
    expect(await check(f)).toEqual([]);
    const p = root + 'cart.html';
    await writeFile(p, (await readFile(p, 'utf8')).replace('<button data-testid="checkout">Checkout</button>', ''));
    const miss = await check(f);
    expect(miss.some((x) => x.css.includes('checkout'))).toBe(true);
  }, 60000);
});
