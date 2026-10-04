import { app, on } from '../app.js'
import { confirmDialog } from '../confirm.js'
import { U, N, unitById, totalDone, quizCount, missedNotes } from '../data.js'
import { S, accuracy, resetAll } from '../state.js'
import { esc, href, I, bar, ring } from '../ui.js'

on('reset-all', async () => {
  const a = accuracy()
  const ok = await confirmDialog({
    title: 'Xoá toàn bộ tiến độ?',
    body: `Xoá ${totalDone()} bài đã đánh dấu${a ? `, kết quả ${a.t} câu quiz` : ''}, thẻ đã thuộc và chuỗi ngày học. Nội dung bài học giữ nguyên. Không hoàn tác được.`,
    yes: 'Xoá tất cả',
  })
  if (!ok) return
  resetAll()
  app.refresh()
})

export function review() {
  const a = accuracy()
  const missed = missedNotes()
  const known = Object.keys(S.known).filter((t) => N[t]).length

  // units with quiz attempts first, weakest at the top
  const rows = U.map((u) => ({ u, a: accuracy(u.id), n: quizCount(u) })).sort(
    (x, y) => (x.a ? x.a.p : 101) - (y.a ? y.a.p : 101) || x.u.id - y.u.id,
  )

  const html =
    `<div class="page wide"><header class="phead"><h1>Ôn tập</h1><p class="muted">Kiểm tra lại những gì đã học.</p></header>` +
    `<div class="review-grid"><div class="review-main">` +
    `<section class="card score">${ring(a ? a.p : 0, { size: 84, stroke: 8, label: a ? `${a.p}%` : '—' })}<div class="score-b">` +
    (a
      ? `<b>Đúng ${a.ok} / ${a.t} câu</b><span class="muted">Sai ${a.no} câu · ${known} thẻ đã thuộc</span>`
      : `<b>Chưa làm câu quiz nào</b><span class="muted">Làm một bài quiz nhanh để xem tỉ lệ đúng ở đây.</span>`) +
    `</div></section>` +
    `<section class="quick two"><a class="tile" href="${href('quiz', 'all')}">${I.quiz}<b>Quiz nhanh</b><span>10 câu từ mọi chuyên đề</span></a>` +
    `<a class="tile${missed.length ? '' : ' dim'}" href="${href('quiz', 'miss')}">${I.redo}<b>Ôn câu sai</b><span>${missed.length ? `${missed.length} bài cần ôn` : 'Chưa có câu sai'}</span></a></section>` +
    (missed.length
      ? `<section class="card"><h2>Bài hay sai</h2><div class="rows">` +
        missed
          .slice(0, 8)
          .map(([t, c]) => `<a class="rowlink" href="${href('n', t)}"><span>${esc(t)}<small>${esc(unitById(N[t].u).t)}</small></span><span class="pill bad">sai ${c}×</span></a>`)
          .join('') +
        `</div></section>`
      : '') +
    `</div><div class="review-side"><section class="card"><h2>Theo chuyên đề</h2><div class="rows">` +
    rows
      .map(
        ({ u, a: ua, n }) =>
          `<div class="urow"><a class="urow-t" href="${href('u', u.id)}"><b>${esc(u.t)}</b>` +
          (ua ? `<span class="urow-a">${bar(ua.p)}<small>${ua.p}% · ${ua.t} câu</small></span>` : `<small>${n ? 'Chưa làm quiz' : 'Không có quiz'}</small>`) +
          `</a><a class="mini" href="${href('fc', u.id)}" aria-label="Flashcard ${esc(u.t)}">${I.cards}</a>` +
          (n ? `<a class="mini" href="${href('quiz', u.id)}" aria-label="Quiz ${esc(u.t)}">${I.quiz}</a>` : `<span class="mini off"></span>`) +
          `</div>`,
      )
      .join('') +
    `</div></section></div></div>` +
    `<div class="danger-zone"><button class="btn ghost danger" data-act="reset-all">${I.redo}Xoá toàn bộ tiến độ</button></div></div>`

  return { title: 'Ôn tập', tab: 'review', html }
}
