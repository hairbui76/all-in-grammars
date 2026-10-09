import { app, on } from '../app.js'
import { N, unitById, unitOfNote, loadUnit } from '../data.js'
import { S, save, setDone } from '../state.js'
import { esc, href, I } from '../ui.js'

/* ---------- mark as learnt ---------- */
function lessonBar(title) {
  const u = unitOfNote(title)
  const i = u.n.indexOf(title)
  const prev = u.n[i - 1]
  const next = u.n[i + 1]
  const done = !!S.done[title]
  const side = (t, dir) =>
    t
      ? `<a class="lbar-nav ${dir}" href="${href('n', t)}" aria-label="${dir === 'prev' ? 'Bài trước' : 'Bài sau'}: ${esc(t)}">` +
        `${dir === 'prev' ? I.back : ''}<span class="lbar-t"><small>${dir === 'prev' ? 'Bài trước' : 'Bài sau'}</small><b>${esc(t)}</b></span>${dir === 'next' ? I.next : ''}</a>`
      : dir === 'next'
        ? `<a class="lbar-nav next" href="${href('u', u.id)}" aria-label="Về chuyên đề ${esc(u.t)}"><span class="lbar-t"><small>Hết chuyên đề</small><b>Về ${esc(u.t)}</b></span>${I.next}</a>`
        : `<span class="lbar-nav prev off"></span>`
  return (
    `<div class="lbar${done ? ' is-done' : ''}">${side(prev, 'prev')}` +
    `<button class="btn ${done ? 'done' : 'primary'} lbar-done" data-act="done" data-a="${esc(title)}" aria-pressed="${done}">${I.check}<span>${done ? 'Đã học' : 'Đánh dấu đã học'}</span></button>` +
    `${side(next, 'next')}</div>`
  )
}

on('done', (title) => {
  setDone(title, !S.done[title])
  document.querySelector('.lbar').outerHTML = lessonBar(title)
  app.refreshChrome()
})

/* ---------- in-page navigation ---------- */
on('jump', (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

/** Highlights the section being read in the chip row and the side rail. */
function scrollSpy(root) {
  const links = [...root.querySelectorAll('[data-act="jump"]')]
  const chips = root.querySelector('.toc-chips')
  let current = null
  const setCurrent = (id) => {
    if (id === current) return
    current = id
    for (const l of links) l.classList.toggle('on', l.dataset.a === id)
    const chip = chips?.querySelector('.on')
    if (chip) chips.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' })
  }
  const io = new IntersectionObserver(
    (entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) setCurrent(seen[0].target.id)
    },
    { rootMargin: '-15% 0px -70% 0px' },
  )
  for (const s of root.querySelectorAll('.sec[id]')) io.observe(s)
  return () => io.disconnect()
}

export async function lesson({ arg: title }) {
  const n = N[title]
  if (!n) return null
  const u = unitById(n.u)
  if (S.last !== title) {
    S.last = title
    save()
  }
  const body = (await loadUnit(u.id))[title]
  const i = u.n.indexOf(title)

  const toc = body.secs.map((s, k) => ({ id: `s${k}`, label: s.vn || s.en }))
  const tocLinks = toc.map((x) => `<button data-act="jump" data-a="${x.id}">${x.label}</button>`).join('')

  const html =
    `<div class="lesson-wrap"><article class="lesson"><header class="lhead">` +
    `<div class="lmeta"><a href="${href('u', u.id)}">${esc(u.t)}</a><span>Bài ${i + 1}/${u.n.length}</span>` +
    `<span class="ltools"><button class="aa${S.vi ? ' on' : ''}" data-act="vi" aria-pressed="${S.vi}" aria-label="Hiện hoặc ẩn phần tiếng Việt">Việt</button>` +
    `<button class="aa" data-act="fs" aria-label="Đổi cỡ chữ">A<b>A</b></button></span></div>` +
    `<h1>${esc(title)}</h1>` +
    (n.al.length ? `<p class="aliases">${esc(n.al.join(' · '))}</p>` : '') +
    (body.lead ? `<p class="lead">${body.lead}${body.leadVi ? `<span class="vi">${body.leadVi}</span>` : ''}</p>` : '') +
    `</header>` +
    (toc.length > 1 ? `<nav class="toc-chips" aria-label="Mục trong bài">${tocLinks}</nav>` : '') +
    (body.intro ? `<div class="prose">${body.intro}</div>` : '') +
    body.secs
      .map(
        (s, k) =>
          `<section class="sec sec-${s.k}" id="s${k}"><h2>${s.vn || s.en}${s.vn && s.en ? `<small>${s.en}</small>` : ''}</h2>` +
          `<div class="prose">${s.h}</div></section>`,
      )
      .join('') +
    (body.rel.length
      ? `<section class="sec sec-rel"><h2>Bài liên quan</h2><div class="chipset">` +
        body.rel.map((r) => `<a class="chip${r.h.startsWith('#/u/') ? ' unit' : ''}" href="${r.h}">${r.h.startsWith('#/u/') ? I.units : ''}${esc(r.t)}</a>`).join('') +
        `</div></section>`
      : '') +
    (body.src ? `<p class="src">Nguồn: ${esc(body.src)}</p>` : '') +
    lessonBar(title) +
    `</article>` +
    (toc.length > 1 ? `<aside class="toc-rail" aria-label="Mục trong bài"><p>Trong bài này</p>${tocLinks}</aside>` : '') +
    `</div>`

  return {
    title,
    context: `${u.t} · ${i + 1}/${u.n.length}`,
    up: href('u', u.id),
    tab: 'units',
    unit: u.id,
    mode: 'lesson',
    html,
    mount: scrollSpy,
    keys(e) {
      const t = e.key === 'ArrowRight' ? u.n[i + 1] : e.key === 'ArrowLeft' ? u.n[i - 1] : null
      if (t) app.go(href('n', t))
    },
  }
}
