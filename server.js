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
const ATCODER_SITE = 'https://atcoder.jp';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
const submissionsCache = new Map();

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function decodeHtml(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
}
function parseEpoch(value) {
  const normalized = value.replace(/\s+/, 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const epoch = Date.parse(normalized);
  return Number.isFinite(epoch) ? Math.floor(epoch / 1000) : null;
}
function parseAtCoderSubmissions(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const verdictPattern = /^(AC|WA|TLE|MLE|RE|CE|QLE|OLE|IE|WJ|WR|Judging)$/;
  return rows.flatMap((row) => {
    const task = row.match(/href=["']\/contests\/[^"']+\/tasks\/([^"'?#]+)["']/i)?.[1];
    const user = row.match(/href=["']\/users\/([^"'?#]+)["']/i)?.[1];
    const submittedAt = decodeHtml(row.match(/<time[^>]*>([\s\S]*?)<\/time>/i)?.[1] || '');
    const cells = row.match(/<td[\s\S]*?<\/td>/gi) || [];
    const result = cells.map(decodeHtml).find((cell) => verdictPattern.test(cell));
    const submissionId = row.match(/\/submissions\/(\d+)/i)?.[1];
    const epoch_second = parseEpoch(submittedAt);
    if (!task || !user || !result || epoch_second === null) return [];
    return [{ id:submissionId, user_id:user, problem_id:task, result, epoch_second }];
  });
}
async function getAtCoderSubmissions(contest, user) {
  const key = `${contest}:${user.toLowerCase()}`;
  const cached = submissionsCache.get(key);
  if (cached && Date.now() - cached.createdAt < 15000) return cached.data;
  const query = new URLSearchParams({ 'f.User':user, orderBy:'created', desc:'true' });
  const response = await fetch(`${ATCODER_SITE}/contests/${encodeURIComponent(contest)}/submissions?${query}`, { headers: { 'User-Agent':'AtCoder-Practice-Scoreboard/1.0' } });
  if (!response.ok) throw new Error(`AtCoder returned ${response.status}`);
  const data = parseAtCoderSubmissions(await response.text());
  submissionsCache.set(key, { createdAt:Date.now(), data });
  return data;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname === '/api/atcoder/submissions') {
    const contest = requestUrl.searchParams.get('contest') || '';
    const user = requestUrl.searchParams.get('user') || '';
    if (!/^[A-Za-z0-9_-]+$/.test(contest) || !/^[A-Za-z0-9_-]+$/.test(user)) { send(res, 400, 'Invalid contest or user'); return; }
    try { send(res, 200, JSON.stringify(await getAtCoderSubmissions(contest, user)), 'application/json; charset=utf-8'); }
    catch (error) { send(res, 502, `AtCoder submissions lookup failed: ${error.message}`); }
    return;
  }
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
