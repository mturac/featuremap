import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('./site/', import.meta.url));
export function serve(port = 0, root = dir) {
  const s = http.createServer(async (req, res) => {
    let p = new URL(req.url, 'http://x').pathname; if (p.endsWith('/')) p += 'index.html'; if (!p.includes('.')) p += '.html';
    try { const b = await readFile(root + p.replace(/\.\./g, '')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); }
    catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => s.listen(port, () => r(s)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const s = await serve(Number(process.env.PORT || 4321)); console.log(`demo on http://localhost:${s.address().port}/`); }
