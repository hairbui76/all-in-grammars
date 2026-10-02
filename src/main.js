import './style.css'
import { U, N, META, unitById, unitOfNote, loadUnit, loadSearch } from './data.js'
import { S, save, resetAll, resetUnit, recordAnswer, accuracy, effectiveTheme } from './state.js'
import { ICON } from './icons.js'

const APP = 'Học Ngữ pháp Tiếng Anh'
const main = document.getElementById('main')
const side = document.getElementById('side')
const titleEl = document.getElementById('title')
const fab = document.getElementById('fab')
const menuBtn = document.getElementById('mBtn')

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/')
const pad = (n) => String(n).padStart(2, '0')
const doneIn = (u) => u.n.reduce((c, t) => c + (S.done[t] ? 1 : 0), 0)
const pct = (u) => (u.n.length ? Math.round((doneIn(u) / u.n.length) * 100) : 0)
const totalDone = () => Object.keys(S.done).reduce((c, t) => c + (S.done[t] && N[t] ? 1 : 0), 0)

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function setTitle(t) {
  titleEl.textContent = t
  document.title = t === APP ? APP : `${t} · ${APP}`
}

/* ================= theme ================= */
function applyTheme() {
  const t = effectiveTheme()
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#1a201c' : '#1b4332'
}
document.getElementById('tBtn').onclick = () => {
  S.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'
  save()
  applyTheme()
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
applyTheme()

/* ================= sidebar ================= */
function ring(p) {
  const r = 10.6
  const c = 2 * Math.PI * r
  return (
    `<svg class="ring" viewBox="0 0 26 26" aria-hidden="true"><circle class="bgc" cx="13" cy="13" r="${r}"/>` +
    // no arc at 0%: the round line cap would still paint a dot
    (p ? `<circle class="fgc" cx="13" cy="13" r="${r}" stroke-dasharray="${((c * p) / 100).toFixed(1)} ${c.toFixed(1)}"/>` : '') +
    '</svg>'
  )
}
function buildSide() {
  const active = route.view === 'n' ? N[route.arg]?.u : ['u', 'fc', 'quiz'].includes(route.view) ? Number(route.arg) : null
  let h = ''
  let g = null
  for (const u of U) {
    if (u.g !== g) {
      g = u.g
      h += `<div class="sgroup">${esc(g)}</div>`
    }
    h +=
      `<a class="uitem${active === u.id ? ' on' : ''}" href="${href('u', u.id)}"${active === u.id ? ' aria-current="true"' : ''}>` +
      `<span class="num">${u.id}</span>` +
      `<span class="tx">${esc(u.t)}<small>${esc(u.vn)} · ${u.n.length} bài</small></span>${ring(pct(u))}</a>`
  }
  side.innerHTML = h
}
function setNav(open) {
  document.body.classList.toggle('nav', open)
  menuBtn.setAttribute('aria-expanded', String(open))
}
menuBtn.onclick = () => setNav(!document.body.classList.contains('nav'))
document.getElementById('scrim').onclick = () => setNav(false)

/* ================= router ================= */
let route = { view: 'home', arg: null }
let token = 0 // bumped on every render so stale async views can bail out

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map((p) => {
    try {
      return decodeURIComponent(p)
    } catch {
      return p
    }
  })
  return { view: parts[0] || 'home', arg: parts[1] ?? null }
}

function render() {
  token++
  fab.innerHTML = ''
  buildSide()
  const { view, arg } = route
  if (view === 'home') return home()
  if (view === 'u') return unitView(arg)
  if (view === 'n') return noteView(arg)
  if (view === 'search') return searchView()
  if (view === 'fc') return fcView(arg)
  if (view === 'quiz') return quizView(arg)
  notFound()
}

// Link clicks start at the top of the new page; back/forward return to where the reader was.
const scrollPos = new Map()
let viaLink = false
let currentHash = location.hash
history.scrollRestoration = 'manual'
addEventListener('scroll', () => scrollPos.set(currentHash, scrollY), { passive: true })
addEventListener('hashchange', async () => {
  currentHash = location.hash
  route = parseRoute()
  setNav(false)
  closeModal()
  // arriving at a finished session starts a new one instead of showing the old result
  if (FC.i >= FC.list.length) FC.unit = null
  if (Q.i >= Q.items.length) Q.key = null
  const y = viaLink ? 0 : scrollPos.get(currentHash) || 0
  viaLink = false
  await render()
  scrollTo(0, y)
})

