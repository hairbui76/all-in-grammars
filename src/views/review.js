import { app, on } from '../app.js'
import { confirmDialog } from '../confirm.js'
import { U, N, PATHS, unitById, totalDone, quizCount, missedNotes } from '../data.js'
import { S, accuracy, resetAll, dayKey } from '../state.js'
import { loadBank } from '../quiz/bank.js'
import { EXAM_PARTS, TEST_COUNT, TEST_SIZE, resolveSet } from '../quiz/sets.js'
import { esc, href, I, bar, ring } from '../ui.js'

on('reset-all', async () => {
  const a = accuracy()
  const ok = await confirmDialog({
    title: 'Xoá toàn bộ tiến độ?',
    body: `Xoá ${totalDone()} bài đã đánh dấu${a ? `, kết quả ${a.t} câu quiz` : ''}, điểm các đề, thẻ đã thuộc và chuỗi ngày học. Nội dung bài học giữ nguyên. Không hoàn tác được.`,
    yes: 'Xoá tất cả',
  })
  if (!ok) return
  resetAll()
  app.refresh()
})

/** A quiz set as a tile: name, what it covers, how much there is. */
const tile = (key, icon, label, hint, count, dim = false) =>
  `<a class="tile${dim ? ' dim' : ''}" href="${href('quiz', key)}">${icon}<b>${label}</b><span>${hint}</span><small>${count}</small></a>`

export async function review() {
  const bank = await loadBank()
  const a = accuracy()
  const missed = missedNotes()
  const known = Object.keys(S.known).filter((t) => N[t]).length
  const size = (key) => resolveSet(key, bank).items.length

  const doneToday = S.daily.d === dayKey() && S.daily.n
  const bad = size('me-bad')
  const learnt = size('me-learnt')
  const untried = U.reduce((c, u) => c + u.n.filter((t) => N[t].qn && !S.tried[t]).length, 0)

  const mine =
    `<section class="block"><h2>Của bạn</h2><div class="sets">` +
    tile('me-daily', I.play, 'Ôn hôm nay', 'Mười câu, ưu tiên câu từng sai và bài đã học', doneToday ? `Đã làm: ${S.daily.s}/${S.daily.n}` : '10 câu') +
    tile('me-bad', I.redo, 'Câu từng sai', 'Làm lại đúng những câu bạn đã chọn sai', bad ? `${bad} câu` : 'Chưa có', !bad) +
    tile('me-learnt', I.check, 'Bài đã học', 'Chỉ hỏi về các bài bạn đã đánh dấu', learnt ? `${learnt} câu` : 'Chưa có', !learnt) +
    tile('me-new', I.book, 'Bài chưa làm quiz', 'Những bài bạn chưa trả lời câu nào', untried ? `${untried} bài` : 'Hết rồi', !untried) +
    `</div></section>`

  const exam =
    `<section class="block"><h2>Theo dạng bài thi</h2><div class="sets">` +
    EXAM_PARTS.map((p) => tile(`x-${p.id}`, I.quiz, p.label, p.hint, `${size(`x-${p.id}`)} câu`)).join('') +
    `</div></section>`

  const tests =
    `<section class="block"><h2>Đề cố định</h2><p class="muted block-note">Mỗi đề ${TEST_SIZE} câu trộn đủ dạng. Nội dung không đổi, nên làm lại để so điểm được.</p><div class="tests">` +
    Array.from({ length: TEST_COUNT }, (_, i) => {
      const t = S.tests[i + 1]
      return `<a class="test${t ? ' taken' : ''}" href="${href('quiz', `t-${i + 1}`)}"><b>Đề ${i + 1}</b><span>${t ? `${t.best}%` : 'Chưa làm'}</span></a>`
    }).join('') +
    `</div></section>`

  const paths =
    `<section class="card"><h2>Theo lộ trình</h2><div class="rows">` +
    PATHS.map((p, i) => `<a class="rowlink" href="${href('quiz', `p-${i}`)}"><span>${esc(p.title)}<small>${p.units.map((id) => unitById(id).t).join(' · ')}</small></span><span class="pill">${size(`p-${i}`)} câu</span></a>`).join('') +
    `</div></section>`

  // units with quiz attempts first, weakest at the top
  const rows = U.map((u) => ({ u, a: accuracy(u.id), n: quizCount(u) })).sort(
    (x, y) => (x.a ? x.a.p : 101) - (y.a ? y.a.p : 101) || x.u.id - y.u.id,
  )
  const byUnit =
    `<section class="card"><h2>Theo chuyên đề</h2><div class="rows">` +
    rows
      .map(
        ({ u, a: ua, n }) =>
          `<div class="urow"><a class="urow-t" href="${href('quiz', `u-${u.id}`)}"><b>${esc(u.t)}</b>` +
          (ua ? `<span class="urow-a">${bar(ua.p)}<small>${ua.p}% · ${ua.t} câu đã làm</small></span>` : `<small>${n} câu · chưa làm</small>`) +
          `</a><a class="mini" href="${href('fc', u.id)}" aria-label="Flashcard ${esc(u.t)}">${I.cards}</a>` +
          `<a class="mini" href="${href('quiz', `u-${u.id}`)}" aria-label="Quiz ${esc(u.t)}">${I.quiz}</a></div>`,
      )
      .join('') +
    `</div></section>`

  const html =
    `<div class="page wide"><header class="phead"><h1>Ôn tập</h1>` +
    `<p class="muted">${bank.items.length.toLocaleString('vi-VN')} câu hỏi, sinh từ nội dung các bài học.</p></header>` +
    `<div class="review-grid"><div class="review-main">` +
    `<section class="card score">${ring(a ? a.p : 0, { size: 84, stroke: 8, label: a ? `${a.p}%` : '—' })}<div class="score-b">` +
    (a
      ? `<b>Đúng ${a.ok} / ${a.t} câu</b><span class="muted">Sai ${a.no} câu · ${known} thẻ đã thuộc</span>`
      : `<b>Chưa làm câu quiz nào</b><span class="muted">Bắt đầu với "Ôn hôm nay" để xem tỉ lệ đúng ở đây.</span>`) +
    `</div></section>${mine}${exam}${tests}</div>` +
    `<div class="review-side">${paths}` +
    (missed.length
      ? `<section class="card"><h2>Bài hay sai</h2><div class="rows">` +
        missed
          .slice(0, 6)
          .map(([t, c]) => `<a class="rowlink" href="${href('n', t)}"><span>${esc(t)}<small>${esc(unitById(N[t].u).t)}</small></span><span class="pill bad">sai ${c} câu</span></a>`)
          .join('') +
        `</div></section>`
      : '') +
    `${byUnit}</div></div>` +
    `<div class="danger-zone"><button class="btn ghost danger" data-act="reset-all">${I.redo}Xoá toàn bộ tiến độ</button></div></div>`

  return { title: 'Ôn tập', tab: 'review', html }
}
