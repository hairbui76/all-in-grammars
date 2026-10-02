// Content produced by scripts/build-content.mjs.
import index from './generated/index.json'

export const U = index.units
export const N = index.notes
export const META = index.meta

const byId = new Map(U.map((u) => [String(u.id), u]))
export const unitById = (id) => byId.get(String(id)) || null
export const unitOfNote = (title) => (N[title] ? unitById(N[title].u) : null)

const loaders = import.meta.glob('./generated/units/*.json')
const chunks = new Map()

/** Rendered lessons and flashcards of one unit: {title: {h, src, fc}}. */
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
