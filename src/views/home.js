import { app, on } from '../app.js'
import { U, N, META, PATHS, unitById, unitOfNote, doneIn, pct, totalDone, nextLesson, missedNotes } from '../data.js'
import { S, save, accuracy, streak, week } from '../state.js'
import { esc, href, I, bar, ring } from '../ui.js'
import { unitCard } from './units.js'

on('path', (i) => {
  S.path = Number(i)
  save()
  app.refresh()
})

function resumeCard() {
  const next = nextLesson()
  if (!next) {
    return (
      `<div class="resume done"><span class="eyebrow">Hoàn thành</span><strong>Bạn đã học hết ${META.total} bài</strong>` +
      `<span class="resume-ab">Giữ phong độ bằng quiz tổng hợp và flashcard.</span>` +
      `<a class="btn primary" href="${href('quiz', 'all')}">${I.quiz}Làm quiz tổng hợp</a></div>`
    )
  }
  const u = unitOfNote(next.t)
  const started = totalDone() > 0 || S.last
  return (
    `<a class="resume" href="${href('n', next.t)}">` +
    `<span class="eyebrow">${started ? (next.resumed ? 'Đang đọc dở' : 'Bài tiếp theo') : 'Bắt đầu từ đây'} · ${esc(u.t)} · bài ${u.n.indexOf(next.t) + 1}/${u.n.length}</span>` +
    `<strong>${esc(next.t)}</strong><span class="resume-ab">${esc(N[next.t].ab)}</span>` +
    `<span class="resume-go">${I.play}${started ? 'Học tiếp' : 'Bắt đầu học'}</span></a>`
  )
}

function statsCard() {
  const done = totalDone()
  const a = accuracy()
  const st = streak()
  const days = week()
  const peak = Math.max(1, ...days.map((d) => d.n))
  return (
    `<section class="card stats"><div class="stat-row">` +
    `<div class="stat"><b>${done}</b><span>bài đã học</span></div>` +
    `<div class="stat"><b>${a ? `${a.p}%` : '—'}</b><span>quiz đúng</span></div>` +
    `<div class="stat"><b class="${st ? 'hot' : ''}">${st}</b><span>ngày liên tiếp</span></div></div>` +
    `<div class="week" aria-label="Hoạt động 7 ngày qua">` +
    days
      .map(
        (d) =>
          `<div class="day${d.today ? ' today' : ''}" title="${d.n} lượt học"><span class="day-bar"><i style="height:${d.n ? Math.max(18, Math.round((d.n / peak) * 100)) : 0}%"></i></span><span>${d.label}</span></div>`,
      )
      .join('') +
    `</div></section>`
  )
}

function quickActions() {
  const missed = missedNotes().length
  const cur = S.last && N[S.last] ? unitOfNote(S.last) : unitById(PATHS[0]?.units[0]) || U[0]
  return (
    `<section class="quick">` +
    `<a class="tile" href="${href('quiz', 'all')}">${I.quiz}<b>Quiz nhanh</b><span>10 câu ngẫu nhiên</span></a>` +
    `<a class="tile${missed ? '' : ' dim'}" href="${href('quiz', 'miss')}">${I.redo}<b>Ôn câu sai</b><span>${missed ? `${missed} bài cần ôn` : 'Chưa có câu sai'}</span></a>` +
    `<a class="tile" href="${href('fc', cur.id)}">${I.cards}<b>Flashcard</b><span>${esc(cur.t)}</span></a>` +
    `</section>`
  )
}

function pathsCard() {
  if (!PATHS.length) return ''
  const sel = PATHS[S.path] ? S.path : 0
  const p = PATHS[sel]
  const steps = p.units.map(unitById).filter(Boolean)
  // the first unfinished unit is where the learner stands on this path
  const here = steps.find((u) => pct(u) < 100)
  return (
    `<section class="card"><h2>Lộ trình gợi ý</h2><div class="seg" role="tablist">` +
    PATHS.map(
      (x, i) => `<button role="tab" aria-selected="${i === sel}" class="seg-b${i === sel ? ' on' : ''}" data-act="path" data-a="${i}">${esc(x.title)}</button>`,
    ).join('') +
    `</div><p class="muted">${esc(p.desc)}</p><ol class="steps">` +
    steps
      .map((u, i) => {
        const full = pct(u) === 100
        return (
          `<li><a class="step${full ? ' full' : ''}${u === here ? ' here' : ''}" href="${href('u', u.id)}">` +
          `<span class="step-n">${full ? I.check : i + 1}</span>` +
          `<span class="step-b"><b>${esc(u.t)}</b><small>${esc(u.vn)}</small></span>` +
          `<span class="step-c">${doneIn(u)}/${u.n.length}</span></a></li>`
        )
      })
      .join('') +
    `</ol></section>`
  )
}

function inProgress() {
  const list = U.filter((u) => pct(u) > 0 && pct(u) < 100)
  if (!list.length) return ''
  return `<section class="block"><h2>Đang học</h2><div class="ulist">${list.slice(0, 4).map(unitCard).join('')}</div></section>`
}

function missedCard() {
  const missed = missedNotes()
  if (!missed.length) return ''
  return (
    `<section class="card"><h2>Cần ôn lại</h2><div class="rows">` +
    missed
      .slice(0, 4)
      .map(([t, c]) => `<a class="rowlink" href="${href('n', t)}"><span>${esc(t)}</span><span class="pill bad">sai ${c}×</span></a>`)
      .join('') +
    `</div></section>`
  )
}

export function home() {
  const p = Math.round((totalDone() / META.total) * 100)
  return {
    title: 'All in Grammars',
    tab: 'home',
    html:
      `<div class="page wide home"><header class="hero"><div><p class="eyebrow">${META.total} bài · ${U.length} chuyên đề</p>` +
      `<h1>Ngữ pháp tiếng Anh</h1></div>${ring(p, { size: 60, stroke: 6, label: `${p}%` })}</header>` +
      `<div class="home-grid"><div class="home-main">${resumeCard()}${quickActions()}${pathsCard()}</div>` +
      `<aside class="home-side">${statsCard()}${missedCard()}${inProgress()}` +
      `<a class="btn block-btn" href="#/units">${I.units}Xem tất cả ${U.length} chuyên đề</a></aside></div>` +
      `<p class="foot">Nội dung rút từ <i>${esc(META.book)}</i>. Tiến độ lưu trên trình duyệt này.</p></div>`,
  }
}
