// server.js가 AtCoder Problems 요청을 중계해 로컬 파일/CORS 환경에서도 동작하게 합니다.
const API = '/api';
const RESOURCES = `${API}/resources`;
const STORAGE_KEY = 'atcoder-practice-v1';
const ACTIVE_PRACTICE_KEY = 'atcoder-practice-active-id';
const supabaseConfig = window.ATCODER_PRACTICE_SUPABASE;
const database = window.supabase && supabaseConfig?.url && supabaseConfig?.publishableKey
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
let activePracticeId = new URLSearchParams(window.location.search).get('practice') || localStorage.getItem(ACTIVE_PRACTICE_KEY);
let refreshTimer = null;

const $ = (selector) => document.querySelector(selector);
const dateText = (date) => new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
const localInputDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readPractices = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const savePractices = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
function practiceToRow(practice) {
  return { id:practice.id, title:practice.title, starts_at:practice.startsAt, ends_at:practice.endsAt, participants:practice.participants, min_difficulty:practice.minDifficulty, max_difficulty:practice.maxDifficulty, ordering:practice.ordering, problems:practice.problems };
}
function rowToPractice(row) {
  return { id:row.id, title:row.title, startsAt:row.starts_at, endsAt:row.ends_at, participants:row.participants, minDifficulty:row.min_difficulty, maxDifficulty:row.max_difficulty, ordering:row.ordering, problems:row.problems, createdAt:row.created_at };
}
async function loadSharedPractices() {
  if (!database) { renderList(); return; }
  const { data, error } = await database.from('practices').select('*').order('created_at', { ascending:false }).limit(100);
  if (error) { renderList(); console.error(error); return; }
  savePractices(data.map(rowToPractice));
  renderList();
  if (activePracticeId && readPractices().some((practice) => practice.id === activePracticeId)) showPractice(activePracticeId);
}
function difficultyColor(difficulty) {
  if (difficulty < 400) return '#9aa0a6';
  if (difficulty < 800) return '#a56a43';
  if (difficulty < 1200) return '#42a75c';
  if (difficulty < 1600) return '#32a9c5';
  if (difficulty < 2000) return '#3c7ddd';
  if (difficulty < 2400) return '#d7a900';
  if (difficulty < 2800) return '#e67628';
  return '#db4b4b';
}
function updateDifficultyColors() {
  $('#minColor').style.setProperty('--difficulty', difficultyColor(Number($('#minDifficulty').value)));
  $('#maxColor').style.setProperty('--difficulty', difficultyColor(Number($('#maxDifficulty').value)));
}