function notFound() {
  setTitle(APP)
  main.innerHTML =
    `<div class="empty">Không tìm thấy trang này.` +
    `<div class="tools" style="justify-content:center;margin-top:16px"><a class="btn pri" href="#/"><span>Về trang chủ</span></a></div></div>`
}

/* ================= home ================= */
function home() {
  setTitle(APP)
  const done = totalDone()
  const p = Math.round((done / META.total) * 100)
  let h =
    `<div class="hero"><h2>Ngữ pháp Tiếng Anh</h2>` +
    `<p>${META.total} bài học · ${U.length} chuyên đề · rút từ <i>${esc(META.book)}</i></p>` +
    `<div class="pbar"><i style="width:${p}%"></i></div>` +
    `<div class="stat"><span>Đã học <b>${done}</b>/${META.total} bài (${p}%)</span><span>${META.quiz} câu quiz</span></div></div>`

  h += '<div class="tools">'
  if (S.last && N[S.last]) h += `<a class="btn pri" href="${href('n', S.last)}">${ICON.read}<span>Học tiếp: ${esc(S.last)}</span></a>`
  h +=
    `<a class="btn" href="${href('quiz', 'all')}">${ICON.quiz}<span>Quiz tổng hợp</span></a>` +
    `<button class="btn" data-act="reset" data-a="all">${ICON.reset}<span>Học lại từ đầu</span></button></div>`

  const a = accuracy()
  h += '<div class="stats"><h4>Kết quả luyện tập</h4>'
  if (a) {
    h +=
      `<div class="sub">Đã trả lời ${a.t} câu quiz</div>` +
      `<div class="split"><i class="ok" style="width:${a.p}%"></i><i class="no" style="width:${100 - a.p}%"></i></div>` +
      `<div class="legend"><span><i class="dot ok"></i>Đúng <b>${a.p}%</b> (${a.ok} câu)</span>` +
      `<span><i class="dot no"></i>Sai <b>${100 - a.p}%</b> (${a.no} câu)</span></div>`
    const missed = Object.entries(S.miss).filter(([t]) => N[t]).sort((x, y) => y[1] - x[1])
    if (missed.length) {
      h += '<div class="revlist"><div class="rh">Cần ôn lại</div>'
      for (const [t, c] of missed.slice(0, 5))
        h += `<a class="revrow" href="${href('n', t)}">${esc(t)}<span class="cnt">sai ${c}×</span></a>`
      h += `<div class="tools" style="margin:10px 0 0"><a class="btn" href="${href('quiz', 'miss')}">${ICON.quiz}<span>Luyện lại câu hay sai</span></a></div></div>`
    }
  } else {
    h += '<div class="sub">Chưa làm câu quiz nào. Mở một chuyên đề rồi bấm <b>Quiz</b> để bắt đầu — kết quả đúng/sai sẽ hiện ở đây.</div>'
  }
  h += '</div>'

  let g = null
  U.forEach((u, i) => {
    if (u.g !== g) {
      g = u.g
      h += `<div class="sect-h">${esc(g)}</div><div class="grid">`
    }
    const p2 = pct(u)
    h +=
      `<a class="card" href="${href('u', u.id)}"><h3><b>${pad(u.id)}</b>${esc(u.t)}</h3>` +
      `<div class="vn">${esc(u.vn)}</div><div class="mini"><i style="width:${p2}%"></i></div>` +
      `<div class="meta"><span>${doneIn(u)}/${u.n.length} bài</span><span>${p2}%</span></div></a>`
    if (U[i + 1]?.g !== u.g) h += '</div>'
  })
  main.innerHTML = h
}

/* ================= unit ================= */
function noteRow(title, extra = '') {
  const n = N[title]
  const done = !!S.done[title]
  return (
    `<div class="nrow${done ? ' done' : ''}">` +
    `<button class="chk" data-act="chk" data-a="${esc(title)}" aria-pressed="${done}" aria-label="Đánh dấu đã học: ${esc(title)}">${ICON.check}</button>` +
    `<a class="body" href="${href('n', title)}">${extra || `<b>${esc(title)}</b><span>${esc(n.ab)}</span>`}</a></div>`
  )
}

