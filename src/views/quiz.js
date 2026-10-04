import { app, on } from '../app.js'
import { N, unitById } from '../data.js'
import { S, recordAnswer, workOffMiss } from '../state.js'
import { esc, href, shuffle, I, bar, ring, empty } from '../ui.js'

// One quiz at a time, kept while the tab is open.
let Q = { id: null, items: [], i: 0, score: 0, wrong: [], picked: null }

/** What a quiz route covers: a unit id, 'all', or 'miss' (lessons answered wrongly before). */
function scope(key) {
  if (key === 'all') return { label: 'Quiz nhanh', notes: Object.keys(N), size: 10, back: '#/', backLabel: 'Về trang chủ', tab: 'review' }
  if (key === 'miss')
    return { label: 'Ôn câu sai', notes: Object.keys(S.miss).filter((t) => N[t]), size: 20, back: '#/review', backLabel: 'Về Ôn tập', tab: 'review' }
  const u = unitById(key)
  return u && { label: u.t, notes: u.n, size: 20, back: href('u', u.id), backLabel: 'Về chuyên đề', tab: 'units', unit: u }
}

function start(id, sc) {
  const items = []
  for (const t of sc.notes) for (const [bad, good, why] of N[t].q) items.push({ note: t, bad, good, why, opts: shuffle([bad, good]) })
  Q = { id, items: shuffle(items).slice(0, sc.size), i: 0, score: 0, wrong: [], picked: null }
}

function answer(k) {
  const it = Q.items[Q.i]
  if (!it || Q.picked !== null || !it.opts[k]) return
  Q.picked = k
  const ok = it.opts[k] === it.good
  if (ok) Q.score++
  else Q.wrong.push(it)
  if (ok && app.route.arg === 'miss') workOffMiss(it.note)
  recordAnswer(N[it.note].u, it.note, ok)
  app.refresh()
}
function next() {
  if (Q.picked === null) return
  Q.i++
  Q.picked = null
  app.refresh().then(() => scrollTo(0, 0))
}
on('q-pick', (k) => answer(Number(k)))
on('q-next', next)
on('q-new', () => {
  Q.id = null
  app.refresh().then(() => scrollTo(0, 0))
})

function resultPage(sc) {
  const total = Q.items.length
  const p = Math.round((Q.score / total) * 100)
  const verdict = p === 100 ? 'Hoàn hảo!' : p >= 80 ? 'Rất tốt!' : p >= 50 ? 'Khá ổn, ôn thêm chút nữa' : 'Cần ôn lại phần này'
  return (
    `<div class="practice"><div class="result-card">${ring(p, { size: 96, stroke: 8, label: `${p}%` })}` +
    `<h1>${verdict}</h1><p class="muted">Đúng ${Q.score}/${total} câu · ${esc(sc.label)}</p>` +
    `<div class="stack"><button class="btn primary" data-act="q-new">${I.redo}Làm lại</button>` +
    `<a class="btn ghost" href="${sc.back}">${sc.backLabel}</a></div></div>` +
    (Q.wrong.length
      ? `<section class="block"><h2>Cần xem lại</h2>` +
        Q.wrong
          .map(
            (w) =>
              `<div class="fix"><p class="fix-x"><span class="x">✗</span><span>${esc(w.bad)}</span></p>` +
              `<p class="fix-v"><span class="v">✓</span><span>${esc(w.good)}</span></p>` +
              `<a class="fix-link" href="${href('n', w.note)}">${esc(w.note)}${I.next}</a></div>`,
          )
          .join('') +
        `</section>`
      : '') +
    `</div>`
  )
}

export function quiz({ arg }, fresh) {
  const sc = scope(arg)
  if (!sc) return null
  const id = arg
  if (Q.id !== id || !Q.items.length || (fresh && Q.i >= Q.items.length)) start(id, sc)
  const base = { title: `Quiz · ${sc.label}`, context: `Quiz · ${sc.label}`, up: sc.back, tab: sc.tab, unit: sc.unit?.id, mode: 'focus' }

  if (!Q.items.length) {
    return {
      ...base,
      html:
        `<div class="practice">` +
        empty(
          arg === 'miss'
            ? 'Chưa có câu sai nào cần ôn. Làm quiz, câu nào sai sẽ được gom về đây.'
            : `<b>${esc(sc.label)}</b> chưa có câu quiz: các bài ở đây là bảng tra cứu, không có mục “Lỗi thường gặp”.`,
          (sc.unit ? `<a class="btn primary" href="${href('fc', sc.unit.id)}">${I.cards}Học flashcard</a>` : '') +
            (arg === 'miss' ? `<a class="btn primary" href="${href('quiz', 'all')}">${I.quiz}Làm quiz nhanh</a>` : '') +
            `<a class="btn" href="${sc.back}">${sc.backLabel}</a>`,
        ) +
        `</div>`,
    }
  }

  const total = Q.items.length
  if (Q.i >= total) return { ...base, html: resultPage(sc) }

  const it = Q.items[Q.i]
  const answered = Q.picked !== null
  const ok = answered && it.opts[Q.picked] === it.good
  return {
    ...base,
    html:
      `<div class="practice quiz-page">` +
      `<div class="p-top"><a class="icon-btn p-close" href="${sc.back}" aria-label="Thoát">${I.close}</a>` +
      `<span class="p-count">Câu ${Q.i + 1}/${total}</span>${bar(Math.round(((Q.i + (answered ? 1 : 0)) / total) * 100))}` +
      `<span class="p-score">${I.check}${Q.score}</span></div>` +
      `<h1 class="q-ask">Câu nào đúng ngữ pháp?</h1><div class="q-opts">` +
      it.opts
        .map((o, k) => {
          const right = answered && o === it.good
          const wrong = answered && k === Q.picked && !right
          return (
            `<button class="opt big${right ? ' right' : wrong ? ' wrong' : ''}" data-act="q-pick" data-a="${k}"${answered ? ' disabled' : ''}>` +
            `<span class="opt-k">${'AB'[k]}</span><span class="opt-t">${esc(o)}</span>${right ? I.check : wrong ? I.close : ''}</button>`
          )
        })
        .join('') +
      `</div>` +
      (answered
        ? `<div class="q-fb ${ok ? 'ok' : 'no'}" role="status"><b>${ok ? 'Chính xác!' : 'Chưa đúng'}</b>` +
          (it.why ? `<span>${esc(it.why)}</span>` : '') +
          `<a href="${href('n', it.note)}">Xem bài: ${esc(it.note)}</a></div>`
        : '') +
      `<div class="p-bar">` +
      (answered
        ? `<button class="btn primary grow" id="qNext" data-act="q-next">${Q.i + 1 >= total ? 'Xem kết quả' : 'Câu tiếp'}${I.next}</button>`
        : `<span class="p-hint">Chọn một đáp án</span>`) +
      `</div></div>`,
    mount: (root) => void root.querySelector('#qNext')?.focus({ preventScroll: true }),
    keys(e) {
      if (e.key === '1' || e.key === '2' || e.key === 'a' || e.key === 'b') answer({ 1: 0, 2: 1, a: 0, b: 1 }[e.key])
    },
  }
}
