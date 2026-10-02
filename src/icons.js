const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`

export const ICON = {
  read: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v18H6.5A2.5 2.5 0 0 0 4 18.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v18h4.5a2.5 2.5 0 0 1 2.5 2.5"/>'),
  card: svg('<rect x="3" y="6" width="14" height="13" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v11"/>'),
  quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4"/><path d="M12 17.2h.01"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  next: svg('<path d="m9 18 6-6-6-6"/>'),
  check: svg('<path d="m4 12 5 5L20 6"/>'),
  up: svg('<path d="m6 15 6-6 6 6"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
}