function unitView(id) {
  const u = unitById(id)
  if (!u) return notFound()
  setTitle(u.t)
  const d = doneIn(u)
  const ua = accuracy(u.id)
  let h =
    `<div class="uhead"><div class="kicker">Chuyên đề ${pad(u.id)} · ${esc(u.g)}</div>` +
    `<h2>${esc(u.t)}</h2><p>${esc(u.vn)} — ${esc(u.desc || '')}</p></div>` +
    `<div class="pbar" style="background:var(--surface2);height:7px"><i style="width:${pct(u)}%;background:var(--accent2)"></i></div>` +
    `<div class="tools">` +
    `<a class="btn pri" href="${href('fc', u.id)}">${ICON.card}<span>Flashcard</span></a>` +
    `<a class="btn" href="${href('quiz', u.id)}">${ICON.quiz}<span>Quiz</span></a>` +
    `<button class="btn" data-act="mark" data-a="${u.id}">${ICON.check}<span>${d === u.n.length ? 'Bỏ đánh dấu' : 'Đánh dấu hết'}</span></button>` +
    `<button class="btn" data-act="reset" data-a="${u.id}">${ICON.reset}<span>Học lại</span></button></div>` +
    `<div class="uacc"><span>Đã học <b>${d}/${u.n.length}</b> bài</span>` +
    (ua
      ? `<span>Quiz: đúng <b>${ua.p}%</b> · sai <b>${100 - ua.p}%</b> (${ua.t} câu)</span>`
      : '<span style="color:var(--ink3)">Chưa làm quiz chuyên đề này</span>') +
    `</div><div class="nlist" style="margin-top:12px">`
  for (const t of u.n) h += noteRow(t)
  main.innerHTML = h + '</div>'
}

/* ================= lesson ================= */
/** Loads a unit's lessons, showing a placeholder if it takes a while. Resolves to null when the view went stale or failed. */
async function unitChunk(u) {
  const my = token
  const slow = setTimeout(() => {
    if (my === token) main.innerHTML = '<div class="loading">Đang tải…</div>'
  }, 250)
  try {
    const chunk = await loadUnit(u.id)
    return my === token ? chunk : null
  } catch {
    if (my === token)
      main.innerHTML =
        `<div class="empty">Không tải được nội dung. Kiểm tra kết nối mạng rồi thử lại.` +
        `<div class="tools" style="justify-content:center;margin-top:16px"><button class="btn pri" data-act="retry"><span>Thử lại</span></button></div></div>`
    return null
  } finally {
    clearTimeout(slow)
  }
}

async function noteView(title) {
  const n = N[title]
  if (!n) return notFound()
  const u = unitById(n.u)
  setTitle(title)
  if (S.last !== title) {
    S.last = title
    save()
  }
  const chunk = await unitChunk(u)
  if (!chunk) return
  const body = chunk[title]
  const idx = u.n.indexOf(title)
  const prev = u.n[idx - 1]
  const next = u.n[idx + 1]
  const done = !!S.done[title]
  main.innerHTML =
    `<article class="note"><div class="crumb"><a href="${href('u', u.id)}">${esc(u.t)}</a> · bài ${idx + 1}/${u.n.length}</div>` +
    `<h2>${esc(title)}</h2>` +
    (n.al.length ? `<div class="alias">${esc(n.al.join(' · '))}</div>` : '') +
    `<div class="doc">${body.h}</div>` +
    (body.src ? `<div class="srcline">Nguồn: ${esc(body.src)}</div>` : '') +
    `</article>` +
    `<div class="tools narrow"><button class="btn ${done ? '' : 'pri'}" data-act="chk" data-a="${esc(title)}" aria-pressed="${done}">` +
    `${ICON.check}<span>${done ? 'Đã học ✓ (bỏ đánh dấu)' : 'Đánh dấu đã học'}</span></button>` +
    `<a class="btn" href="${href('fc', u.id)}">${ICON.card}<span>Flashcard</span></a>` +
    (n.q.length ? `<a class="btn" href="${href('quiz', u.id)}">${ICON.quiz}<span>Quiz</span></a>` : '') +
    `</div><div class="navfoot">` +
    (prev ? `<a class="btn" href="${href('n', prev)}">${ICON.back}<span>${esc(prev)}</span></a>` : '') +
    (next
      ? `<a class="btn" href="${href('n', next)}"><span>${esc(next)}</span>${ICON.next}</a>`
      : `<a class="btn" href="${href('u', u.id)}"><span>Xong chuyên đề</span>${ICON.next}</a>`) +
    `</div>`
  fab.innerHTML = `<button data-act="top" aria-label="Lên đầu trang">${ICON.up}</button>`
}

