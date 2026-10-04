// Small rendering helpers shared by every view.

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/')
export const pad2 = (n) => String(n).padStart(2, '0')

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const svg = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`

export const I = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  units: svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>'),
  review: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  next: svg('<path d="m9 18 6-6-6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: svg('<path d="m4 12 5 5L20 6"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  cards: svg('<rect x="3" y="7" width="14" height="13" rx="2.5"/><path d="M7.5 3.5H18A3 3 0 0 1 21 6.5V16"/>'),
  quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4"/><path d="M12 17.2h.01"/>'),
  redo: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>'),
}

/** Thin progress bar. */
export const bar = (p) => `<span class="bar" role="img" aria-label="${p}%"><i style="width:${p}%"></i></span>`

/** Circular progress with an optional label in the middle. */
export function ring(p, { size = 44, stroke = 4, label = '' } = {}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const mid = size / 2
  return (
    `<span class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
    `<circle class="ring-bg" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>` +
    // no arc at 0%: the round line cap would still paint a dot
    (p ? `<circle class="ring-fg" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${((c * p) / 100).toFixed(1)} ${c.toFixed(1)}"/>` : '') +
    `</svg>${label ? `<b>${label}</b>` : ''}</span>`
  )
}

/** Centered message with optional actions, for empty and error states. */
export const empty = (text, actions = '') =>
  `<div class="empty"><p>${text}</p>${actions ? `<div class="row center">${actions}</div>` : ''}</div>`
