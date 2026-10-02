// Learner progress, persisted to localStorage.
//   done  {noteTitle: 1}        lessons marked as learnt
//   q     {ok, no}              quiz answers overall
//   qu    {unitId: {ok, no}}    quiz answers per unit
//   miss  {noteTitle: count}    wrong answers per lesson
//   last  noteTitle | null      last lesson opened
//   theme 'light' | 'dark' | null (null follows the system)
const KEY = 'engram-v1'

const blank = () => ({ done: {}, theme: null, last: null, q: { ok: 0, no: 0 }, qu: {}, miss: {} })

export const S = blank()
try {
  const stored = JSON.parse(localStorage.getItem(KEY))
  if (stored && typeof stored === 'object') {
    for (const k of Object.keys(S)) {
      const ok = k === 'theme' || k === 'last' ? typeof stored[k] === 'string' : stored[k] && typeof stored[k] === 'object'
      if (ok) S[k] = stored[k]
    }
  }
} catch {}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S))
  } catch {}
}

export function resetAll() {
  Object.assign(S, blank(), { theme: S.theme })
  save()
}

export function resetUnit(unit) {
  for (const t of unit.n) {
    delete S.done[t]
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

export function recordAnswer(unitId, noteTitle, ok) {
  const st = (S.qu[unitId] ??= { ok: 0, no: 0 })
  if (ok) {
    S.q.ok++
    st.ok++
  } else {
    S.q.no++
    st.no++
    S.miss[noteTitle] = (S.miss[noteTitle] || 0) + 1
  }
  save()
}

/** Accuracy for one unit, or overall when no id is given. */
export function accuracy(unitId) {
  const st = unitId == null ? S.q : S.qu[unitId]
  const t = st ? st.ok + st.no : 0
  return t ? { ok: st.ok, no: st.no, t, p: Math.round((st.ok / t) * 100) } : null
}

export function effectiveTheme() {
  if (S.theme === 'dark' || S.theme === 'light') return S.theme
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