/* ================= search ================= */
let sq = ''
let searchText = null
function searchView() {
  setTitle('Tìm kiếm')
  main.innerHTML =
    `<div class="searchwrap"><input class="sinput" id="sIn" type="search" autocomplete="off" aria-label="Tìm kiếm" ` +
    `placeholder="Tìm quy tắc, cấu trúc, ví dụ…" value="${esc(sq)}"></div><div id="sRes" aria-live="polite"></div>`
  const inp = document.getElementById('sIn')
  inp.focus()
  inp.addEventListener('input', () => {
    sq = inp.value
    runSearch()
  })
  if (!searchText) {
    const my = token
    loadSearch().then(
      (t) => {
        searchText = t
        if (my === token) runSearch()
      },
      () => {},
    )
  }
  runSearch()
}
function runSearch() {
  const box = document.getElementById('sRes')
  if (!box) return
  const q = sq.trim().toLowerCase()
  if (q.length < 2) {
    box.innerHTML = '<div class="hint">Gõ ít nhất 2 ký tự. Tìm được cả tên bài, tên tiếng Việt và nội dung ví dụ.</div>'
    return
  }
  const res = []
  for (const [t, n] of Object.entries(N)) {
    const u = unitById(n.u)
    const tl = t.toLowerCase()
    let sc = 0
    let pos = -1
    if (tl === q) sc = 100
    else if (tl.startsWith(q)) sc = 80
    else if (tl.includes(q)) sc = 60
    else if (n.al.some((a) => a.toLowerCase().includes(q))) sc = 50
    else if (u.vn.toLowerCase().includes(q)) sc = 45
    else if (u.t.toLowerCase().includes(q)) sc = 42
    else if (n.ab.toLowerCase().includes(q)) sc = 40
    else if (searchText && (pos = searchText[t].toLowerCase().indexOf(q)) > -1) sc = 20
    if (sc) res.push({ t, n, u, sc, pos })
  }
  res.sort((a, b) => b.sc - a.sc || a.t.localeCompare(b.t))
  if (!res.length) {
    box.innerHTML = `<div class="hint">${searchText ? `Không tìm thấy “${esc(sq)}”.` : 'Đang tìm trong nội dung bài…'}</div>`
    return
  }
  const rx = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig')
  const mark = (s) => esc(s).replace(rx, '<mark>$1</mark>')
  let h = `<div class="hint" style="padding:6px 2px 12px;text-align:left">${res.length} kết quả</div><div class="nlist">`
  for (const r of res.slice(0, 80)) {
    const sub = r.pos > -1 ? `…${searchText[r.t].substr(Math.max(0, r.pos - 45), 150)}…` : r.n.ab
    h += noteRow(r.t, `<b>${mark(r.t)}</b><span>${mark(sub)}</span><span class="where">${esc(r.u.t)} · ${esc(r.u.vn)}</span>`)
  }
  box.innerHTML = h + '</div>'
}

