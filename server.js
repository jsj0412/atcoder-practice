/**
 * AtCoder Practice local server.
 * 정적 파일을 제공하고 AtCoder Problems API를 같은 origin으로 중계한다.
 * Node.js 18 이상 필요: node server.js
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const ATCODER_BASE = 'https://kenkoooo.com/atcoder';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname.startsWith('/api/')) {
    const target = `${ATCODER_BASE}${requestUrl.pathname.slice(4)}${requestUrl.search}`;
    try {
      const upstream = await fetch(target, { headers: { 'User-Agent': 'AtCoder-Practice-Local/1.0' } });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (error) {
      send(res, 502, `AtCoder Problems API에 연결할 수 없습니다: ${error.message}`);
    }
    return;
  }

  const requested = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filename = path.resolve(ROOT, `.${requested}`);
  if (!filename.startsWith(ROOT) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    send(res, 404, 'Not found'); return;
  }
  send(res, 200, fs.readFileSync(filename), MIME[path.extname(filename)] || 'application/octet-stream');
});

server.listen(PORT, '0.0.0.0', () => console.log(`AtCoder Practice: http://localhost:${PORT}`));