function seedDates() {
  const start = new Date(Date.now() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  $('#startsAt').value = localInputDate(start);
  $('#endsAt').value = localInputDate(end);
}

function openDialog() { seedDates(); $('#formStatus').textContent = ''; $('#practiceDialog').showModal(); }
function renderList() {
  const practices = readPractices();
  $('#practiceCount').textContent = practices.length;
  $('#listCount').textContent = practices.length;
  const list = $('#practiceList');
  list.innerHTML = !database ? '<p style="font-size:12px;color:#c84d30;padding:8px;line-height:1.6">공유 기능을 사용하려면 config.js에 Supabase 연결 정보를 설정해 주세요.</p>' : practices.length ? practices.map((p) => `
    <button class="practice-item ${p.id === activePracticeId ? 'active' : ''}" data-id="${p.id}">
      <strong>${escapeHtml(p.title)}</strong><span>${dateText(p.startsAt)} · ${p.participants.length}명</span>
    </button>`).join('') : '<p style="font-size:12px;color:#64716d;padding:8px;line-height:1.6">아직 생성된 연습이 없습니다.</p>';
  list.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => showPractice(button.dataset.id)));
}
function escapeHtml(s) { return s.replace(/[&<>'"]/g, (x) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[x]); }

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`데이터 요청 실패 (${response.status})`);
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('서버에 연결할 수 없습니다. 터미널에서 node server.js를 실행한 뒤 http://localhost:4173 으로 열어 주세요.');
    }
    throw error;
  }
}
async function fetchAllSubmissions(user, onProgress) {
  let from = 0, all = [], pages = 0;
  while (pages < 100) {
    onProgress(`${user}의 과거 제출 확인 중… (${all.length}건)`);
    const items = await fetchJson(`${API}/atcoder-api/v3/user/submissions?user=${encodeURIComponent(user)}&from_second=${from}`);
    if (!items.length) break;
    all.push(...items);
    const last = items[items.length - 1].epoch_second;
    if (items.length < 500 || last <= from) break;
    from = last + 1;
    pages += 1;
    await sleep(1100);
  }
  return all;
}
async function createPractice(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('#formStatus');
  status.classList.remove('error');
  if (!database) { status.textContent = '공유 DB가 연결되지 않았습니다. config.js의 Supabase URL과 publishable key를 설정해 주세요.'; status.classList.add('error'); return; }
  const participants = [...new Set($('#participants').value.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean))];
  const minDifficulty = Number($('#minDifficulty').value), maxDifficulty = Number($('#maxDifficulty').value), count = Number($('#problemCount').value);
  const startsAt = new Date($('#startsAt').value), endsAt = new Date($('#endsAt').value);
  if (!participants.length || minDifficulty > maxDifficulty || endsAt <= startsAt) { status.textContent = '입력값을 다시 확인해 주세요.'; status.classList.add('error'); return; }
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    status.textContent = '문제 목록을 불러오는 중…';
    const [models, problems, pairs] = await Promise.all([
      fetchJson(`${RESOURCES}/problem-models.json`), fetchJson(`${RESOURCES}/problems.json`), fetchJson(`${RESOURCES}/contest-problem.json`),
    ]);
    const submissions = [];
    for (const user of participants) submissions.push(...await fetchAllSubmissions(user, (text) => { status.textContent = text; }));
    const excluded = new Set(submissions.map((s) => s.problem_id));
    const indexById = new Map(pairs.map((pair) => [pair.problem_id, pair.problem_index]));
    const candidates = problems.filter((problem) => {
      const difficulty = models[problem.id]?.difficulty;
      return Number.isFinite(difficulty) && difficulty >= minDifficulty && difficulty <= maxDifficulty && !excluded.has(problem.id);
    });
    if (candidates.length < count) throw new Error(`조건에 맞는 미제출 문제가 ${candidates.length}개뿐입니다. 범위를 넓히거나 문제 수를 줄여 주세요.`);
    for (let i = candidates.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const selected = candidates.slice(0, count).map((p) => ({ id:p.id, title:p.title, contestId:p.contest_id, index:indexById.get(p.id) || '?', difficulty:Math.round(models[p.id].difficulty) }));
    const ordering = form.elements.ordering.value;
    if (ordering === 'difficulty') selected.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
    const practice = { id:crypto.randomUUID(), title:$('#title').value.trim(), startsAt:startsAt.toISOString(), endsAt:endsAt.toISOString(), participants, minDifficulty, maxDifficulty, ordering, problems:selected, createdAt:new Date().toISOString() };
    status.textContent = '공유 연습을 저장하는 중…';
    const { error } = await database.from('practices').insert(practiceToRow(practice));
    if (error) throw new Error(`공유 연습 저장 실패: ${error.message}`);
    savePractices([practice, ...readPractices().filter((item) => item.id !== practice.id)]); activePracticeId = practice.id;
    $('#practiceDialog').close(); renderList(); showPractice(practice.id);
  } catch (error) { status.textContent = error.message || '연습 생성 중 오류가 발생했습니다.'; status.classList.add('error'); }
  finally { submit.disabled = false; }
}