/* ================= flashcards ================= */
let FC = { unit: null, list: [], i: 0, flip: false }
async function fcView(id) {
  const u = unitById(id)
  if (!u) return notFound()
  setTitle(`Flashcard · ${u.t}`)
  if (FC.unit !== u.id) FC = { unit: u.id, list: shuffle(u.n.slice()), i: 0, flip: false }
  const chunk = await unitChunk(u)
  if (chunk) drawFC(u, chunk)
}
function drawFC(u, chunk) {
  if (FC.i >= FC.list.length) {
    main.innerHTML =
      `<div class="score"><div class="big">✓</div><p>Xong ${FC.list.length} thẻ của chuyên đề <b>${esc(u.t)}</b>.</p>` +
      `<div class="tools" style="justify-content:center"><button class="btn pri" data-act="fc-new">${ICON.card}<span>Học lại</span></button>` +
      `<a class="btn" href="${href('quiz', u.id)}">${ICON.quiz}<span>Làm quiz</span></a>` +
      `<a class="btn" href="${href('u', u.id)}"><span>Về chuyên đề</span></a></div></div>`
    return
  }
  const title = FC.list[FC.i]
  const { fc } = chunk[title]
  let back = ''
  if (fc.f) back += `<div class="form">${fc.f}</div>`
  if (fc.e.length) back += `<ul>${fc.e.map((e) => `<li>${e}</li>`).join('')}</ul>`
  if (!back) back = `<p>${esc(N[title].ab || 'Mở bài đọc để xem chi tiết.')}</p>`
  main.innerHTML =
    `<div class="fcwrap"><div class="fcprog">Thẻ ${FC.i + 1} / ${FC.list.length} · ${esc(u.t)}</div>` +
    `<div class="fc${FC.flip ? ' flip' : ''}" id="fcEl" data-act="fc-flip" role="button" tabindex="0" aria-label="Lật thẻ"><div class="fcin">` +
    `<div class="fcface"><div class="lbl">Khái niệm</div><h3>${esc(title)}</h3><p>${esc(N[title].ab)}</p>` +
    `<div class="tapme">Chạm để lật xem công thức &amp; ví dụ</div></div>` +
    `<div class="fcface back"><div class="lbl">Công thức &amp; ví dụ</div>${back}</div></div></div>` +
    `<div class="fcbtns"><button class="btn" data-act="fc" data-a="again">${ICON.back}<span>Chưa thuộc</span></button>` +
    `<button class="btn pri" data-act="fc" data-a="ok">${ICON.check}<span>Đã thuộc</span></button></div>` +
    `<div class="fcbtns"><a class="btn" href="${href('n', title)}">${ICON.read}<span>Đọc bài đầy đủ</span></a>` +
    `<a class="btn" href="${href('u', u.id)}"><span>Thoát</span></a></div></div>`
}

