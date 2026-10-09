// Learner progress, persisted to localStorage.
//   done   {lesson: 1}          lessons marked as learnt
//   known  {lesson: 1}          flashcards the learner said they know
//   q      {ok, no}             quiz answers overall
//   qu     {unitId: {ok, no}}   quiz answers per unit
//   miss   {lesson: count}      wrong answers per lesson
//   days   {YYYY-MM-DD: count}  study activity per day (drives the streak)
//   last   lesson | null        last lesson opened
//   theme  'light' | 'dark' | null (null follows the system)
//   fs     0 | 1 | 2            reading text size
//   vi     boolean              show the Vietnamese lines in lessons
//   path   index of the study path shown on the home page
const KEY = 'engram-v1'

const blank = () => ({
  done: {},
  known: {},
  q: { ok: 0, no: 0 },
  qu: {},
  miss: {},
  days: {},
  last: null,
  theme: null,
  fs: 1,
  vi: true,
  path: 0,
})

export const S = blank()
try {
  const stored = JSON.parse(localStorage.getItem(KEY))
  if (stored && typeof stored === 'object') {
    const fresh = blank()
    for (const k of Object.keys(fresh)) {
      const v = stored[k]
      const want = fresh[k] === null ? 'string' : typeof fresh[k]
      if (v != null && typeof v === want) S[k] = v
    }
  }
} catch {}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch {}
}

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Counts one unit of study (a lesson finished, a quiz answer, a card known) towards today. */
function touchDay() {
  const k = dayKey()
  S.days[k] = (S.days[k] || 0) + 1
  const keys = Object.keys(S.days).sort()
  for (const old of keys.slice(0, Math.max(0, keys.length - 120))) delete S.days[old]
}

export function setDone(title, done) {
  if (done) {
    if (!S.done[title]) touchDay()
    S.done[title] = 1
  } else delete S.done[title]
  save()
}

export function setKnown(title, known) {
  if (known) {
    if (!S.known[title]) touchDay()
    S.known[title] = 1
  } else delete S.known[title]
  save()
}

export function recordAnswer(unitId, title, ok) {
  const st = (S.qu[unitId] ??= { ok: 0, no: 0 })
  if (ok) {
    S.q.ok++
    st.ok++
  } else {
    S.q.no++
    st.no++
    S.miss[title] = (S.miss[title] || 0) + 1
  }
  touchDay()
  save()
}

/** A correct answer on a lesson that was missed before works it off the review list. */
export function workOffMiss(title) {
  if (S.miss[title] && --S.miss[title] <= 0) delete S.miss[title]
  save()
}

export function resetAll() {
  Object.assign(S, blank(), { theme: S.theme, fs: S.fs, vi: S.vi })
  save()
}

export function resetUnit(unit) {
  for (const t of unit.n) {
    delete S.done[t]
    delete S.known[t]
    delete S.miss[t]
    if (S.last === t) S.last = null
  }
  const st = S.qu[unit.id]
  if (st) {
    S.q.ok = Math.max(0, S.q.ok - st.ok)
    S.q.no = Math.max(0, S.q.no - st.no)
    delete S.qu[unit.id]
  }
  save()
}

/** Accuracy for one unit, or overall when no id is given. */
export function accuracy(unitId) {
  const st = unitId == null ? S.q : S.qu[unitId]
  const t = st ? st.ok + st.no : 0
  return t ? { ok: st.ok, no: st.no, t, p: Math.round((st.ok / t) * 100) } : null
}

/** Consecutive days of study ending today (or yesterday, so the streak survives until midnight). */
export function streak() {
  const d = new Date()
  if (!S.days[dayKey(d)]) d.setDate(d.getDate() - 1)
  let n = 0
  while (S.days[dayKey(d)]) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

/** The last seven days, oldest first. */
export function week() {
  const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { label: names[d.getDay()], n: S.days[dayKey(d)] || 0, today: i === 6 }
  })
}

export function effectiveTheme() {
  if (S.theme === 'dark' || S.theme === 'light') return S.theme
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
