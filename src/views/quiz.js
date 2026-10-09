import { app, on } from '../app.js'
import { N } from '../data.js'
import { S, save, recordAnswer, recordTest } from '../state.js'
import { loadBank } from '../quiz/bank.js'
import { KIND } from '../quiz/make.js'
import { resolveSet, buildRound } from '../quiz/sets.js'
import { esc, href, I, bar, ring, empty } from '../ui.js'

// One round at a time, kept while the tab is open.
let Q = { key: null, set: null, qs: [], i: 0, score: 0, wrong: [], picked: null }

function answer(k) {
  const q = Q.qs[Q.i]
  if (!q || Q.picked !== null || !q.opts[k]) return
  Q.picked = k
  const ok = k === q.answer
  if (ok) Q.score++
  else Q.wrong.push({ q, picked: k })
  recordAnswer(N[q.note].u, q.note, q.id, ok)
  if (Q.i + 1 === Q.qs.length) finishRound()
  app.refresh()
}
function next() {
  if (Q.picked === null) return
  Q.i++
  Q.picked = null
  app.refresh().then(() => scrollTo(0, 0))
}
/** Scores that outlive the round: fixed tests keep their best, the daily round is marked as done. */
function finishRound() {
  const percent = Math.round((Q.score / Q.qs.length) * 100)
  if (Q.set.test) recordTest(Q.set.test, percent)
  if (Q.set.daily === S.daily.d) {
    Object.assign(S.daily, { s: Q.score, n: Q.qs.length })
    save()
  }
}
on('q-pick', (k) => answer(Number(k)))
on('q-next', next)
on('q-new', () => {
  Q.key = null
  app.refresh().then(() => scrollTo(0, 0))
})

const optionButton = (q, k, answered) => {
  const right = answered && k === q.answer
  const wrong = answered && k === Q.picked && !right
  return (
    `<button class="opt big${right ? ' right' : wrong ? ' wrong' : ''}" data-act="q-pick" data-a="${k}"${answered ? ' disabled' : ''}>` +
    `<span class="opt-k">${'ABCD'[k]}</span><span class="opt-t">${q.opts[k]}</span>${right ? I.check : wrong ? I.close : ''}</button>`
  )
}

function resultPage(set) {
  const total = Q.qs.length
  const p = Math.round((Q.score / total) * 100)
  const verdict = p === 100 ? 'Hoàn hảo!' : p >= 80 ? 'Rất tốt!' : p >= 50 ? 'Khá ổn, ôn thêm chút nữa' : 'Cần ôn lại phần này'
  const best = set.test ? S.tests[set.test]?.best : null
  return (
    `<div class="practice"><div class="result-card">${ring(p, { size: 96, stroke: 8, label: `${p}%` })}` +
    `<h1>${verdict}</h1><p class="muted">Đúng ${Q.score}/${total} câu · ${esc(set.label)}${best != null ? ` · cao nhất ${best}%` : ''}</p>` +
    `<div class="stack"><button class="btn primary" data-act="q-new">${I.redo}${set.fixed ? 'Làm lại' : 'Làm bộ câu khác'}</button>` +
    `<a class="btn ghost" href="${set.back}">${set.backLabel}</a></div></div>` +
    (Q.wrong.length
      ? `<section class="block"><h2>Cần xem lại</h2>` +
        Q.wrong
          .map(
            ({ q, picked }) =>
              `<div class="fix"><p class="fix-q">${q.stem || q.ask}</p>` +
              `<p class="fix-x"><span class="x">✗</span><span>${q.opts[picked]}</span></p>` +
              `<p class="fix-v"><span class="v">✓</span><span>${q.opts[q.answer]}</span></p>` +
              `<a class="fix-link" href="${href('n', q.note)}">${esc(q.note)}${I.next}</a></div>`,
          )
          .join('') +
        `</section>`
      : '') +
    `</div>`
  )
}

export async function quiz({ arg }, fresh) {
  const bank = await loadBank()
  const set = resolveSet(arg || '', bank)
  if (!set) return null
  if (Q.key !== set.key || !Q.qs.length || (fresh && Q.i >= Q.qs.length)) Q = { key: set.key, set, qs: buildRound(set, bank), i: 0, score: 0, wrong: [], picked: null }
  const base = { title: `Quiz · ${set.label}`, context: `Quiz · ${set.label}`, up: set.back, tab: set.tab, unit: set.unit?.id, mode: 'focus' }

  if (!Q.qs.length) {
    return {
      ...base,
      html:
        `<div class="practice">` +
        empty(
          set.empty || `<b>${esc(set.label)}</b> chưa có câu hỏi nào.`,
          (set.unit ? `<a class="btn primary" href="${href('fc', set.unit.id)}">${I.cards}Học flashcard</a>` : `<a class="btn primary" href="${href('quiz', 'me-daily')}">${I.quiz}Ôn hôm nay</a>`) +
            `<a class="btn" href="${set.back}">${set.backLabel}</a>`,
        ) +
        `</div>`,
    }
  }

  const total = Q.qs.length
  if (Q.i >= total) return { ...base, html: resultPage(Q.set) }

  const q = Q.qs[Q.i]
  const answered = Q.picked !== null
  const ok = answered && Q.picked === q.answer
  const last = Q.i + 1 >= total
  return {
    ...base,
    html:
      `<div class="practice quiz-page">` +
      `<div class="p-top"><a class="icon-btn p-close" href="${set.back}" aria-label="Thoát">${I.close}</a>` +
      `<span class="p-count">Câu ${Q.i + 1}/${total}</span>${bar(Math.round(((Q.i + (answered ? 1 : 0)) / total) * 100))}` +
      `<span class="p-score">${I.check}${Q.score}</span></div>` +
      `<p class="q-kind">${KIND[q.kind]}</p><h1 class="q-ask">${q.ask}</h1>` +
      (q.stem ? `<p class="q-stem">${q.stem}</p>` : '') +
      `<div class="q-opts">${q.opts.map((_, k) => optionButton(q, k, answered)).join('')}</div>` +
      (answered
        ? `<div class="q-fb ${ok ? 'ok' : 'no'}" role="status"><b>${ok ? 'Chính xác!' : 'Chưa đúng'}</b>` +
          (q.explain ? `<div class="q-why">${q.explain}</div>` : '') +
          `<a href="${href('n', q.note)}">Xem bài: ${esc(q.note)}</a></div>`
        : '') +
      `<div class="p-bar">` +
      (answered
        ? `<button class="btn primary grow" id="qNext" data-act="q-next">${last ? 'Xem kết quả' : 'Câu tiếp'}${I.next}</button>`
        : `<span class="p-hint">Chọn một đáp án</span>`) +
      `</div></div>`,
    mount: (root) => void root.querySelector('#qNext')?.focus({ preventScroll: true }),
    keys(e) {
      const k = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()]
      if (k != null) answer(k)
    },
  }
}
