import { init, write, check } from './map.ts';
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'init' && arg) {
  const m = await init(arg); await write(m);
  console.log(`featuremap: ${m.routes.length} routes, ${m.routes.reduce((a, r) => a + r.elements.length, 0)} elements → features.json, FEATURES.md`);
} else if (cmd === 'check') {
  const miss = await check(arg || 'features.json');
  if (miss.length) { for (const x of miss) console.error(`MISSING ${x.route} ${x.css} (${x.name})`); process.exit(1); }
  console.log('featuremap: all recorded selectors present');
} else { console.log('usage: featuremap init <url> | featuremap check [features.json]'); process.exit(cmd ? 2 : 0); }
