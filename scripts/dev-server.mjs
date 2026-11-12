// Local dev server: serves the static site and runs /api/* functions like Vercel does.
// Usage:  npm run dev        (reads .env if present)   → http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Minimal .env loader (KEY=value per line).
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
        const file = join(root, 'api', `${name}.js`);
        if (!name || name.startsWith('_') || !existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Not found"}'); }
        const mod = await import(pathToFileURL(file).href);
        return await mod.default(req, res);
      }
      let path = normalize(join(root, decodeURIComponent(url.pathname)));
      if (!path.startsWith(root) || /^[\\/]?(api|scripts|supabase|node_modules|\.git|\.env|\.vercel|package)/i.test(path.slice(root.length))) { res.statusCode = 404; return res.end('Not found'); }
      if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.setHeader('Content-Type', TYPES[extname(path)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(body);
    } catch (e) {
      if (e.code === 'ENOENT') { res.statusCode = 404; return res.end('Not found'); }
      console.error(e); res.statusCode = 500; res.end('Server error');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`MERIDIAN dev server → http://localhost:${port}`));
}
