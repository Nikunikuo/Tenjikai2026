import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'dist-local');
const runtime = path.join(root, '.runtime');
const token = randomBytes(24).toString('hex');
const port = 4319;
if (!fs.existsSync(path.join(publicRoot, 'index.html')))
  throw new Error('Build is missing. Run npm run build:local first.');
fs.mkdirSync(runtime, { recursive: true });
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
};
const server = http.createServer((req, res) => {
  const common = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-cache',
  };
  const reply = (status, text) => {
    res.writeHead(status, {
      ...common,
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end(text);
  };
  // Loopback only, and reject untrusted Host headers (including DNS rebinding).
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host))
    return reply(403, 'Invalid host');
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, `http://127.0.0.1:${port}`).pathname,
    );
  } catch {
    return reply(400, 'Invalid path');
  }
  if (pathname === '/__airloop/health' && req.method === 'GET') {
    res.writeHead(200, { ...common, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ app: 'air-loop', pid: process.pid, version: 1 }));
    return;
  }
  if (pathname === '/__airloop/stop' && req.method === 'POST') {
    if (req.headers['x-airloop-token'] !== token)
      return reply(403, 'Forbidden');
    reply(200, 'Stopped');
    server.close(() => process.exit(0));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return reply(405, 'Method not allowed');
  if (pathname.includes('\0') || pathname.includes('\\'))
    return reply(400, 'Invalid path');
  const filename = path.resolve(
    publicRoot,
    '.' + (pathname === '/' ? '/index.html' : pathname),
  );
  if (!filename.startsWith(publicRoot + path.sep))
    return reply(403, 'Forbidden');
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) return reply(404, 'Not found');
    const headers = {
      ...common,
      'Content-Type':
        types[path.extname(filename)] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    };
    let start = 0,
      end = stat.size - 1,
      status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        start > end ||
        start >= stat.size ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end)
      ) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || stat.size === 0) {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filename, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});
server.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  fs.writeFileSync(
    path.join(runtime, 'server.json'),
    JSON.stringify({ pid: process.pid, token, port }),
  );
  console.log(`AIR LOOP ready at http://127.0.0.1:${port}/`);
});