/* ================= quiz ================= */
// key is a unit id, 'all' (every unit) or 'miss' (lessons answered wrongly before)
let Q = { key: null, items: [], i: 0, score: 0, wrong: [], picked: null }
function quizScope(key) {
  if (key === 'all') return { label: 'Tổng hợp', notes: Object.keys(N), back: '#/', backLabel: 'Về trang chủ' }
  if (key === 'miss')
    return { label: 'Câu hay sai', notes: Object.keys(S.miss).filter((t) => N[t]), back: '#/', backLabel: 'Về trang chủ' }
  const u = unitById(key)
  return u && { label: u.t, notes: u.n, back: href('u', u.id), backLabel: 'Về chuyên đề', unit: u }
}
function newQuiz(key, scope) {
  const items = []
  for (const t of scope.notes)
    for (const [bad, good, why] of N[t].q) items.push({ note: t, bad, good, why, opts: shuffle([bad, good]) })
  Q = { key, items: shuffle(items).slice(0, 20), i: 0, score: 0, wrong: [], picked: null }
}
function quizView(key, fresh = false) {
  const scope = quizScope(key)
  if (!scope) return notFound()
  setTitle(`Quiz · ${scope.label}`)
  if (fresh || Q.key !== key || !Q.items.length) newQuiz(key, scope)

  if (!Q.items.length) {
    main.innerHTML =
      `<div class="empty">` +
      (key === 'miss'
        ? 'Chưa có câu nào cần luyện lại.'
        : `Chuyên đề <b>${esc(scope.label)}</b> chưa có câu quiz (các bài ở đây là bảng tra cứu, không có mục “Common mistakes”).`) +
      `<div class="tools" style="justify-content:center;margin-top:16px">` +
      (scope.unit ? `<a class="btn pri" href="${href('fc', scope.unit.id)}">${ICON.card}<span>Học flashcard</span></a>` : '') +
      `<a class="btn" href="${scope.back}"><span>${scope.backLabel}</span></a></div></div>`
    return
  }

  const total = Q.items.length
  if (Q.i >= total) {
    const p = Math.round((Q.score / total) * 100)
    let h =
      `<div class="qwrap"><div class="score"><div class="big">${p}%</div>` +
      `<p>Đúng ${Q.score}/${total} câu · sai ${total - Q.score} câu · ${esc(scope.label)}</p>` +
      `<div class="split" style="max-width:340px;margin:0 auto 10px"><i class="ok" style="width:${p}%"></i><i class="no" style="width:${100 - p}%"></i></div>` +
      `<div class="tools" style="justify-content:center"><button class="btn pri" data-act="quiz-new">${ICON.quiz}<span>Làm lại</span></button>` +
      `<a class="btn" href="${scope.back}"><span>${scope.backLabel}</span></a></div>`
    if (Q.wrong.length) {
      h += '<div class="wrongs"><div class="sect-h" style="margin-left:0">Cần xem lại</div>'
      for (const w of Q.wrong)
        h +=
          `<div class="wi"><a class="t" href="${href('n', w.note)}">${esc(w.note)} →</a>` +
          `<div><span class="x">✗</span> ${esc(w.bad)}</div><div><span class="v">✓</span> ${esc(w.good)}</div></div>`
      h += '</div>'
    }
    main.innerHTML = h + '</div></div>'
    return
  }

  const it = Q.items[Q.i]
  const answered = Q.picked !== null
  let h =
    `<div class="qwrap"><div class="qtop"><span>Câu ${Q.i + 1}/${total}</span><span>Điểm ${Q.score}</span></div>` +
    `<div class="qbar"><i style="width:${(Q.i / total) * 100}%"></i></div>` +
    `<div class="qcard"><div class="qq">Câu nào <b>đúng ngữ pháp</b>?</div>`
  it.opts.forEach((o, k) => {
    const right = answered && o === it.good
    const wrong = answered && k === Q.picked && !right
    h +=
      `<button class="opt${right ? ' right' : wrong ? ' wrong' : ''}" data-act="opt" data-a="${k}"${answered ? ' disabled' : ''}>` +
      `${esc(o)}${right ? '<span class="tick">✓</span>' : wrong ? '<span class="tick">✗</span>' : ''}</button>`
  })
  if (answered) {
    const ok = it.opts[Q.picked] === it.good
    h +=
      `<div class="qfb" role="status">${ok ? 'Chính xác.' : 'Chưa đúng.'} Bài liên quan: <a href="${href('n', it.note)}"><b>${esc(it.note)}</b></a>` +
      (it.why ? `<div class="why">${esc(it.why)}</div>` : '') +
      `<div style="margin-top:8px"><button class="btn pri" data-act="qnext" id="qNext" style="width:100%;justify-content:center">` +
      `<span>${Q.i + 1 >= total ? 'Xem kết quả' : 'Câu tiếp'}</span>${ICON.next}</button></div></div>`
  }
  main.innerHTML = h + '</div></div>'
  if (answered) document.getElementById('qNext').focus()
}
function answer(k) {
  const it = Q.items[Q.i]
  if (!it || Q.picked !== null || !it.opts[k]) return
  Q.picked = k
  const ok = it.opts[k] === it.good
  if (ok) Q.score++
  else Q.wrong.push(it)
  // getting a previously missed lesson right works it off the review list
  if (ok && Q.key === 'miss' && S.miss[it.note] && --S.miss[it.note] <= 0) delete S.miss[it.note]
  recordAnswer(N[it.note].u, it.note, ok)
  quizView(Q.key)
}

