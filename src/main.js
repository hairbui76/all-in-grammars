import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/ui.css'
import './styles/lesson.css'
import './styles/practice.css'

import { actions, app, on } from './app.js'
import { U, N, META, pct, totalDone } from './data.js'
import { S, save, effectiveTheme } from './state.js'
import { esc, href, I, bar, empty } from './ui.js'
import { home } from './views/home.js'
import { units, unit } from './views/units.js'
import { lesson } from './views/lesson.js'
import { search } from './views/search.js'
import { review } from './views/review.js'
import { flashcards } from './views/flashcards.js'
import { quiz } from './views/quiz.js'

const APP = 'All in Grammars'
const main = document.getElementById('main')
const sidebar = document.getElementById('sidebar')
const topbar = document.getElementById('topbar')
const tabbar = document.getElementById('tabbar')

// A view takes the route, plus whether it was reached by navigation (rather than an in-place refresh),
// and returns (or resolves to) a page description:
//   title    document title
//   context  short label for the mobile top bar (defaults to title)
//   up       hash of the parent page; shows a back arrow in the top bar
//   tab      which main tab is highlighted: home | units | review | search
//   unit     id of the unit to highlight in the sidebar
//   mode     'lesson' or 'focus' hides the tab bar so the page can own the bottom edge
//   html     page markup
//   mount    optional (root) => cleanup, run after the markup is in place
//   keys     optional keydown handler for page shortcuts
const views = { home, units, u: unit, n: lesson, search, review, fc: flashcards, quiz }

const TABS = [
  ['home', '#/', 'Trang chủ', I.home],
  ['units', '#/units', 'Chuyên đề', I.units],
  ['review', '#/review', 'Ôn tập', I.review],
  ['search', '#/search', 'Tìm kiếm', I.search],
]

/* ================= theme and text size ================= */
function applyTheme() {
  const t = effectiveTheme()
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#0f1412' : '#f7f7f4'
}
function applyTextSize() {
  document.documentElement.style.setProperty('--read', ['0.9375rem', '1.0625rem', '1.1875rem'][S.fs] || '1.0625rem')
}
on('theme', () => {
  S.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'
  save()
  applyTheme()
  renderChrome()
})
function applyVietnamese() {
  document.documentElement.classList.toggle('no-vi', !S.vi)
}
on('vi', (_, el) => {
  S.vi = !S.vi
  save()
  applyVietnamese()
  el.classList.toggle('on', S.vi)
  el.setAttribute('aria-pressed', String(S.vi))
})
on('fs', () => {
  S.fs = (S.fs + 1) % 3
  save()
  applyTextSize()
})
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
applyTheme()
applyTextSize()
applyVietnamese()

/* ================= shell ================= */
let page = { tab: 'home' }

const themeButton = (cls = 'icon-btn') =>
  `<button class="${cls}" data-act="theme" aria-label="Đổi giao diện sáng/tối">${effectiveTheme() === 'dark' ? I.sun : I.moon}</button>`

function renderChrome() {
  const done = totalDone()
  const total = Math.round((done / META.total) * 100)

  let side =
    `<a class="brand" href="#/"><span class="logo">G</span><span>${APP}</span></a>` +
    `<a class="side-search" href="#/search">${I.search}<span>Tìm bài học…</span><kbd>/</kbd></a>` +
    `<div class="side-nav">` +
    TABS.slice(0, 3)
      .map(([id, to, label, icon]) => `<a class="side-link${page.tab === id && !page.unit ? ' on' : ''}" href="${to}">${icon}<span>${label}</span></a>`)
      .join('') +
    `</div><div class="side-units">`
  let group = null
  for (const u of U) {
    if (u.g !== group) {
      group = u.g
      side += `<div class="side-group">${esc(group)}</div>`
    }
    const p = pct(u)
    side +=
      `<a class="side-unit${page.unit === u.id ? ' on' : ''}" href="${href('u', u.id)}"${page.unit === u.id ? ' aria-current="true"' : ''}>` +
      `<span class="side-unit-t">${esc(u.t)}</span><span class="side-unit-p${p === 100 ? ' full' : ''}">${p === 100 ? I.check : p ? `${p}%` : ''}</span></a>`
  }
  side +=
    `</div><div class="side-foot"><div class="side-total"><span>Đã học ${done}/${META.total}</span>${bar(total)}</div>${themeButton()}</div>`
  sidebar.innerHTML = side

  topbar.innerHTML =
    (page.up
      ? `<a class="icon-btn" href="${page.up}" aria-label="Quay lại">${page.mode === 'focus' ? I.close : I.back}</a>`
      : `<a class="logo" href="#/" aria-label="${APP}">G</a>`) +
    `<div class="topbar-t">${esc(page.context || page.title || APP)}</div>${themeButton()}`

  tabbar.innerHTML = TABS.map(
    ([id, to, label, icon]) =>
      `<a class="tab${page.tab === id ? ' on' : ''}" href="${to}"${page.tab === id ? ' aria-current="page"' : ''}>${icon}<span>${label}</span></a>`,
  ).join('')
}