function statusOf(practice) { const now = Date.now(), start = new Date(practice.startsAt), end = new Date(practice.endsAt); return now < start ? 'SCHEDULED' : now > end ? 'FINISHED' : 'IN PROGRESS'; }
async function submissionsForPractice(practice) {
  const from = Math.floor(new Date(practice.startsAt).getTime() / 1000), to = Math.floor(new Date(practice.endsAt).getTime() / 1000);
  const userChunks = []; for (let i = 0; i < practice.participants.length; i += 10) userChunks.push(practice.participants.slice(i, i + 10));
  const problemChunks = []; for (let i = 0; i < practice.problems.length; i += 30) problemChunks.push(practice.problems.slice(i, i + 30));
  const requests = userChunks.flatMap((users) => problemChunks.map(async (problems) => {
    const url = `${API}/atcoder-api/v3/users_and_time?users=${encodeURIComponent(users.join(','))}&problems=${encodeURIComponent(problems.map((p) => p.id).join(','))}&from=${from}&to=${to}`;
    return fetchJson(url);
  }));
  return (await Promise.all(requests)).flat();
}
function scoreRows(practice, submissions) {
  const start = new Date(practice.startsAt).getTime();
  return practice.participants.map((user) => {
    const cells = practice.problems.map((problem) => {
      const attempts = submissions.filter((s) => s.user_id === user && s.problem_id === problem.id).sort((a,b) => a.epoch_second - b.epoch_second);
      const accepted = attempts.find((s) => s.result === 'AC');
      const wrongBefore = accepted ? attempts.filter((s) => s.epoch_second < accepted.epoch_second && s.result !== 'AC').length : 0;
      const minutes = accepted ? Math.max(0, Math.ceil((accepted.epoch_second * 1000 - start) / 60000)) : null;
      return { attempts:attempts.length, minutes, penalty:accepted ? minutes + wrongBefore * 20 : 0, wrongBefore };
    });
    const solved = cells.filter((c) => c.minutes !== null).length;
    const penalty = cells.reduce((sum, c) => sum + c.penalty, 0);
    const lastAc = Math.max(...cells.filter((c) => c.minutes !== null).map((c) => c.minutes), -1);
    return { user, cells, solved, penalty, lastAc };
  }).sort((a,b) => b.solved - a.solved || a.penalty - b.penalty || a.lastAc - b.lastAc || a.user.localeCompare(b.user));
}
function cellHtml(cell) { if (cell.minutes !== null) return `<td class="cell-ac">${cell.minutes}${cell.wrongBefore ? ` (+${cell.wrongBefore})` : ''}</td>`; if (cell.attempts) return `<td class="cell-try">-${cell.attempts}</td>`; return '<td class="cell-none">—</td>'; }
async function showPractice(id, force = false) {
  activePracticeId = id;
  localStorage.setItem(ACTIVE_PRACTICE_KEY, id);
  const url = new URL(window.location.href);
  url.searchParams.set('practice', id);
  window.history.replaceState({}, '', url);
  renderList();
  const practice = readPractices().find((p) => p.id === id); if (!practice) return;
  const panel = $('#boardPanel'); panel.innerHTML = ''; panel.append($('#boardTemplate').content.cloneNode(true));
  $('#practiceStatus').textContent = statusOf(practice);
  $('#boardTitle').textContent = practice.title;
  $('#boardMeta').textContent = `${dateText(practice.startsAt)} — ${dateText(practice.endsAt)} · ${practice.participants.length}명 · ${practice.ordering === 'difficulty' ? '난이도 순' : '무작위'} 배치`;
  $('#problemsStrip').innerHTML = practice.problems.map((p, i) => `<a class="problem-chip" style="--difficulty:${difficultyColor(p.difficulty)}" target="_blank" rel="noopener" href="https://atcoder.jp/contests/${encodeURIComponent(p.contestId)}/tasks/${encodeURIComponent(p.id)}"><strong>${String.fromCharCode(65 + i)} · ${escapeHtml(p.title)}</strong><span>${p.difficulty}</span></a>`).join('');
  $('#scoreHead').innerHTML = `<tr><th>#</th><th>참가자</th>${practice.problems.map((_,i) => `<th>${String.fromCharCode(65+i)}</th>`).join('')}<th>해결</th><th>페널티</th></tr>`;
  $('#scoreBody').innerHTML = `<tr><td colspan="${practice.problems.length + 5}" style="color:#64716d;padding:25px">제출 기록을 불러오는 중…</td></tr>`;
  $('#refreshButton').addEventListener('click', () => showPractice(id, true));
  $('#shareButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      $('#shareButton').textContent = '복사됨!';
      setTimeout(() => { const button = $('#shareButton'); if (button) button.textContent = '↗ 공유 링크'; }, 1500);
    } catch { window.prompt('이 링크를 복사해 공유하세요.', window.location.href); }
  });
  try {
    const rows = scoreRows(practice, await submissionsForPractice(practice));
    $('#scoreBody').innerHTML = rows.map((row, i) => `<tr><td class="rank">${i + 1}</td><td class="user">${escapeHtml(row.user)}</td>${row.cells.map(cellHtml).join('')}<td class="total">${row.solved}</td><td class="total">${row.penalty || '—'}</td></tr>`).join('');
  } catch (error) { $('#scoreBody').innerHTML = `<tr><td colspan="${practice.problems.length + 5}" style="color:#c84d30;padding:25px">스코어보드를 불러오지 못했습니다: ${escapeHtml(error.message)}</td></tr>`; }
  clearInterval(refreshTimer); refreshTimer = setInterval(() => showPractice(id), 60000);
}

$('#newPracticeButton').addEventListener('click', openDialog); $('#emptyCreateButton').addEventListener('click', openDialog);
$('#closeDialog').addEventListener('click', () => $('#practiceDialog').close()); $('#cancelDialog').addEventListener('click', () => $('#practiceDialog').close());
$('#practiceForm').addEventListener('submit', createPractice);
$('#minDifficulty').addEventListener('input', updateDifficultyColors);
$('#maxDifficulty').addEventListener('input', updateDifficultyColors);
seedDates(); updateDifficultyColors(); renderList();
loadSharedPractices();
