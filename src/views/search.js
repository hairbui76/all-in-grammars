import { N, unitById, loadSearch } from '../data.js'
import { S } from '../state.js'
import { esc, href, I } from '../ui.js'

let query = ''
let fullText = null

function results() {
  const q = query.trim().toLowerCase()
  if (q.length < 2) {
    return `<p class="hint">Gõ ít nhất 2 ký tự. Tìm được tên bài, tên tiếng Việt của chuyên đề và mọi nội dung trong bài.</p>`
  }
  const found = []
  for (const [t, n] of Object.entries(N)) {
    const u = unitById(n.u)
    const tl = t.toLowerCase()
    let score = 0
    let pos = -1
    if (tl === q) score = 100
    else if (tl.startsWith(q)) score = 80
    else if (tl.includes(q)) score = 60
    else if (n.al.some((a) => a.toLowerCase().includes(q))) score = 50
    else if (u.vn.toLowerCase().includes(q)) score = 45
    else if (u.t.toLowerCase().includes(q)) score = 42
    else if (n.ab.toLowerCase().includes(q)) score = 40
    else if (fullText && (pos = fullText[t].toLowerCase().indexOf(q)) > -1) score = 20
    if (score) found.push({ t, n, u, score, pos })
  }
  if (!found.length) return `<p class="hint">${fullText ? `Không tìm thấy “${esc(query)}”.` : 'Đang tìm trong nội dung bài…'}</p>`
  found.sort((a, b) => b.score - a.score || a.t.localeCompare(b.t))

  const rx = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig')
  const mark = (s) => esc(s).replace(rx, '<mark>$1</mark>')
  return (
    `<p class="hint left">${found.length} kết quả</p><div class="results">` +
    found
      .slice(0, 80)
      .map((r) => {
        const snippet = r.pos > -1 ? `…${fullText[r.t].substr(Math.max(0, r.pos - 40), 140)}…` : r.n.ab
        return (
          `<a class="result${S.done[r.t] ? ' done' : ''}" href="${href('n', r.t)}"><b>${mark(r.t)}</b>` +
          `<span class="result-s">${mark(snippet)}</span>` +
          `<span class="result-u">${S.done[r.t] ? `${I.check}Đã học · ` : ''}${esc(r.u.t)} · ${esc(r.u.vn)}</span></a>`
        )
      })
      .join('') +
    `</div>`
  )
}

export function search() {
  return {
    title: 'Tìm kiếm',
    tab: 'search',
    html:
      `<div class="page"><div class="searchbar">${I.search}<input id="q" type="search" autocomplete="off" enterkeyhint="search" ` +
      `aria-label="Tìm kiếm" placeholder="Tìm quy tắc, cấu trúc, ví dụ…" value="${esc(query)}"></div>` +
      `<div id="results" aria-live="polite">${results()}</div></div>`,
    mount(root) {
      const input = root.querySelector('#q')
      const box = root.querySelector('#results')
      const update = () => (box.innerHTML = results())
      input.addEventListener('input', () => {
        query = input.value
        update()
      })
      input.focus()
      let alive = true
      if (!fullText)
        loadSearch().then(
          (t) => {
            fullText = t
            if (alive) update()
          },
          () => {},
        )
      return () => (alive = false)
    },
  }
}
