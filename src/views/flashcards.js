import { app, on } from '../app.js'
import { N, unitById, loadUnit } from '../data.js'
import { S, setKnown } from '../state.js'
import { esc, href, shuffle, I, bar, ring } from '../ui.js'

// One deck at a time, kept while the tab is open.
let FC = { unit: null, list: [], i: 0, flip: false, total: 0 }
let swipedAt = 0 // a swipe ends with a click on the card; that click must not flip it

function newDeck(u) {
  // cards not yet known come first
  const fresh = shuffle(u.n.filter((t) => !S.known[t]))
  const known = shuffle(u.n.filter((t) => S.known[t]))
  FC = { unit: u.id, list: [...fresh, ...known], i: 0, flip: false, total: u.n.length }
}

function setFlip(flip) {
  FC.flip = flip
  document.querySelector('.fc-page')?.classList.toggle('flipped', flip)
}

on('fc-flip', () => {
  if (Date.now() - swipedAt > 350) setFlip(!FC.flip)
})

function rate(ok) {
  const title = FC.list[FC.i]
  if (!title) return
  setKnown(title, ok)
  // a card not known yet comes back at the end of the deck
  if (!ok) FC.list.push(title)
  FC.i++
  FC.flip = false
  app.refresh()
}
on('fc-rate', (a) => rate(a === 'ok'))
on('fc-new', () => {
  FC.unit = null
  app.refresh()
})

/** Drag the answer side left (not yet) or right (known). */
function swipe(root) {
  const card = root.querySelector('#fc')
  if (!card) return
  let startX = null
  let dx = 0
  const end = () => {
    if (startX === null) return
    startX = null
    card.style.transition = ''
    if (Math.abs(dx) > 70) {
      swipedAt = Date.now()
      rate(dx > 0)
    } else card.style.transform = ''
    dx = 0
  }
  card.addEventListener('pointerdown', (e) => {
    if (!FC.flip || e.target.closest('a')) return
    startX = e.clientX
    card.style.transition = 'none'
  })
  card.addEventListener('pointermove', (e) => {
    if (startX === null) return
    dx = e.clientX - startX
    if (Math.abs(dx) > 8) {
      swipedAt = Date.now()
      card.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`
    }
  })
  card.addEventListener('pointerup', end)
  card.addEventListener('pointercancel', end)
}

export async function flashcards({ arg }, fresh) {
  const u = unitById(arg)
  if (!u) return null
  if (FC.unit !== u.id || (fresh && FC.i >= FC.list.length)) newDeck(u)
  const chunk = await loadUnit(u.id)
  const base = { title: `Flashcard · ${u.t}`, context: `Flashcard · ${u.t}`, up: href('u', u.id), tab: 'units', unit: u.id, mode: 'focus' }

  if (FC.i >= FC.list.length) {
    const known = u.n.filter((t) => S.known[t]).length
    const p = Math.round((known / u.n.length) * 100)
    return {
      ...base,
      html:
        `<div class="practice"><div class="result-card">${ring(p, { size: 96, stroke: 8, label: `${p}%` })}` +
        `<h1>Xong bộ thẻ</h1><p class="muted">Bạn đã thuộc ${known}/${u.n.length} thẻ của <b>${esc(u.t)}</b>.</p>` +
        `<div class="stack"><button class="btn primary" data-act="fc-new">${I.redo}Học lại bộ thẻ</button>` +
        `<a class="btn" href="${href('quiz', u.id)}">${I.quiz}Làm quiz chuyên đề</a>` +
        `<a class="btn ghost" href="${href('u', u.id)}">Về chuyên đề</a></div></div></div>`,
    }
  }

  const title = FC.list[FC.i]
  const { fc, lead } = chunk[title]
  const n = N[title]
  const seen = Math.min(FC.i, FC.total)
  return {
    ...base,
    html:
      `<div class="practice fc-page${FC.flip ? ' flipped' : ''}">` +
      `<div class="p-top"><a class="icon-btn p-close" href="${base.up}" aria-label="Thoát">${I.close}</a>` +
      `<span class="p-count">${Math.min(FC.i + 1, FC.total)}/${FC.total}</span>${bar(Math.round((seen / FC.total) * 100))}</div>` +
      `<div class="fc" id="fc" data-act="fc-flip" role="button" tabindex="0" aria-label="Lật thẻ"><div class="fc-in">` +
      `<div class="fc-face front"><span class="eyebrow">${esc(u.t)}</span><h2>${esc(title)}</h2>` +
      (n.al.length ? `<p class="aliases">${esc(n.al.join(' · '))}</p>` : '') +
      `<p class="fc-hint">Nhớ lại công thức và cách dùng, rồi chạm để lật thẻ</p></div>` +
      `<div class="fc-face back"><span class="eyebrow">${esc(title)}</span>` +
      (lead ? `<p class="fc-lead">${lead}</p>` : '') +
      (fc.f ? `<div class="fc-form prose">${fc.f}</div>` : '') +
      (fc.e.length ? `<ul class="fc-ex">${fc.e.map((e) => `<li>${e}</li>`).join('')}</ul>` : '') +
      `<a class="fc-open" href="${href('n', title)}">${I.book}Mở bài đầy đủ</a></div>` +
      `</div></div>` +
      `<div class="p-bar"><button class="btn primary grow when-front" data-act="fc-flip">Lật thẻ</button>` +
      `<button class="btn grow when-back" data-act="fc-rate" data-a="again">${I.redo}Chưa thuộc</button>` +
      `<button class="btn primary grow when-back" data-act="fc-rate" data-a="ok">${I.check}Đã thuộc</button></div></div>`,
    mount: swipe,
    keys(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target.closest('button, a')) return
        e.preventDefault()
        setFlip(!FC.flip)
      } else if (FC.flip && e.key === 'ArrowRight') rate(true)
      else if (FC.flip && e.key === 'ArrowLeft') rate(false)
    },
  }
}
