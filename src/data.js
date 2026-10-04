// Content produced by scripts/build-content.mjs, plus progress questions asked of it.
import index from './generated/index.json'
import { S } from './state.js'

export const U = index.units
export const N = index.notes
export const META = index.meta
export const PATHS = index.paths

const byId = new Map(U.map((u) => [String(u.id), u]))
export const unitById = (id) => byId.get(String(id)) || null
export const unitOfNote = (title) => (N[title] ? unitById(N[title].u) : null)

export const doneIn = (u) => u.n.reduce((c, t) => c + (S.done[t] ? 1 : 0), 0)
export const pct = (u) => (u.n.length ? Math.round((doneIn(u) / u.n.length) * 100) : 0)
export const totalDone = () => Object.keys(S.done).reduce((c, t) => c + (N[t] ? 1 : 0), 0)
export const quizCount = (u) => u.n.reduce((c, t) => c + N[t].q.length, 0)
export const missedNotes = () => Object.entries(S.miss).filter(([t]) => N[t]).sort((a, b) => b[1] - a[1])

/** First lesson of a unit not yet marked as learnt. */
export const nextInUnit = (u) => u.n.find((t) => !S.done[t]) || null

/** The lesson to offer on "continue": the one being read, else the next unlearnt one along the study paths. */
export function nextLesson() {
  if (S.last && N[S.last] && !S.done[S.last]) return { t: S.last, resumed: true }
  const order = []
  if (S.last && N[S.last]) order.push(unitOfNote(S.last))
  for (const p of PATHS) for (const id of p.units) order.push(unitById(id))
  order.push(...U)
  for (const u of order) {
    const t = u && nextInUnit(u)
    if (t) return { t, resumed: false }
  }
  return null
}

const loaders = import.meta.glob('./generated/units/*.json')
const chunks = new Map()

/** Lessons and flashcards of one unit: {title: {lead, intro, secs, rel, src, fc}}. */
export function loadUnit(id) {
  if (!chunks.has(id)) {
    const p = loaders[`./generated/units/${id}.json`]().then((m) => m.default)
    p.catch(() => chunks.delete(id))
    chunks.set(id, p)
  }
  return chunks.get(id)
}

let searchText
/** Plain text of every lesson: {title: text}. */
export function loadSearch() {
  searchText ??= import('./generated/search.json').then((m) => m.default)
  searchText.catch(() => (searchText = undefined))
  return searchText
}
