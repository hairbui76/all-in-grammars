import { app, on } from '../app.js'
import { confirmDialog } from '../confirm.js'
import { U, N, META, unitById, doneIn, pct, totalDone, nextInUnit, quizCount } from '../data.js'
import { S, setDone, resetUnit, accuracy } from '../state.js'
import { esc, href, pad2, I, bar } from '../ui.js'

on('chk', (title) => {
  setDone(title, !S.done[title])
  app.refresh()
})

on('mark-all', (id) => {
  const u = unitById(id)
  const all = doneIn(u) === u.n.length
  for (const t of u.n) setDone(t, !all)
  app.refresh()
})

on('reset-unit', async (id) => {
  const u = unitById(id)
  const a = accuracy(u.id)
  const ok = await confirmDialog({
    title: 'Đặt lại chuyên đề này?',
    body: `Xoá tiến độ của <b>${esc(u.t)}</b>: ${doneIn(u)}/${u.n.length} bài đã học${a ? ` và ${a.t} câu quiz đã làm` : ''}. Các chuyên đề khác không đổi.`,
    yes: 'Xoá tiến độ',
  })
  if (!ok) return
  resetUnit(u)
  app.refresh()
})

/** Compact unit row: number, names, progress. */
export function unitCard(u) {
  const p = pct(u)
  return (
    `<a class="ucard${p === 100 ? ' full' : ''}" href="${href('u', u.id)}"><span class="ucard-n">${p === 100 ? I.check : pad2(u.id)}</span>` +
    `<span class="ucard-b"><b>${esc(u.t)}</b><small>${esc(u.vn)}</small>${bar(p)}</span>` +
    `<span class="ucard-c">${doneIn(u)}/${u.n.length}</span></a>`
  )
}

export function units() {
  const done = totalDone()
  let html =
    `<div class="page wide"><header class="phead"><h1>Chuyên đề</h1>` +
    `<p class="muted">${U.length} chuyên đề · đã học ${done}/${META.total} bài</p></header>`
  let group = null
  U.forEach((u, i) => {
    if (u.g !== group) {
      group = u.g
      html += `<section class="block"><h2>${esc(group)}</h2><div class="ulist cols">`
    }
    html += unitCard(u)
    if (U[i + 1]?.g !== u.g) html += '</div></section>'
  })
  return { title: 'Chuyên đề', tab: 'units', html: html + '</div>' }
}

export function unit({ arg }) {
  const u = unitById(arg)
  if (!u) return null
  const d = doneIn(u)
  const p = pct(u)
  const a = accuracy(u.id)
  const next = nextInUnit(u)
  const quizzes = quizCount(u)

  const primary = next
    ? `<a class="btn primary cta-main" href="${href('n', next)}">${I.play}<span class="btn-2"><b>${d ? 'Học tiếp' : 'Bắt đầu học'}</b><small>${esc(next)}</small></span></a>`
    : `<a class="btn primary cta-main" href="${href('quiz', `u-${u.id}`)}">${I.quiz}<span class="btn-2"><b>Đã học hết ${u.n.length} bài</b><small>Làm quiz để kiểm tra</small></span></a>`

  let html =
    `<div class="page"><nav class="crumbs" aria-label="Vị trí"><a href="#/units">Chuyên đề</a><span>›</span><span>${esc(u.g)}</span></nav>` +
    `<header class="phead"><p class="eyebrow">Chuyên đề ${pad2(u.id)}</p><h1>${esc(u.t)}</h1>` +
    `<p class="vn">${esc(u.vn)}</p><p class="muted">${esc(u.desc || '')}</p>` +
    `<div class="uprog">${bar(p)}<span><b>${d}/${u.n.length}</b> bài</span>${a ? `<span>Quiz đúng <b>${a.p}%</b></span>` : ''}</div></header>` +
    `<div class="cta">${primary}` +
    `<a class="btn" href="${href('fc', u.id)}">${I.cards}Flashcard</a>` +
    (quizzes ? `<a class="btn" href="${href('quiz', `u-${u.id}`)}">${I.quiz}Quiz<span class="count">${quizzes}</span></a>` : '') +
    `<details class="menu"><summary class="btn icon-only" aria-label="Tuỳ chọn khác">${I.more}</summary><div class="menu-pop">` +
    `<button data-act="mark-all" data-a="${u.id}">${I.check}${d === u.n.length ? 'Bỏ đánh dấu tất cả' : 'Đánh dấu đã học tất cả'}</button>` +
    `<button class="danger" data-act="reset-unit" data-a="${u.id}">${I.redo}Đặt lại tiến độ</button></div></details></div>` +
    `<ol class="lessons">`
  u.n.forEach((t, i) => {
    const done = !!S.done[t]
    html +=
      `<li class="lrow${done ? ' done' : ''}${t === next ? ' next' : ''}"><a class="lrow-a" href="${href('n', t)}">` +
      `<span class="lrow-n">${i + 1}</span><span class="lrow-b"><b>${esc(t)}</b><span>${esc(N[t].ab)}</span></span></a>` +
      `<button class="tick" data-act="chk" data-a="${esc(t)}" aria-pressed="${done}" aria-label="Đánh dấu đã học: ${esc(t)}">${I.check}</button></li>`
  })
  return { title: u.t, context: 'Chuyên đề', up: '#/units', tab: 'units', unit: u.id, html: html + '</ol></div>' }
}
