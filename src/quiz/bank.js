// The quiz bank, loaded on first use and indexed for the lookups question building needs.
import { N, loadQuiz } from '../data.js'

let ready

function index(items) {
  const byId = new Map()
  const byKind = {}
  const byNote = new Map()
  const byUnit = new Map()
  for (const x of items) {
    x.u = N[x.n].u
    byId.set(x.i, x)
    ;(byKind[x.k] ??= []).push(x)
    byNote.set(x.n, [...(byNote.get(x.n) || []), x])
    byUnit.set(x.u, [...(byUnit.get(x.u) || []), x])
  }
  // Prepositions and particles that are answers in a unit, repeated as often as they occur: the pool
  // of wrong options for that unit's other questions, so common ones turn up most.
  const prepAnswers = (unit) => (byUnit.get(unit) || []).filter((x) => x.k === 'prep').map((x) => x.a)
  return {
    items,
    byId,
    byKind,
    prepAnswers,
    ofNote: (title) => byNote.get(title) || [],
    ofUnit: (id) => byUnit.get(id) || [],
  }
}

/** Resolves to the indexed bank. */
export function loadBank() {
  ready ??= loadQuiz().then(index)
  ready.catch(() => (ready = undefined))
  return ready
}