/* ================= router ================= */
let token = 0 // bumped on every render so a slow view cannot paint over a newer one
let cleanup = null

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

const notFound = () => ({
  title: 'Không tìm thấy',
  tab: 'home',
  html: `<div class="page">${empty('Không tìm thấy trang này.', '<a class="btn primary" href="#/">Về trang chủ</a>')}</div>`,
})

async function render(fresh = false) {
  const my = ++token
  const view = views[app.route.view] || notFound
  const slow = setTimeout(() => {
    if (my === token) main.innerHTML = '<div class="page"><p class="loading">Đang tải…</p></div>'
  }, 250)
  let next
  try {
    next = (await view(app.route, fresh)) || notFound()
  } catch (err) {
    console.error(err)
    next = {
      title: 'Lỗi',
      tab: page.tab,
      html: `<div class="page">${empty('Không tải được nội dung. Kiểm tra kết nối mạng rồi thử lại.', '<button class="btn primary" data-act="retry">Thử lại</button>')}</div>`,
    }
  } finally {
    clearTimeout(slow)
  }
  if (my !== token) return
  cleanup?.()
  page = next
  document.title = page.title && page.title !== APP ? `${page.title} · ${APP}` : APP
  document.body.dataset.mode = page.mode || ''
  renderChrome()
  main.innerHTML = page.html
  cleanup = page.mount?.(main) || null
}

app.refresh = async () => {
  const y = scrollY
  await render()
  scrollTo(0, y)
}
app.refreshChrome = renderChrome
app.go = (hash) => {
  viaLink = true
  location.hash = hash
}
on('retry', () => render())

// Following a link starts at the top of the new page; back/forward return to where the reader was.
const scrollPos = new Map()
let viaLink = false
let currentHash = location.hash
history.scrollRestoration = 'manual'
addEventListener('scroll', () => scrollPos.set(currentHash, scrollY), { passive: true })
addEventListener('hashchange', async () => {
  currentHash = location.hash
  app.route = parseRoute()
  document.getElementById('modal')?.remove()
  const y = viaLink ? 0 : scrollPos.get(currentHash) || 0
  viaLink = false
  await render(true)
  scrollTo(0, y)
  if (y === 0) main.focus({ preventScroll: true })
})

/* ================= events ================= */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#/"]')
  if (link) {
    viaLink = link.getAttribute('href') !== location.hash
    return
  }
  // an open menu closes on any click outside it
  for (const m of document.querySelectorAll('details.menu[open]')) if (!m.contains(e.target)) m.open = false
  const el = e.target.closest('[data-act]')
  if (el && !el.disabled) actions[el.dataset.act]?.(el.dataset.a, el, e)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('modal')?.querySelector('[data-act="modal-no"]')?.click()
    for (const m of document.querySelectorAll('details.menu[open]')) m.open = false
    return
  }
  if (e.target.matches('input, textarea') || document.getElementById('modal')) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '/') {
    e.preventDefault()
    app.go('#/search')
    return
  }
  page.keys?.(e)
})

app.route = parseRoute()
render(true)
// lesson titles are used as keys all over; fail loudly in dev if the data is missing
if (import.meta.env.DEV && !Object.keys(N).length) console.warn('No lessons found. Run "npm run content".')