/* ================= confirm dialog ================= */
let modalReturn = null
function askReset(target) {
  const all = target === 'all'
  const u = all ? null : unitById(target)
  if (!all && !u) return
  let body
  if (all) {
    const a = accuracy()
    body =
      `Xoá toàn bộ tiến độ: ${totalDone()} bài đã đánh dấu` +
      (a ? `, kết quả quiz (${a.t} câu) và danh sách cần ôn lại` : '') +
      `. Nội dung bài học vẫn giữ nguyên, bạn chỉ bắt đầu lại từ con số 0.`
  } else {
    const ua = accuracy(u.id)
    body =
      `Xoá tiến độ của chuyên đề <b>${esc(u.t)}</b>: ${doneIn(u)}/${u.n.length} bài đã học` +
      (ua ? ` và ${ua.t} câu quiz đã làm` : '') +
      `. Các chuyên đề khác không đổi.`
  }
  closeModal()
  modalReturn = document.activeElement
  const m = document.createElement('div')
  m.className = 'modal'
  m.id = 'modal'
  m.innerHTML =
    `<div class="modalbox" role="alertdialog" aria-modal="true" aria-labelledby="mTitle">` +
    `<h3 id="mTitle">${all ? 'Học lại từ đầu?' : 'Học lại chuyên đề này?'}</h3><p>${body}</p><div class="row">` +
    `<button class="btn" data-act="modal-no"><span>Huỷ</span></button>` +
    `<button class="btn danger" data-act="modal-yes" data-a="${esc(target)}">${ICON.reset}<span>Xoá &amp; học lại</span></button></div></div>`
  document.body.appendChild(m)
  m.querySelector('[data-act="modal-no"]').focus()
}
function closeModal() {
  const m = document.getElementById('modal')
  if (!m) return
  m.remove()
  modalReturn?.focus?.()
  modalReturn = null
}

/* ================= events ================= */
const actions = {
  reset: (a) => askReset(a),
  'modal-no': () => closeModal(),
  'modal-yes': (a) => {
    closeModal()
    if (a === 'all') {
      resetAll()
      Q = { key: null, items: [], i: 0, score: 0, wrong: [], picked: null }
      FC = { unit: null, list: [], i: 0, flip: false }
    } else {
      const u = unitById(a)
      resetUnit(u)
      if (Q.key === String(u.id)) Q.key = null
    }
    render()
  },
  chk: (title) => {
    if (S.done[title]) delete S.done[title]
    else S.done[title] = 1
    save()
    if (route.view === 'search') {
      buildSide()
      runSearch()
    } else render()
  },
  mark: (id) => {
    const u = unitById(id)
    const all = doneIn(u) === u.n.length
    for (const t of u.n) {
      if (all) delete S.done[t]
      else S.done[t] = 1
    }
    save()
    render()
  },
  opt: (k) => answer(Number(k)),
  qnext: () => {
    Q.i++
    Q.picked = null
    quizView(Q.key)
    scrollTo(0, 0)
  },
  'quiz-new': () => quizView(route.arg, true),
  'fc-flip': () => {
    FC.flip = !FC.flip
    document.getElementById('fcEl')?.classList.toggle('flip', FC.flip)
  },
  fc: (a) => {
    const title = FC.list[FC.i]
    if (a === 'ok') {
      S.done[title] = 1
      save()
    } else FC.list.push(title)
    FC.i++
    FC.flip = false
    render()
  },
  'fc-new': () => {
    FC.unit = null
    render()
  },
  retry: () => render(),
  top: () => scrollTo({ top: 0, behavior: 'smooth' }),
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'modal') return closeModal()
  const link = e.target.closest('a[href^="#/"]')
  if (link) {
    // a link inside the flashcard should navigate, not flip the card
    viaLink = link.getAttribute('href') !== location.hash
    return
  }
  const el = e.target.closest('[data-act]')
  if (el) actions[el.dataset.act]?.(el.dataset.a)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal()
    setNav(false)
    return
  }
  if (e.target.matches('input, textarea') || document.getElementById('modal')) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '/') {
    e.preventDefault()
    viaLink = true
    location.hash = '#/search'
    return
  }
  if (route.view === 'fc') {
    const onCard = e.target.id === 'fcEl'
    if (e.key === ' ' || (e.key === 'Enter' && onCard)) {
      if (e.target.closest('button, a')) return
      e.preventDefault()
      actions['fc-flip']()
    }
    if (e.key === 'ArrowRight') main.querySelector('[data-act="fc"][data-a="ok"]')?.click()
    if (e.key === 'ArrowLeft') main.querySelector('[data-act="fc"][data-a="again"]')?.click()
  }
  if (route.view === 'quiz' && (e.key === '1' || e.key === '2')) answer(Number(e.key) - 1)
  if (route.view === 'n' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const u = unitOfNote(route.arg)
    const t = u?.n[u.n.indexOf(route.arg) + (e.key === 'ArrowRight' ? 1 : -1)]
    if (t) {
      viaLink = true
      location.hash = href('n', t)
    }
  }
})

route = parseRoute()
render()
